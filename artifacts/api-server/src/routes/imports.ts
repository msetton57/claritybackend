import { Router, type IRouter } from "express";
import { ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";
import {
  customerContactsTable,
  customersTable,
  db,
  orderItemsTable,
  ordersTable,
  productsTable,
  salesRepsTable,
} from "@workspace/db";
import { requireAuthenticatedUser } from "../lib/auth";
import { logCustomerAction } from "../lib/workflows";

const router: IRouter = Router();

const IMPORT_TEMPLATES = {
  "sales-history": [
    "order_number,customer_name,order_date,status,sku,quantity,unit_price,discount_amount,shipping_cost,shipping_method,tracking_number,custom_terms",
    "INV-2026-0001,Acme Foods,2026-05-01,fulfilled,SKU-1001,24,12.5,0,125,Freight,TRACK-123,Net 30",
    "INV-2026-0001,Acme Foods,2026-05-01,fulfilled,SKU-1002,12,8.75,0,,,,",
    "INV-2026-0002,Sunrise Market,2026-05-03,fulfilled,SKU-1005,48,4.25,0.25,95,LTL,,Net 15",
  ].join("\n"),
  "customer-pos": [
    "order_number,customer_name,order_date,status,sku,quantity,unit_price,discount_amount,shipping_cost,shipping_method,tracking_number,custom_terms",
    "PO-45871,Acme Foods,2026-06-01,open,SKU-1001,120,12.5,0,,,,Net 30",
    "PO-45871,Acme Foods,2026-06-01,open,SKU-1002,60,8.75,0,,,,",
    "PO-88102,Sunrise Market,2026-06-04,in_transit,SKU-1005,96,4.25,0,150,Freight,CUST-TRACK-9,Net 15",
  ].join("\n"),
  customers: [
    "company_name,primary_contact_name,primary_contact_title,email,phone,billing_address,shipping_address,status,payment_terms,credit_limit,custom_pricing,rep_name,customer_since_date",
    "Acme Foods,Jordan Kim,Director of Purchasing,jordan@acmefoods.com,555-0101,\"100 Main St, Dallas, TX 75201\",\"100 Main St, Dallas, TX 75201\",active,Net 30,25000,false,Ava Thompson,2024-01-15",
    "Sunrise Market,Riley Chen,Operations Manager,ops@sunrisemarket.com,555-0147,\"42 Harbor Ave, Tampa, FL 33602\",\"44 Harbor Ave, Tampa, FL 33602\",prospect,Net 15,15000,true,,2026-05-20",
  ].join("\n"),
} as const;

const importRequestSchema = z.object({
  importType: z.enum(["sales-history", "customer-pos"]),
  fileName: z.string().trim().min(1).max(255),
  csvText: z.string().min(1).max(2_000_000),
  mode: z.enum(["validate", "commit"]).default("commit"),
});

const customerImportRequestSchema = z.object({
  importType: z.literal("customers"),
  fileName: z.string().trim().min(1).max(255),
  csvText: z.string().min(1).max(2_000_000),
  mode: z.enum(["validate", "commit"]).default("commit"),
});

const allowedStatuses = new Set(["open", "in_transit", "fulfilled", "cancelled"]);
const allowedCustomerStatuses = new Set(["active", "prospect", "on_hold", "inactive"]);
const requiredHeaders = [
  "order_number",
  "customer_name",
  "order_date",
  "status",
  "sku",
  "quantity",
  "unit_price",
  "discount_amount",
  "shipping_cost",
  "shipping_method",
  "tracking_number",
  "custom_terms",
] as const;
const customerRequiredHeaders = [
  "company_name",
  "primary_contact_name",
  "primary_contact_title",
  "email",
  "phone",
  "billing_address",
  "shipping_address",
  "status",
  "payment_terms",
  "credit_limit",
  "custom_pricing",
  "rep_name",
  "customer_since_date",
] as const;

type ParsedCsvRow = Record<string, string>;
type ImportMode = "validate" | "commit";

type OrderLineDraft = {
  rowNumber: number;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
};

type OrderDraft = {
  orderNumber: string;
  customerName: string;
  orderDate: string;
  status: string;
  shippingCost: number;
  shippingMethod: string | null;
  trackingNumber: string | null;
  customTerms: string | null;
  lines: OrderLineDraft[];
};

type CustomerDraft = {
  companyName: string;
  primaryContactName: string;
  primaryContactTitle: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  status: string | undefined;
  paymentTerms: string | null;
  creditLimit: string | undefined;
  customPricing: boolean | undefined;
  repId: number | null;
  customerSinceDate: string | null;
};

function parseCsv(input: string): ParsedCsvRow[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    const next = input[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        currentValue += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentValue.trim());
      currentValue = "";
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim());

  return dataRows.map((row) => {
    const record: ParsedCsvRow = {};
    headers.forEach((header, columnIndex) => {
      record[header] = row[columnIndex]?.trim() ?? "";
    });
    return record;
  });
}

function parseNumber(value: string, field: string, rowNumber: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Row ${rowNumber}: ${field} must be a number`);
  }
  return parsed;
}

function parseInteger(value: string, field: string, rowNumber: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Row ${rowNumber}: ${field} must be a whole number`);
  }
  return parsed;
}

function parseDate(value: string, field: string, rowNumber: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Row ${rowNumber}: ${field} must use YYYY-MM-DD format`);
  }
  return value;
}

function parseOptionalDate(value: string, field: string, rowNumber: number) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return parseDate(trimmed, field, rowNumber);
}

function parseBoolean(value: string, field: string, rowNumber: number) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`Row ${rowNumber}: ${field} must be true or false`);
}

function parseOptionalEmail(value: string, rowNumber: number) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = z.string().email().safeParse(trimmed);
  if (!parsed.success) {
    throw new Error(`Row ${rowNumber}: email must be a valid email address`);
  }

  return trimmed;
}

function parseOptionalNonNegativeNumber(value: string, field: string, rowNumber: number) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = parseNumber(trimmed, field, rowNumber);
  if (parsed < 0) {
    throw new Error(`Row ${rowNumber}: ${field} must be zero or greater`);
  }

  return parsed;
}

function parseOptionalBoolean(value: string, field: string, rowNumber: number) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return parseBoolean(trimmed, field, rowNumber);
}

function buildResponse({
  fileName,
  importType,
  mode,
  importedOrders,
  importedLines,
  rowErrors = [],
}: {
  fileName: string;
  importType: "sales-history" | "customer-pos";
  mode: ImportMode;
  importedOrders: number;
  importedLines: number;
  rowErrors?: string[];
}) {
  return {
    importedOrders,
    importedLines,
    fileName,
    importType,
    mode,
    rowErrors,
    notes: [
      mode === "validate"
        ? "Validation only. No orders were written to Clarity."
        : "Imported orders do not create invoices automatically.",
      "Imported orders do not adjust inventory automatically.",
      "Customer names must match an existing customer name or company name.",
      "SKUs must already exist in the product catalog.",
    ],
  };
}

function buildCustomerImportResponse({
  fileName,
  mode,
  importedCustomers,
  rowErrors = [],
}: {
  fileName: string;
  mode: ImportMode;
  importedCustomers: number;
  rowErrors?: string[];
}) {
  return {
    importedCustomers,
    fileName,
    importType: "customers" as const,
    mode,
    rowErrors,
    notes: [
      mode === "validate"
        ? "Validation only. No customer records were written to Clarity."
        : "Imported customers are now available in the customer workspace.",
      "Customer name, company name, and primary contact are required on every row.",
      "Job title is optional and imports onto the primary contact record when provided.",
      "Rep names must match an existing sales rep exactly when provided.",
    ],
  };
}

router.get("/imports/templates/:template", (req, res): void => {
  const template = req.params.template as keyof typeof IMPORT_TEMPLATES;
  const content = IMPORT_TEMPLATES[template];

  if (!content) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${template}.csv"`);
  res.send(content);
});

router.post("/imports/orders", async (req, res): Promise<void> => {
  const parsedRequest = importRequestSchema.safeParse(req.body);
  if (!parsedRequest.success) {
    res.status(400).json({ error: parsedRequest.error.issues[0]?.message ?? "Invalid import payload" });
    return;
  }

  let rows: ParsedCsvRow[];
  try {
    rows = parseCsv(parsedRequest.data.csvText);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to parse CSV" });
    return;
  }

  if (rows.length === 0) {
    res.status(400).json({ error: "The uploaded CSV does not contain any data rows" });
    return;
  }

  const headers = Object.keys(rows[0] ?? {});
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    res.status(400).json({ error: `Missing required columns: ${missingHeaders.join(", ")}` });
    return;
  }

  const rowErrors: string[] = [];
  const grouped = new Map<string, OrderDraft>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;

    try {
      const orderNumber = row.order_number.trim();
      const customerName = row.customer_name.trim();
      const orderDate = parseDate(row.order_date.trim(), "order_date", rowNumber);
      const defaultStatus =
        parsedRequest.data.importType === "sales-history" ? "fulfilled" : "open";
      const status = (row.status.trim() || defaultStatus).toLowerCase();
      const sku = row.sku.trim();
      const quantity = parseInteger(row.quantity.trim(), "quantity", rowNumber);
      const unitPrice = parseNumber(row.unit_price.trim(), "unit_price", rowNumber);
      const discountAmount =
        row.discount_amount.trim() === ""
          ? 0
          : parseNumber(row.discount_amount.trim(), "discount_amount", rowNumber);
      const shippingCost =
        row.shipping_cost.trim() === ""
          ? 0
          : parseNumber(row.shipping_cost.trim(), "shipping_cost", rowNumber);
      const shippingMethod = row.shipping_method.trim() || null;
      const trackingNumber = row.tracking_number.trim() || null;
      const customTerms = row.custom_terms.trim() || null;

      if (!orderNumber) throw new Error(`Row ${rowNumber}: order_number is required`);
      if (!customerName) throw new Error(`Row ${rowNumber}: customer_name is required`);
      if (!sku) throw new Error(`Row ${rowNumber}: sku is required`);
      if (quantity <= 0) throw new Error(`Row ${rowNumber}: quantity must be greater than 0`);
      if (unitPrice < 0) throw new Error(`Row ${rowNumber}: unit_price cannot be negative`);
      if (discountAmount < 0) throw new Error(`Row ${rowNumber}: discount_amount cannot be negative`);
      if (shippingCost < 0) throw new Error(`Row ${rowNumber}: shipping_cost cannot be negative`);
      if (!allowedStatuses.has(status)) {
        throw new Error(
          `Row ${rowNumber}: status must be one of open, in_transit, fulfilled, cancelled`,
        );
      }

      const existing = grouped.get(orderNumber);
      if (!existing) {
        grouped.set(orderNumber, {
          orderNumber,
          customerName,
          orderDate,
          status,
          shippingCost,
          shippingMethod,
          trackingNumber,
          customTerms,
          lines: [{ rowNumber, sku, quantity, unitPrice, discountAmount }],
        });
        continue;
      }

      if (existing.customerName !== customerName) {
        throw new Error(`Row ${rowNumber}: customer_name does not match earlier rows for ${orderNumber}`);
      }
      if (existing.orderDate !== orderDate) {
        throw new Error(`Row ${rowNumber}: order_date does not match earlier rows for ${orderNumber}`);
      }
      if (existing.status !== status) {
        throw new Error(`Row ${rowNumber}: status does not match earlier rows for ${orderNumber}`);
      }
      if (existing.shippingCost === 0 && shippingCost > 0) {
        existing.shippingCost = shippingCost;
      } else if (existing.shippingCost !== shippingCost && shippingCost !== 0) {
        throw new Error(`Row ${rowNumber}: shipping_cost does not match earlier rows for ${orderNumber}`);
      }
      if (existing.shippingMethod === null && shippingMethod !== null) {
        existing.shippingMethod = shippingMethod;
      } else if (existing.shippingMethod !== shippingMethod && shippingMethod !== null) {
        throw new Error(`Row ${rowNumber}: shipping_method does not match earlier rows for ${orderNumber}`);
      }
      if (existing.trackingNumber === null && trackingNumber !== null) {
        existing.trackingNumber = trackingNumber;
      } else if (existing.trackingNumber !== trackingNumber && trackingNumber !== null) {
        throw new Error(`Row ${rowNumber}: tracking_number does not match earlier rows for ${orderNumber}`);
      }
      if (existing.customTerms === null && customTerms !== null) {
        existing.customTerms = customTerms;
      } else if (existing.customTerms !== customTerms && customTerms !== null) {
        throw new Error(`Row ${rowNumber}: custom_terms does not match earlier rows for ${orderNumber}`);
      }

      existing.lines.push({ rowNumber, sku, quantity, unitPrice, discountAmount });
    } catch (error) {
      rowErrors.push(error instanceof Error ? error.message : `Row ${rowNumber}: import validation failed`);
    }
  }

  if (grouped.size === 0) {
    res.status(400).json({
      error: "Import validation failed",
      ...buildResponse({
        fileName: parsedRequest.data.fileName,
        importType: parsedRequest.data.importType,
        mode: parsedRequest.data.mode,
        importedOrders: 0,
        importedLines: 0,
        rowErrors,
      }),
    });
    return;
  }

  try {
    const orderNumbers = [...grouped.keys()];
    const customerNames = [
      ...new Set([...grouped.values()].map((order) => order.customerName)),
    ];
    const skus = [
      ...new Set(
        [...grouped.values()].flatMap((order) => order.lines.map((line) => line.sku)),
      ),
    ];

    const [existingOrders, customers, products] = await Promise.all([
      db
        .select({ orderNumber: ordersTable.orderNumber })
        .from(ordersTable)
        .where(inArray(ordersTable.orderNumber, orderNumbers)),
      db
        .select()
        .from(customersTable)
        .where(
          or(
            ...customerNames.flatMap((name) => [
              ilike(customersTable.name, name),
              ilike(customersTable.companyName, name),
            ]),
          ) ?? undefined,
        ),
      db.select().from(productsTable).where(inArray(productsTable.sku, skus)),
    ]);

    const duplicateOrders = new Set(existingOrders.map((order) => order.orderNumber));
    for (const orderNumber of duplicateOrders) {
      rowErrors.push(`Order ${orderNumber} already exists in Clarity`);
    }

    const customerMatchCounts = new Map<string, number>();
    const customerByLookup = new Map<string, typeof customersTable.$inferSelect>();
    for (const customer of customers) {
      const lookupValues = [customer.name, customer.companyName]
        .map((value) => value.trim().toLowerCase())
        .filter(
          (value, position, values) =>
            value.length > 0 && values.indexOf(value) === position,
        );
      for (const value of lookupValues) {
        customerMatchCounts.set(value, (customerMatchCounts.get(value) ?? 0) + 1);
        customerByLookup.set(value, customer);
      }
    }

    for (const [lookup, count] of customerMatchCounts) {
      if (count > 1) {
        customerByLookup.delete(lookup);
      }
    }

    const productBySku = new Map(
      products.map((product) => [product.sku.toLowerCase(), product]),
    );

    for (const order of grouped.values()) {
      const customer = customerByLookup.get(order.customerName.trim().toLowerCase());
      if (!customer) {
        rowErrors.push(
          `Order ${order.orderNumber}: customer "${order.customerName}" was not found or matched more than one account`,
        );
      }

      for (const line of order.lines) {
        if (!productBySku.has(line.sku.toLowerCase())) {
          rowErrors.push(
            `Row ${line.rowNumber}: SKU "${line.sku}" for ${order.orderNumber} was not found in the catalog`,
          );
        }
      }
    }

    if (rowErrors.length > 0) {
      res.status(400).json({
        error: "Import validation failed",
        ...buildResponse({
          fileName: parsedRequest.data.fileName,
          importType: parsedRequest.data.importType,
          mode: parsedRequest.data.mode,
          importedOrders: grouped.size,
          importedLines: rows.length,
          rowErrors,
        }),
      });
      return;
    }

    if (parsedRequest.data.mode === "validate") {
      res.json(
        buildResponse({
          fileName: parsedRequest.data.fileName,
          importType: parsedRequest.data.importType,
          mode: parsedRequest.data.mode,
          importedOrders: grouped.size,
          importedLines: rows.length,
        }),
      );
      return;
    }

    await db.transaction(async (tx) => {
      for (const order of grouped.values()) {
        const customer = customerByLookup.get(order.customerName.trim().toLowerCase())!;
        const subtotal = order.lines.reduce(
          (sum, line) => sum + line.unitPrice * line.quantity,
          0,
        );
        const discountTotal = order.lines.reduce(
          (sum, line) => sum + line.discountAmount * line.quantity,
          0,
        );
        const total = subtotal - discountTotal + order.shippingCost;

        const [createdOrder] = await tx
          .insert(ordersTable)
          .values({
            orderNumber: order.orderNumber,
            customerId: customer.id,
            repId: customer.repId ?? null,
            status: order.status,
            subtotal: subtotal.toFixed(2),
            discountTotal: discountTotal.toFixed(2),
            shippingCost: order.shippingCost.toFixed(2),
            total: total.toFixed(2),
            shippingMethod: order.shippingMethod,
            trackingNumber: order.trackingNumber,
            customTerms: order.customTerms,
            orderDate: new Date(`${order.orderDate}T12:00:00Z`),
          })
          .returning();

        await tx.insert(orderItemsTable).values(
          order.lines.map((line) => {
            const product = productBySku.get(line.sku.toLowerCase())!;
            const lineTotal = (line.unitPrice - line.discountAmount) * line.quantity;
            return {
              orderId: createdOrder.id,
              productId: product.id,
              quantity: line.quantity,
              unitPrice: line.unitPrice.toFixed(2),
              discountAmount: line.discountAmount.toFixed(2),
              lineTotal: lineTotal.toFixed(2),
              promotionName: null,
            };
          }),
        );
      }
    });

    res.status(201).json(
      buildResponse({
        fileName: parsedRequest.data.fileName,
        importType: parsedRequest.data.importType,
        mode: parsedRequest.data.mode,
        importedOrders: grouped.size,
        importedLines: rows.length,
      }),
    );
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Import failed" });
  }
});

router.post("/imports/customers", async (req, res): Promise<void> => {
  const parsedRequest = customerImportRequestSchema.safeParse(req.body);
  if (!parsedRequest.success) {
    res.status(400).json({ error: parsedRequest.error.issues[0]?.message ?? "Invalid import payload" });
    return;
  }

  let rows: ParsedCsvRow[];
  try {
    rows = parseCsv(parsedRequest.data.csvText);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to parse CSV" });
    return;
  }

  if (rows.length === 0) {
    res.status(400).json({ error: "The uploaded CSV does not contain any data rows" });
    return;
  }

  const headers = Object.keys(rows[0] ?? {});
  const missingHeaders = customerRequiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    res.status(400).json({ error: `Missing required columns: ${missingHeaders.join(", ")}` });
    return;
  }

  const repNames = Array.from(
    new Set(
      rows
        .map((row) => row.rep_name.trim())
        .filter((value) => value.length > 0),
    ),
  );

  const reps = repNames.length
    ? await db
        .select({ id: salesRepsTable.id, name: salesRepsTable.name })
        .from(salesRepsTable)
        .where(inArray(salesRepsTable.name, repNames))
    : [];
  const repIdByName = new Map(reps.map((rep) => [rep.name.trim().toLowerCase(), rep.id]));

  const existingCustomers = await db
    .select({ name: customersTable.name, companyName: customersTable.companyName })
    .from(customersTable);
  const existingLookup = new Set<string>();
  existingCustomers.forEach((customer) => {
    existingLookup.add(customer.name.trim().toLowerCase());
    existingLookup.add(customer.companyName.trim().toLowerCase());
  });

  const rowErrors: string[] = [];
  const drafts: CustomerDraft[] = [];
  const uploadNames = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;

    try {
      const companyName = row.company_name.trim();
      const primaryContactName = row.primary_contact_name.trim();
      const primaryContactTitle = row.primary_contact_title.trim() || null;
      const status = row.status.trim().toLowerCase();
      const paymentTerms = row.payment_terms.trim() || null;
      const creditLimit = parseOptionalNonNegativeNumber(row.credit_limit, "credit_limit", rowNumber);
      const customPricing = parseOptionalBoolean(row.custom_pricing, "custom_pricing", rowNumber);
      const repName = row.rep_name.trim();

      if (status && !allowedCustomerStatuses.has(status)) {
        throw new Error(`Row ${rowNumber}: status must be one of active, prospect, on_hold, inactive`);
      }

      const normalizedName = companyName.toLowerCase();
      if (normalizedName && uploadNames.has(normalizedName)) {
        throw new Error(`Row ${rowNumber}: duplicate company_name ${companyName} in upload`);
      }
      if (normalizedName && (existingLookup.has(normalizedName) || existingLookup.has(companyName.toLowerCase()))) {
        throw new Error(`Row ${rowNumber}: customer ${companyName} already exists`);
      }

      let repId: number | null = null;
      if (repName) {
        repId = repIdByName.get(repName.toLowerCase()) ?? null;
        if (repId === null) {
          throw new Error(`Row ${rowNumber}: rep_name "${repName}" does not match an existing sales rep`);
        }
      }

      if (normalizedName) {
        uploadNames.add(normalizedName);
      }
      drafts.push({
        companyName,
        primaryContactName,
        primaryContactTitle,
        email: parseOptionalEmail(row.email, rowNumber),
        phone: row.phone.trim() || null,
        billingAddress: row.billing_address.trim() || null,
        shippingAddress: row.shipping_address.trim() || null,
        status: status || undefined,
        paymentTerms,
        creditLimit: creditLimit === undefined ? undefined : creditLimit.toFixed(2),
        customPricing,
        repId,
        customerSinceDate: parseOptionalDate(row.customer_since_date, "customer_since_date", rowNumber),
      });
    } catch (error) {
      rowErrors.push(error instanceof Error ? error.message : `Row ${rowNumber}: import validation failed`);
    }
  }

  if (rowErrors.length > 0) {
    res.status(400).json({
      error: "Customer import validation failed",
      ...buildCustomerImportResponse({
        fileName: parsedRequest.data.fileName,
        mode: parsedRequest.data.mode,
        importedCustomers: 0,
        rowErrors,
      }),
    });
    return;
  }

  if (parsedRequest.data.mode === "validate") {
    res.json(
      buildCustomerImportResponse({
        fileName: parsedRequest.data.fileName,
        mode: "validate",
        importedCustomers: drafts.length,
      }),
    );
    return;
  }

  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const createdCustomers = await db
    .insert(customersTable)
    .values(
      drafts.map((draft) => ({
        name: draft.companyName,
        companyName: draft.companyName,
        primaryContactName: draft.primaryContactName,
        email: draft.email,
        phone: draft.phone,
        address: draft.billingAddress,
        billingAddress: draft.billingAddress,
        shippingAddress: draft.shippingAddress,
        status: draft.status,
        repId: draft.repId,
        creditLimit: draft.creditLimit,
        customPricing: draft.customPricing,
        customTerms: draft.paymentTerms,
        customerSinceDate: draft.customerSinceDate,
      })),
    )
    .returning({ id: customersTable.id, name: customersTable.name });

  await db.transaction(async (tx) => {
    const contactRows = createdCustomers
      .map((customer, index) => ({
        customerId: customer.id,
        name: drafts[index]!.primaryContactName,
        title: drafts[index]!.primaryContactTitle,
        email: drafts[index]!.email,
        phone: drafts[index]!.phone,
        isPrimary: true,
      }))
      .filter((contact) => contact.name.trim().length > 0);

    if (contactRows.length > 0) {
      await tx.insert(customerContactsTable).values(contactRows);
    }

    await Promise.all(
      createdCustomers.map((customer) =>
        logCustomerAction({
          customerId: customer.id,
          actionType: "customer_created",
          title: `Customer ${customer.name} imported`,
          createdBy: user.name,
        }),
      ),
    );
  });

  res.status(201).json(
    buildCustomerImportResponse({
      fileName: parsedRequest.data.fileName,
      mode: "commit",
      importedCustomers: createdCustomers.length,
    }),
  );
});

export default router;
