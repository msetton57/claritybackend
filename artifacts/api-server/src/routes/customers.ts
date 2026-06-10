import { Router, type IRouter } from "express";
import {
  customerActivitiesTable,
  customerAccountActionsTable,
  customerContactsTable,
  customersTable,
  db,
  invoicesTable,
  orderItemsTable,
  ordersTable,
  productsTable,
  salesRepsTable,
} from "@workspace/db";
import { customerProductPricingTable } from "@workspace/db/schema";
import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { formatInvoiceSummary } from "../lib/invoices";
import { requireAuthenticatedUser, requireAdmin } from "../lib/auth";
import { logCustomerAction } from "../lib/workflows";

const router: IRouter = Router();

const customerStatusSchema = z.enum(["active", "prospect", "on_hold", "inactive"]);
const activityTypeSchema = z.enum(["note", "call", "email", "meeting", "task"]);

const nullableTextField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return value ?? null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const updateCustomerBodySchema = z.object({
  name: z.string().trim().min(1),
  companyName: z.string().trim().min(1),
  primaryContactName: z.string().trim().min(1),
  email: nullableTextField.refine((value) => value === null || z.email().safeParse(value).success, "Invalid email address"),
  phone: nullableTextField,
  billingAddress: nullableTextField,
  shippingAddress: nullableTextField,
  status: customerStatusSchema,
  paymentTerms: z.string().trim().min(1),
  creditLimit: z.number().nonnegative(),
  customPricing: z.boolean(),
  repId: z.number().int().nullable(),
  customerSinceDate: nullableTextField,
});

const createActivityBodySchema = z.object({
  activityType: activityTypeSchema,
  subject: z.string().trim().min(1),
  details: nullableTextField,
  outcome: nullableTextField,
  dueDate: nullableTextField,
  createdBy: nullableTextField,
  isCompleted: z.boolean().optional(),
});

const createCustomerBodySchema = updateCustomerBodySchema.extend({});

const customerContactBodySchema = z.object({
  name: z.string().trim().min(1),
  title: nullableTextField,
  email: nullableTextField,
  phone: nullableTextField,
  isPrimary: z.boolean().default(false),
});

const customerCustomPricingBodySchema = z.object({
  productId: z.number().int().positive(),
  customUnitPrice: z.number().nonnegative(),
  notes: nullableTextField,
});

const customerPricingImportBodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  csvText: z.string().min(1).max(2_000_000),
});

const bulkCustomerActionBodySchema = z.object({
  customerIds: z.array(z.number().int().positive()).min(1),
  action: z.enum(["assign_rep", "update_status", "create_task"]),
  repId: z.number().int().nullable().optional(),
  status: customerStatusSchema.optional(),
  taskTitle: z.string().trim().optional(),
  taskNotes: nullableTextField,
});

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function toDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function formatActivity(activity: typeof customerActivitiesTable.$inferSelect) {
  return {
    id: activity.id,
    activityType: activity.activityType,
    subject: activity.subject,
    details: activity.details ?? null,
    outcome: activity.outcome ?? null,
    dueDate: activity.dueDate ?? null,
    isCompleted: activity.isCompleted,
    createdBy: activity.createdBy,
    createdAt: activity.createdAt.toISOString(),
  };
}

function formatCustomerCustomPrice(
  row: typeof customerProductPricingTable.$inferSelect & {
    productName: string;
    sku: string;
    category: string;
    baseUnitPrice: string;
  },
) {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    sku: row.sku,
    category: row.category,
    baseUnitPrice: Number(row.baseUnitPrice),
    customUnitPrice: Number(row.customUnitPrice),
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ParsedPricingCsvRow = Record<string, string>;

function parseCsv(input: string): ParsedPricingCsvRow[] {
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
    const record: ParsedPricingCsvRow = {};
    headers.forEach((header, columnIndex) => {
      record[header] = row[columnIndex]?.trim() ?? "";
    });
    return record;
  });
}

function escapeCsvCell(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(normalized)) {
    return normalized;
  }
  return `"${normalized.replaceAll("\"", "\"\"")}"`;
}

function slugifyFileSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "customer";
}

function describePurchaseFrequency(orderDates: Date[]): string {
  if (orderDates.length === 0) {
    return "No orders yet";
  }

  if (orderDates.length === 1) {
    return "1 order on record";
  }

  const first = orderDates[0]!;
  const last = orderDates[orderDates.length - 1]!;
  const spanDays = Math.max(30, Math.round((last.getTime() - first.getTime()) / 86400000));
  const ordersPerMonth = orderDates.length / (spanDays / 30);

  if (ordersPerMonth >= 4) return `Weekly (${ordersPerMonth.toFixed(1)} orders/mo)`;
  if (ordersPerMonth >= 2) return `Bi-weekly (${ordersPerMonth.toFixed(1)} orders/mo)`;
  if (ordersPerMonth >= 1) return `Monthly (${ordersPerMonth.toFixed(1)} orders/mo)`;
  if (ordersPerMonth >= 0.4) return `Quarterly (${ordersPerMonth.toFixed(1)} orders/mo)`;
  return `Occasional (${ordersPerMonth.toFixed(1)} orders/mo)`;
}

router.get("/customers", async (req, res): Promise<void> => {
  const q = req.query.q as string | undefined;
  const repId = req.query.repId ? parseInt(req.query.repId as string, 10) : null;
  const status = typeof req.query.status === "string" ? req.query.status : null;

  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(customersTable.name, `%${q}%`),
        ilike(customersTable.companyName, `%${q}%`),
        ilike(customersTable.primaryContactName, `%${q}%`),
        ilike(customersTable.email, `%${q}%`),
      )!,
    );
  }
  if (repId) conditions.push(eq(customersTable.repId, repId));
  if (status && customerStatusSchema.safeParse(status).success) {
    conditions.push(eq(customersTable.status, status));
  }

  const rows = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      companyName: customersTable.companyName,
      primaryContact: customersTable.primaryContactName,
      email: customersTable.email,
      phone: customersTable.phone,
      lastOrderDate: sql<Date | null>`(
        SELECT MAX(${ordersTable.orderDate})
        FROM ${ordersTable}
        WHERE ${ordersTable.customerId} = ${customersTable.id}
          AND ${ordersTable.status} <> 'cancelled'
      )`,
      status: customersTable.status,
      repId: customersTable.repId,
      repName: salesRepsTable.name,
      paymentTerms: sql<string>`COALESCE(${customersTable.customTerms}, 'Net 30')`,
      currentArBalance: sql<number>`COALESCE((
        SELECT SUM(${invoicesTable.amount} - ${invoicesTable.amountPaid})
        FROM ${invoicesTable}
        WHERE ${invoicesTable.customerId} = ${customersTable.id}
          AND ${invoicesTable.isPaid} = false
      ), 0)::float`,
      openOrders: sql<number>`COALESCE((
        SELECT COUNT(*)
        FROM ${ordersTable}
        WHERE ${ordersTable.customerId} = ${customersTable.id}
          AND ${ordersTable.status} IN ('open', 'in_transit')
      ), 0)::int`,
      lifetimeRevenue: sql<number>`COALESCE((
        SELECT SUM(${ordersTable.total})
        FROM ${ordersTable}
        WHERE ${ordersTable.customerId} = ${customersTable.id}
          AND ${ordersTable.status} <> 'cancelled'
      ), 0)::float`,
    })
    .from(customersTable)
    .leftJoin(salesRepsTable, eq(customersTable.repId, salesRepsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(customersTable.name);

  res.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      companyName: row.companyName || row.name,
      primaryContact: row.primaryContact || "Unassigned",
      email: row.email ?? null,
      phone: row.phone ?? null,
      lastOrderDate:
        row.lastOrderDate instanceof Date
          ? row.lastOrderDate.toISOString()
          : typeof row.lastOrderDate === "string"
            ? new Date(row.lastOrderDate).toISOString()
            : null,
      paymentTerms: row.paymentTerms,
      currentArBalance: toNumber(row.currentArBalance),
      openOrders: toNumber(row.openOrders),
      lifetimeRevenue: toNumber(row.lifetimeRevenue),
      status: row.status,
      repId: row.repId ?? null,
      repName: row.repName ?? null,
    })),
  );
});

router.post("/customers", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const parsed = createCustomerBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db
    .insert(customersTable)
    .values({
      name: parsed.data.name,
      companyName: parsed.data.companyName,
      primaryContactName: parsed.data.primaryContactName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.billingAddress,
      billingAddress: parsed.data.billingAddress,
      shippingAddress: parsed.data.shippingAddress,
      status: parsed.data.status,
      repId: parsed.data.repId,
      creditLimit: parsed.data.creditLimit.toFixed(2),
      customPricing: parsed.data.customPricing,
      customTerms: parsed.data.paymentTerms,
      customerSinceDate: parsed.data.customerSinceDate,
    })
    .returning();

  await logCustomerAction({
    customerId: created.id,
    actionType: "customer_created",
    title: `Customer ${created.name} created`,
    createdBy: user.name,
  });

  res.status(201).json({ id: created.id });
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [customer] = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      email: customersTable.email,
      phone: customersTable.phone,
      address: customersTable.address,
      repId: customersTable.repId,
      repName: salesRepsTable.name,
      creditLimit: customersTable.creditLimit,
      customTerms: customersTable.customTerms,
    })
    .from(customersTable)
    .leftJoin(salesRepsTable, eq(customersTable.repId, salesRepsTable.id))
    .where(eq(customersTable.id, id));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const creditLimit = Number(customer.creditLimit);

  const arBalanceResult = await db
    .select({ balance: sql<number>`COALESCE(SUM(${invoicesTable.amount} - ${invoicesTable.amountPaid}), 0)::float` })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.customerId, id), eq(invoicesTable.isPaid, false)));

  const arBalance = Number(arBalanceResult[0]?.balance ?? 0);

  const pastDueResult = await db.execute(
    sql`SELECT COUNT(*) AS cnt FROM invoices WHERE customer_id = ${id} AND is_paid = false AND due_date::date < CURRENT_DATE`,
  );
  const isPastDue = parseInt((pastDueResult.rows[0] as Record<string, string>)?.cnt ?? "0", 10) > 0;

  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.customerId, id))
    .orderBy(sql`${invoicesTable.dueDate} ASC, ${invoicesTable.invoiceDate} DESC, ${invoicesTable.createdAt} DESC`);

  res.json({
    id: customer.id,
    name: customer.name,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
    address: customer.address ?? null,
    repId: customer.repId ?? null,
    repName: customer.repName ?? null,
    arBalance,
    creditLimit,
    availableCredit: Math.max(0, creditLimit - arBalance),
    isPastDue,
    customTerms: customer.customTerms ?? null,
    invoices: invoices.map((invoice) => formatInvoiceSummary(invoice)),
  });
});

router.get("/customers/:id/crm", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [customer] = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      companyName: customersTable.companyName,
      primaryContactName: customersTable.primaryContactName,
      email: customersTable.email,
      phone: customersTable.phone,
      billingAddress: customersTable.billingAddress,
      shippingAddress: customersTable.shippingAddress,
      status: customersTable.status,
      repId: customersTable.repId,
      repName: salesRepsTable.name,
      creditLimit: customersTable.creditLimit,
      customPricing: customersTable.customPricing,
      customTerms: customersTable.customTerms,
      customerSinceDate: customersTable.customerSinceDate,
      currentArBalance: sql<number>`COALESCE((
        SELECT SUM(${invoicesTable.amount} - ${invoicesTable.amountPaid})
        FROM ${invoicesTable}
        WHERE ${invoicesTable.customerId} = ${customersTable.id}
          AND ${invoicesTable.isPaid} = false
      ), 0)::float`,
      lifetimeRevenue: sql<number>`COALESCE((
        SELECT SUM(${ordersTable.total})
        FROM ${ordersTable}
        WHERE ${ordersTable.customerId} = ${customersTable.id}
          AND ${ordersTable.status} <> 'cancelled'
      ), 0)::float`,
      averageOrderValue: sql<number>`COALESCE((
        SELECT AVG(${ordersTable.total})
        FROM ${ordersTable}
        WHERE ${ordersTable.customerId} = ${customersTable.id}
          AND ${ordersTable.status} <> 'cancelled'
      ), 0)::float`,
      openOrders: sql<number>`COALESCE((
        SELECT COUNT(*)
        FROM ${ordersTable}
        WHERE ${ordersTable.customerId} = ${customersTable.id}
          AND ${ordersTable.status} IN ('open', 'in_transit')
      ), 0)::int`,
    })
    .from(customersTable)
    .leftJoin(salesRepsTable, eq(customersTable.repId, salesRepsTable.id))
    .where(eq(customersTable.id, id));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const contacts = await db
    .select()
    .from(customerContactsTable)
    .where(eq(customerContactsTable.customerId, id))
    .orderBy(desc(customerContactsTable.isPrimary), customerContactsTable.name);

  const activities = await db
    .select()
    .from(customerActivitiesTable)
    .where(eq(customerActivitiesTable.customerId, id))
    .orderBy(desc(customerActivitiesTable.createdAt));

  const recentOrders = await db
    .select({
      id: ordersTable.id,
      orderNumber: ordersTable.orderNumber,
      status: ordersTable.status,
      orderDate: ordersTable.orderDate,
      total: ordersTable.total,
    })
    .from(ordersTable)
    .where(eq(ordersTable.customerId, id))
    .orderBy(desc(ordersTable.orderDate));

  const orderStatuses = await db
    .select({
      status: ordersTable.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.customerId, id))
    .groupBy(ordersTable.status)
    .orderBy(ordersTable.status);

  const productInsights = await db
    .select({
      productId: productsTable.id,
      name: productsTable.name,
      category: productsTable.category,
      totalQuantity: sql<number>`SUM(${orderItemsTable.quantity})::int`,
      revenue: sql<number>`SUM(${orderItemsTable.lineTotal})::float`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .where(and(eq(ordersTable.customerId, id), ne(ordersTable.status, "cancelled")))
    .groupBy(productsTable.id, productsTable.name, productsTable.category)
    .orderBy(desc(sql`SUM(${orderItemsTable.quantity})`), productsTable.name)
    .limit(5);

  const orderDateRows = await db
    .select({
      orderDate: ordersTable.orderDate,
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.customerId, id), ne(ordersTable.status, "cancelled")))
    .orderBy(ordersTable.orderDate);

  const categoriesPurchased = [...new Set(productInsights.map((row) => row.category).filter(Boolean))];
  const orderDates = orderDateRows.map((row) => row.orderDate);
  const lastPurchaseDate = orderDates[orderDates.length - 1] ?? null;
  const formattedActivities = activities.map(formatActivity);
  const accountActions = await db
    .select()
    .from(customerAccountActionsTable)
    .where(eq(customerAccountActionsTable.customerId, id))
    .orderBy(desc(customerAccountActionsTable.createdAt))
    .limit(12);

  const timeline = [
    ...formattedActivities.map((activity) => ({
      id: `activity-${activity.id}`,
      type: activity.activityType,
      title: activity.subject,
      description: activity.details ?? activity.outcome ?? "",
      occurredAt: activity.createdAt,
    })),
    ...recentOrders.map((order) => ({
      id: `order-${order.id}`,
      type: "order",
      title: `${order.orderNumber} ${order.status.replace(/_/g, " ")}`,
      description: `Order total ${Number(order.total).toFixed(2)}`,
      occurredAt: order.orderDate.toISOString(),
    })),
    ...accountActions.map((action) => ({
      id: `account-action-${action.id}`,
      type: action.actionType,
      title: action.title,
      description: action.details ?? "",
      occurredAt: action.createdAt.toISOString(),
    })),
  ].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());

  const creditLimit = Number(customer.creditLimit);
  const currentArBalance = Number(customer.currentArBalance);

  res.json({
    id: customer.id,
    name: customer.name,
    companyName: customer.companyName || customer.name,
    primaryContact: customer.primaryContactName,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
    billingAddress: customer.billingAddress ?? null,
    shippingAddress: customer.shippingAddress ?? null,
    additionalContacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      title: contact.title ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      isPrimary: contact.isPrimary,
    })),
    paymentTerms: customer.customTerms ?? "Net 30",
    creditLimit,
    currentArBalance,
    availableCredit: Math.max(0, creditLimit - currentArBalance),
    customPricing: customer.customPricing,
    assignedSalesRep: customer.repName ?? "Unassigned",
    assignedSalesRepId: customer.repId ?? null,
    customerSinceDate: customer.customerSinceDate ?? null,
    status: customer.status,
    openOrders: Number(customer.openOrders),
    orderStatuses: orderStatuses.map((row) => ({
      status: row.status,
      count: Number(row.count),
    })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      orderDate: order.orderDate.toISOString(),
      total: Number(order.total),
    })),
    totalRevenue: Number(customer.lifetimeRevenue),
    averageOrderValue: Number(customer.averageOrderValue),
    mostPurchasedProducts: productInsights.map((row) => ({
      productId: row.productId,
      name: row.name,
      category: row.category,
      totalQuantity: Number(row.totalQuantity),
      revenue: Number(row.revenue),
    })),
    purchaseFrequency: describePurchaseFrequency(orderDates),
    lastPurchaseDate: toDateString(lastPurchaseDate),
    productCategoriesPurchased: categoriesPurchased,
    accountActions: accountActions.map((action) => ({
      id: action.id,
      actionType: action.actionType,
      title: action.title,
      details: action.details ?? null,
      previousValue: action.previousValue ?? null,
      nextValue: action.nextValue ?? null,
      createdBy: action.createdBy,
      createdAt: action.createdAt.toISOString(),
    })),
    internalNotes: formattedActivities.filter((activity) => activity.activityType === "note"),
    callLog: formattedActivities.filter((activity) => activity.activityType === "call"),
    emailLog: formattedActivities.filter((activity) => activity.activityType === "email"),
    meetingNotes: formattedActivities.filter((activity) => activity.activityType === "meeting"),
    followUpTasks: formattedActivities.filter((activity) => activity.activityType === "task"),
    customerTimeline: timeline,
  });
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = updateCustomerBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  await db
    .update(customersTable)
    .set({
      name: parsed.data.name,
      companyName: parsed.data.companyName,
      primaryContactName: parsed.data.primaryContactName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.billingAddress,
      billingAddress: parsed.data.billingAddress,
      shippingAddress: parsed.data.shippingAddress,
      status: parsed.data.status,
      repId: parsed.data.repId,
      creditLimit: parsed.data.creditLimit.toFixed(2),
      customPricing: parsed.data.customPricing,
      customTerms: parsed.data.paymentTerms,
      customerSinceDate: parsed.data.customerSinceDate,
    })
    .where(eq(customersTable.id, id));

  res.json({ ok: true });
});

router.post("/customers/:id/activities", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = createActivityBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const [created] = await db
    .insert(customerActivitiesTable)
    .values({
      customerId: id,
      activityType: parsed.data.activityType,
      subject: parsed.data.subject,
      details: parsed.data.details,
      outcome: parsed.data.outcome,
      dueDate: parsed.data.dueDate,
      isCompleted: parsed.data.isCompleted ?? false,
      createdBy: parsed.data.createdBy ?? "Sales Team",
    })
    .returning();

  res.status(201).json(formatActivity(created));
});

router.patch("/customers/:id/activities/:activityId", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const id = Number(req.params.id);
  const activityId = Number(req.params.activityId);
  const parsed = createActivityBodySchema.safeParse(req.body);

  if (!Number.isInteger(id) || !Number.isInteger(activityId) || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid activity id" : parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(customerActivitiesTable)
    .set({
      activityType: parsed.data.activityType,
      subject: parsed.data.subject,
      details: parsed.data.details,
      outcome: parsed.data.outcome,
      dueDate: parsed.data.dueDate,
      isCompleted: parsed.data.isCompleted ?? false,
      createdBy: parsed.data.createdBy ?? user.name,
    })
    .where(and(eq(customerActivitiesTable.id, activityId), eq(customerActivitiesTable.customerId, id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  await logCustomerAction({
    customerId: id,
    actionType: "activity_updated",
    title: `${updated.activityType} updated`,
    details: updated.subject,
    createdBy: user.name,
  });

  res.json(formatActivity(updated));
});

router.delete("/customers/:id/activities/:activityId", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const id = Number(req.params.id);
  const activityId = Number(req.params.activityId);
  const [deleted] = await db
    .delete(customerActivitiesTable)
    .where(and(eq(customerActivitiesTable.id, activityId), eq(customerActivitiesTable.customerId, id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  await logCustomerAction({
    customerId: id,
    actionType: "activity_deleted",
    title: `${deleted.activityType} removed`,
    details: deleted.subject,
    createdBy: user.name,
  });

  res.status(204).end();
});

router.get("/customers/:id/pricing", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }

  const pricingRows = await db
    .select({
      id: customerProductPricingTable.id,
      customerId: customerProductPricingTable.customerId,
      productId: customerProductPricingTable.productId,
      customUnitPrice: customerProductPricingTable.customUnitPrice,
      notes: customerProductPricingTable.notes,
      createdAt: customerProductPricingTable.createdAt,
      updatedAt: customerProductPricingTable.updatedAt,
      productName: productsTable.name,
      sku: productsTable.sku,
      category: productsTable.category,
      baseUnitPrice: productsTable.unitPrice,
    })
    .from(customerProductPricingTable)
    .innerJoin(productsTable, eq(customerProductPricingTable.productId, productsTable.id))
    .where(eq(customerProductPricingTable.customerId, id))
    .orderBy(productsTable.name);

  res.json(pricingRows.map(formatCustomerCustomPrice));
});

router.get("/customers/:id/pricing/export", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }

  const [customer] = await db
    .select({ id: customersTable.id, name: customersTable.name, companyName: customersTable.companyName })
    .from(customersTable)
    .where(eq(customersTable.id, id));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const rows = await db
    .select({
      productId: productsTable.id,
      sku: productsTable.sku,
      productName: productsTable.name,
      category: productsTable.category,
      baseUnitPrice: productsTable.unitPrice,
      customUnitPrice: customerProductPricingTable.customUnitPrice,
      notes: customerProductPricingTable.notes,
    })
    .from(productsTable)
    .leftJoin(
      customerProductPricingTable,
      and(
        eq(customerProductPricingTable.productId, productsTable.id),
        eq(customerProductPricingTable.customerId, id),
      ),
    )
    .orderBy(productsTable.name);

  const header = [
    "product_id",
    "sku",
    "product_name",
    "category",
    "catalog_unit_price",
    "custom_unit_price",
    "notes",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.productId,
        row.sku,
        row.productName,
        row.category,
        Number(row.baseUnitPrice).toFixed(2),
        row.customUnitPrice == null ? "" : Number(row.customUnitPrice).toFixed(2),
        row.notes ?? "",
      ]
        .map((value) => escapeCsvCell(value))
        .join(","),
    ),
  ];

  const customerLabel = slugifyFileSegment(customer.companyName || customer.name);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${customerLabel}-catalog-pricing.csv"`);
  res.send(lines.join("\n"));
});

router.post("/customers/:id/pricing/import", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const id = Number(req.params.id);
  const parsedRequest = customerPricingImportBodySchema.safeParse(req.body);
  if (!Number.isInteger(id) || !parsedRequest.success) {
    res.status(400).json({ error: parsedRequest.success ? "Invalid customer id" : parsedRequest.error.issues[0]?.message ?? "Invalid import payload" });
    return;
  }

  const [customer] = await db
    .select({ id: customersTable.id, name: customersTable.name, companyName: customersTable.companyName })
    .from(customersTable)
    .where(eq(customersTable.id, id));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  let rows: ParsedPricingCsvRow[];
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
  const requiredHeaders = ["product_id", "sku", "custom_unit_price"];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    res.status(400).json({ error: `Missing required columns: ${missingHeaders.join(", ")}` });
    return;
  }

  const productIds = new Set<number>();
  const skus = new Set<string>();
  const rowErrors: string[] = [];
  const importRows: Array<{
    rowNumber: number;
    productId: number;
    sku: string;
    customUnitPrice: number;
    notes: string | null;
  }> = [];
  const seenProductIds = new Set<number>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const customUnitPriceText = row.custom_unit_price?.trim() ?? "";
    if (!customUnitPriceText) {
      continue;
    }

    const productIdText = row.product_id?.trim() ?? "";
    const sku = row.sku?.trim() ?? "";
    const parsedProductId = Number(productIdText);
    const customUnitPrice = Number(customUnitPriceText);

    if (!Number.isFinite(customUnitPrice) || customUnitPrice < 0) {
      rowErrors.push(`Row ${rowNumber}: custom_unit_price must be a non-negative number`);
      continue;
    }

    if (productIdText && Number.isInteger(parsedProductId) && parsedProductId > 0) {
      productIds.add(parsedProductId);
    } else if (sku) {
      skus.add(sku);
    } else {
      rowErrors.push(`Row ${rowNumber}: include either a valid product_id or sku`);
      continue;
    }

    importRows.push({
      rowNumber,
      productId: Number.isInteger(parsedProductId) && parsedProductId > 0 ? parsedProductId : -1,
      sku,
      customUnitPrice,
      notes: row.notes?.trim() ? row.notes.trim() : null,
    });
  }

  if (rowErrors.length > 0) {
    res.status(400).json({ error: rowErrors.slice(0, 8).join(" | ") });
    return;
  }

  if (importRows.length === 0) {
    res.json({
      importedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: rows.length,
      fileName: parsedRequest.data.fileName,
      customerName: customer.companyName || customer.name,
    });
    return;
  }

  const products = await db
    .select({
      id: productsTable.id,
      sku: productsTable.sku,
      name: productsTable.name,
    })
    .from(productsTable)
    .where(
      productIds.size > 0 && skus.size > 0
        ? or(inArray(productsTable.id, [...productIds]), inArray(productsTable.sku, [...skus]))
        : productIds.size > 0
          ? inArray(productsTable.id, [...productIds])
          : inArray(productsTable.sku, [...skus]),
    );

  const productById = new Map(products.map((product) => [product.id, product]));
  const productBySku = new Map(products.map((product) => [product.sku, product]));

  const normalizedRows = importRows.map((row) => {
    const sku = row.sku;
    const product =
      row.productId > 0
        ? productById.get(row.productId) ?? (sku ? productBySku.get(sku) : undefined)
        : sku
          ? productBySku.get(sku)
          : undefined;

    if (!product) {
      rowErrors.push(`Row ${row.rowNumber}: product not found for ${sku || `id ${row.productId}`}`);
      return null;
    }

    if (seenProductIds.has(product.id)) {
      rowErrors.push(`Row ${row.rowNumber}: duplicate product ${product.sku} in upload`);
      return null;
    }
    seenProductIds.add(product.id);

    return {
      ...row,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  if (rowErrors.length > 0) {
    res.status(400).json({ error: rowErrors.slice(0, 8).join(" | ") });
    return;
  }

  const existingRows = await db
    .select({
      id: customerProductPricingTable.id,
      productId: customerProductPricingTable.productId,
    })
    .from(customerProductPricingTable)
    .where(
      and(
        eq(customerProductPricingTable.customerId, id),
        inArray(customerProductPricingTable.productId, normalizedRows.map((row) => row.productId)),
      ),
    );
  const existingByProductId = new Map(existingRows.map((row) => [row.productId, row]));

  let insertedCount = 0;
  let updatedCount = 0;

  await db.transaction(async (tx) => {
    for (const row of normalizedRows) {
      const existing = existingByProductId.get(row.productId);
      if (existing) {
        await tx
          .update(customerProductPricingTable)
          .set({
            customUnitPrice: row.customUnitPrice.toFixed(2),
            notes: row.notes,
            updatedAt: new Date(),
          })
          .where(eq(customerProductPricingTable.id, existing.id));
        updatedCount += 1;
        continue;
      }

      await tx.insert(customerProductPricingTable).values({
        customerId: id,
        productId: row.productId,
        customUnitPrice: row.customUnitPrice.toFixed(2),
        notes: row.notes,
      });
      insertedCount += 1;
    }

    await tx.update(customersTable).set({ customPricing: true }).where(eq(customersTable.id, id));
  });

  await logCustomerAction({
    customerId: id,
    actionType: "pricing_imported",
    title: `Custom pricing imported for ${normalizedRows.length} product${normalizedRows.length === 1 ? "" : "s"}`,
    details: parsedRequest.data.fileName,
    createdBy: user.name,
  });

  res.json({
    importedCount: normalizedRows.length,
    insertedCount,
    updatedCount,
    skippedCount: rows.length - normalizedRows.length,
    fileName: parsedRequest.data.fileName,
    customerName: customer.companyName || customer.name,
  });
});

router.put("/customers/:id/pricing", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const id = Number(req.params.id);
  const parsed = customerCustomPricingBodySchema.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid customer id" : parsed.error.message });
    return;
  }

  const [customer] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.id, id));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const [product] = await db.select({
    id: productsTable.id,
    name: productsTable.name,
    sku: productsTable.sku,
    category: productsTable.category,
    unitPrice: productsTable.unitPrice,
  }).from(productsTable).where(eq(productsTable.id, parsed.data.productId));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(customerProductPricingTable)
    .where(and(eq(customerProductPricingTable.customerId, id), eq(customerProductPricingTable.productId, parsed.data.productId)));

  let saved: typeof customerProductPricingTable.$inferSelect;

  if (existing) {
    [saved] = await db
      .update(customerProductPricingTable)
      .set({
        customUnitPrice: parsed.data.customUnitPrice.toFixed(2),
        notes: parsed.data.notes,
        updatedAt: new Date(),
      })
      .where(eq(customerProductPricingTable.id, existing.id))
      .returning();
  } else {
    [saved] = await db
      .insert(customerProductPricingTable)
      .values({
        customerId: id,
        productId: parsed.data.productId,
        customUnitPrice: parsed.data.customUnitPrice.toFixed(2),
        notes: parsed.data.notes,
      })
      .returning();
  }

  await db.update(customersTable).set({ customPricing: true }).where(eq(customersTable.id, id));

  await logCustomerAction({
    customerId: id,
    actionType: existing ? "pricing_updated" : "pricing_added",
    title: existing ? `Custom pricing updated for ${product.name}` : `Custom pricing added for ${product.name}`,
    details: `${product.sku} now priced at $${parsed.data.customUnitPrice.toFixed(2)}`,
    createdBy: user.name,
  });

  res.json(formatCustomerCustomPrice({
    ...saved,
    productName: product.name,
    sku: product.sku,
    category: product.category,
    baseUnitPrice: product.unitPrice,
  }));
});

router.delete("/customers/:id/pricing/:productId", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const id = Number(req.params.id);
  const productId = Number(req.params.productId);

  const [deleted] = await db
    .delete(customerProductPricingTable)
    .where(and(eq(customerProductPricingTable.customerId, id), eq(customerProductPricingTable.productId, productId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Custom price not found" });
    return;
  }

  const [product] = await db.select({ name: productsTable.name, sku: productsTable.sku }).from(productsTable).where(eq(productsTable.id, productId));
  const remaining = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(customerProductPricingTable)
    .where(eq(customerProductPricingTable.customerId, id));

  await db
    .update(customersTable)
    .set({ customPricing: Number(remaining[0]?.count ?? 0) > 0 })
    .where(eq(customersTable.id, id));

  await logCustomerAction({
    customerId: id,
    actionType: "pricing_deleted",
    title: `Custom pricing removed for ${product?.name ?? `product ${productId}`}`,
    details: product?.sku ?? null,
    createdBy: user.name,
  });

  res.status(204).end();
});

router.post("/customers/:id/contacts", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const id = Number(req.params.id);
  const parsed = customerContactBodySchema.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid customer id" : parsed.error.message });
    return;
  }

  const [customer] = await db.select({ id: customersTable.id, name: customersTable.name }).from(customersTable).where(eq(customersTable.id, id));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  if (parsed.data.isPrimary) {
    await db.update(customerContactsTable).set({ isPrimary: false }).where(eq(customerContactsTable.customerId, id));
  }

  const [contact] = await db.insert(customerContactsTable).values({
    customerId: id,
    name: parsed.data.name,
    title: parsed.data.title,
    email: parsed.data.email,
    phone: parsed.data.phone,
    isPrimary: parsed.data.isPrimary,
  }).returning();

  await logCustomerAction({
    customerId: id,
    actionType: "contact_added",
    title: `Contact ${contact.name} added`,
    createdBy: user.name,
  });

  res.status(201).json(contact);
});

router.patch("/customers/:id/contacts/:contactId", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const id = Number(req.params.id);
  const contactId = Number(req.params.contactId);
  const parsed = customerContactBodySchema.safeParse(req.body);
  if (!Number.isInteger(id) || !Number.isInteger(contactId) || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Invalid contact id" : parsed.error.message });
    return;
  }

  if (parsed.data.isPrimary) {
    await db.update(customerContactsTable).set({ isPrimary: false }).where(eq(customerContactsTable.customerId, id));
  }

  const [updated] = await db.update(customerContactsTable).set({
    name: parsed.data.name,
    title: parsed.data.title,
    email: parsed.data.email,
    phone: parsed.data.phone,
    isPrimary: parsed.data.isPrimary,
  }).where(and(eq(customerContactsTable.id, contactId), eq(customerContactsTable.customerId, id))).returning();

  if (!updated) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  await logCustomerAction({
    customerId: id,
    actionType: "contact_updated",
    title: `Contact ${updated.name} updated`,
    createdBy: user.name,
  });

  res.json(updated);
});

router.delete("/customers/:id/contacts/:contactId", async (req, res): Promise<void> => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const id = Number(req.params.id);
  const contactId = Number(req.params.contactId);
  const [deleted] = await db.delete(customerContactsTable).where(and(eq(customerContactsTable.id, contactId), eq(customerContactsTable.customerId, id))).returning();
  if (!deleted) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  await logCustomerAction({
    customerId: id,
    actionType: "contact_deleted",
    title: `Contact ${deleted.name} removed`,
    createdBy: user.name,
  });
  res.status(204).end();
});

router.post("/customers/bulk-actions", async (req, res): Promise<void> => {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const parsed = bulkCustomerActionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerIds, action } = parsed.data;
  if (action === "assign_rep" && parsed.data.repId === undefined) {
    res.status(400).json({ error: "repId is required for rep assignment" });
    return;
  }
  if (action === "update_status" && !parsed.data.status) {
    res.status(400).json({ error: "status is required for status updates" });
    return;
  }

  if (action === "assign_rep") {
    await db.update(customersTable).set({ repId: parsed.data.repId ?? null }).where(inArray(customersTable.id, customerIds));
  } else if (action === "update_status") {
    await db.update(customersTable).set({ status: parsed.data.status! }).where(inArray(customersTable.id, customerIds));
  } else {
    for (const customerId of customerIds) {
      await db.insert(customerActivitiesTable).values({
        customerId,
        activityType: "task",
        subject: parsed.data.taskTitle?.trim() || "Follow up",
        details: parsed.data.taskNotes ?? null,
        createdBy: user.name,
      });
    }
  }

  for (const customerId of customerIds) {
    await logCustomerAction({
      customerId,
      actionType: `bulk_${action}`,
      title:
        action === "assign_rep"
          ? "Sales rep reassigned"
          : action === "update_status"
            ? `Status set to ${parsed.data.status}`
            : "Follow-up task created",
      details: parsed.data.taskNotes ?? null,
      createdBy: user.name,
    });
  }

  res.json({ ok: true, count: customerIds.length });
});

export default router;
