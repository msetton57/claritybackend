import { Router, type IRouter } from "express";
import {
  customerContactsTable,
  customersTable,
  db,
  invoicesTable,
  ordersTable,
  productsTable,
  supplyProcurementShipmentsTable,
  supplyPurchaseOrdersTable,
  supplyReceiptsTable,
  supplyVendorsTable,
  supplyVendorBillsTable,
  workspaceDocumentsTable,
} from "@workspace/db";
import { asc, eq, ilike, or } from "drizzle-orm";

const router: IRouter = Router();
const MAX_RESULTS_PER_GROUP = 6;

interface SearchResult {
  id: string;
  type:
    | "customer"
    | "contact"
    | "product"
    | "order"
    | "invoice"
    | "purchase_order"
    | "shipment"
    | "vendor"
    | "receipt"
    | "vendor_bill"
    | "workspace_document";
  title: string;
  subtitle: string | null;
  href: string;
  keywords: string[];
}

function buildKeywords(...values: Array<string | null | undefined>) {
  return values.filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}

router.get("/search", async (req, res): Promise<void> => {
  const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (rawQuery.length === 0) {
    res.json({ query: "", results: [] satisfies SearchResult[] });
    return;
  }

  const pattern = `%${rawQuery}%`;

  const [
    customers,
    contacts,
    products,
    orders,
    invoices,
    purchaseOrders,
    shipments,
    vendors,
    receipts,
    vendorBills,
    workspaceDocuments,
  ] = await Promise.all([
    db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        companyName: customersTable.companyName,
        primaryContactName: customersTable.primaryContactName,
        email: customersTable.email,
      })
      .from(customersTable)
      .where(
        or(
          ilike(customersTable.name, pattern),
          ilike(customersTable.companyName, pattern),
          ilike(customersTable.primaryContactName, pattern),
          ilike(customersTable.email, pattern),
        ),
      )
      .orderBy(asc(customersTable.name))
      .limit(MAX_RESULTS_PER_GROUP),
    db
      .select({
        id: customerContactsTable.id,
        customerId: customerContactsTable.customerId,
        name: customerContactsTable.name,
        title: customerContactsTable.title,
        email: customerContactsTable.email,
        phone: customerContactsTable.phone,
        customerName: customersTable.name,
      })
      .from(customerContactsTable)
      .innerJoin(
        customersTable,
        eq(customerContactsTable.customerId, customersTable.id),
      )
      .where(
        or(
          ilike(customerContactsTable.name, pattern),
          ilike(customerContactsTable.title, pattern),
          ilike(customerContactsTable.email, pattern),
          ilike(customerContactsTable.phone, pattern),
          ilike(customersTable.name, pattern),
        ),
      )
      .orderBy(asc(customerContactsTable.name))
      .limit(MAX_RESULTS_PER_GROUP),
    db
      .select({
        id: productsTable.id,
        sku: productsTable.sku,
        name: productsTable.name,
        category: productsTable.category,
      })
      .from(productsTable)
      .where(
        or(
          ilike(productsTable.sku, pattern),
          ilike(productsTable.name, pattern),
          ilike(productsTable.category, pattern),
        ),
      )
      .orderBy(asc(productsTable.name))
      .limit(MAX_RESULTS_PER_GROUP),
    db
      .select({
        id: ordersTable.id,
        orderNumber: ordersTable.orderNumber,
        status: ordersTable.status,
        customerName: customersTable.name,
      })
      .from(ordersTable)
      .innerJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
      .where(
        or(
          ilike(ordersTable.orderNumber, pattern),
          ilike(ordersTable.status, pattern),
          ilike(customersTable.name, pattern),
        ),
      )
      .orderBy(asc(ordersTable.orderNumber))
      .limit(MAX_RESULTS_PER_GROUP),
    db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        notes: invoicesTable.notes,
        customerName: customersTable.name,
      })
      .from(invoicesTable)
      .innerJoin(
        customersTable,
        eq(invoicesTable.customerId, customersTable.id),
      )
      .where(
        or(
          ilike(invoicesTable.invoiceNumber, pattern),
          ilike(invoicesTable.notes, pattern),
          ilike(customersTable.name, pattern),
        ),
      )
      .orderBy(asc(invoicesTable.invoiceNumber))
      .limit(MAX_RESULTS_PER_GROUP),
    db
      .select({
        id: supplyPurchaseOrdersTable.id,
        poNumber: supplyPurchaseOrdersTable.poNumber,
        status: supplyPurchaseOrdersTable.status,
        destination: supplyPurchaseOrdersTable.destination,
        vendorName: supplyVendorsTable.name,
      })
      .from(supplyPurchaseOrdersTable)
      .innerJoin(
        supplyVendorsTable,
        eq(supplyPurchaseOrdersTable.vendorId, supplyVendorsTable.id),
      )
      .where(
        or(
          ilike(supplyPurchaseOrdersTable.poNumber, pattern),
          ilike(supplyPurchaseOrdersTable.status, pattern),
          ilike(supplyPurchaseOrdersTable.destination, pattern),
          ilike(supplyVendorsTable.name, pattern),
        ),
      )
      .orderBy(asc(supplyPurchaseOrdersTable.poNumber))
      .limit(MAX_RESULTS_PER_GROUP),
    db
      .select({
        id: supplyProcurementShipmentsTable.id,
        shipmentNumber: supplyProcurementShipmentsTable.shipmentNumber,
        status: supplyProcurementShipmentsTable.status,
        trackingNumber: supplyProcurementShipmentsTable.trackingNumber,
        destination: supplyProcurementShipmentsTable.destination,
        poNumber: supplyPurchaseOrdersTable.poNumber,
        vendorName: supplyVendorsTable.name,
      })
      .from(supplyProcurementShipmentsTable)
      .innerJoin(
        supplyPurchaseOrdersTable,
        eq(
          supplyProcurementShipmentsTable.purchaseOrderId,
          supplyPurchaseOrdersTable.id,
        ),
      )
      .innerJoin(
        supplyVendorsTable,
        eq(supplyPurchaseOrdersTable.vendorId, supplyVendorsTable.id),
      )
      .where(
        or(
          ilike(supplyProcurementShipmentsTable.shipmentNumber, pattern),
          ilike(supplyProcurementShipmentsTable.trackingNumber, pattern),
          ilike(supplyProcurementShipmentsTable.destination, pattern),
          ilike(supplyProcurementShipmentsTable.status, pattern),
          ilike(supplyPurchaseOrdersTable.poNumber, pattern),
          ilike(supplyVendorsTable.name, pattern),
        ),
      )
      .orderBy(asc(supplyProcurementShipmentsTable.shipmentNumber))
      .limit(MAX_RESULTS_PER_GROUP),
    db
      .select({
        id: supplyVendorsTable.id,
        name: supplyVendorsTable.name,
        vendorCode: supplyVendorsTable.vendorCode,
        primaryContactName: supplyVendorsTable.primaryContactName,
        email: supplyVendorsTable.email,
      })
      .from(supplyVendorsTable)
      .where(
        or(
          ilike(supplyVendorsTable.name, pattern),
          ilike(supplyVendorsTable.vendorCode, pattern),
          ilike(supplyVendorsTable.primaryContactName, pattern),
          ilike(supplyVendorsTable.email, pattern),
        ),
      )
      .orderBy(asc(supplyVendorsTable.name))
      .limit(MAX_RESULTS_PER_GROUP),
    db
      .select({
        id: supplyReceiptsTable.id,
        receiptNumber: supplyReceiptsTable.receiptNumber,
        receivedBy: supplyReceiptsTable.receivedBy,
        status: supplyReceiptsTable.status,
      })
      .from(supplyReceiptsTable)
      .where(
        or(
          ilike(supplyReceiptsTable.receiptNumber, pattern),
          ilike(supplyReceiptsTable.receivedBy, pattern),
          ilike(supplyReceiptsTable.status, pattern),
        ),
      )
      .orderBy(asc(supplyReceiptsTable.receiptNumber))
      .limit(MAX_RESULTS_PER_GROUP),
    db
      .select({
        id: supplyVendorBillsTable.id,
        billNumber: supplyVendorBillsTable.billNumber,
        vendorInvoiceNumber: supplyVendorBillsTable.vendorInvoiceNumber,
        status: supplyVendorBillsTable.status,
      })
      .from(supplyVendorBillsTable)
      .where(
        or(
          ilike(supplyVendorBillsTable.billNumber, pattern),
          ilike(supplyVendorBillsTable.vendorInvoiceNumber, pattern),
          ilike(supplyVendorBillsTable.status, pattern),
        ),
      )
      .orderBy(asc(supplyVendorBillsTable.billNumber))
      .limit(MAX_RESULTS_PER_GROUP),
    db
      .select({
        id: workspaceDocumentsTable.id,
        folderId: workspaceDocumentsTable.folderId,
        title: workspaceDocumentsTable.title,
        category: workspaceDocumentsTable.category,
        description: workspaceDocumentsTable.description,
        fileName: workspaceDocumentsTable.fileName,
        uploadedBy: workspaceDocumentsTable.uploadedBy,
      })
      .from(workspaceDocumentsTable)
      .where(
        or(
          ilike(workspaceDocumentsTable.title, pattern),
          ilike(workspaceDocumentsTable.fileName, pattern),
          ilike(workspaceDocumentsTable.category, pattern),
          ilike(workspaceDocumentsTable.description, pattern),
          ilike(workspaceDocumentsTable.uploadedBy, pattern),
        ),
      )
      .orderBy(asc(workspaceDocumentsTable.title))
      .limit(MAX_RESULTS_PER_GROUP),
  ]);

  const results: SearchResult[] = [
    ...customers.map((row) => ({
      id: `customer-${row.id}`,
      type: "customer" as const,
      title: row.companyName || row.name,
      subtitle:
        [
          row.name !== row.companyName ? row.name : null,
          row.primaryContactName || null,
          row.email ?? null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      href: `/customers/${row.id}`,
      keywords: buildKeywords(
        row.name,
        row.companyName,
        row.primaryContactName,
        row.email,
      ),
    })),
    ...contacts.map((row) => ({
      id: `contact-${row.id}`,
      type: "contact" as const,
      title: row.name,
      subtitle:
        [
          row.customerName,
          row.title ?? null,
          row.email ?? null,
          row.phone ?? null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      href: `/customers/${row.customerId}`,
      keywords: buildKeywords(
        row.name,
        row.customerName,
        row.title,
        row.email,
        row.phone,
      ),
    })),
    ...products.map((row) => ({
      id: `product-${row.id}`,
      type: "product" as const,
      title: row.sku,
      subtitle: [row.name, row.category].filter(Boolean).join(" · ") || null,
      href: `/catalog?q=${encodeURIComponent(row.sku)}`,
      keywords: buildKeywords(row.sku, row.name, row.category),
    })),
    ...orders.map((row) => ({
      id: `order-${row.id}`,
      type: "order" as const,
      title: row.orderNumber,
      subtitle:
        [row.customerName, row.status].filter(Boolean).join(" · ") || null,
      href: `/orders/${row.id}`,
      keywords: buildKeywords(row.orderNumber, row.status, row.customerName),
    })),
    ...invoices.map((row) => ({
      id: `invoice-${row.id}`,
      type: "invoice" as const,
      title: row.invoiceNumber,
      subtitle:
        [row.customerName, row.notes ?? "Invoice"]
          .filter(Boolean)
          .join(" · ") || null,
      href: `/invoices/${row.id}`,
      keywords: buildKeywords(row.invoiceNumber, row.notes, row.customerName),
    })),
    ...purchaseOrders.map((row) => ({
      id: `purchase-order-${row.id}`,
      type: "purchase_order" as const,
      title: row.poNumber,
      subtitle:
        [row.vendorName, row.status, row.destination]
          .filter(Boolean)
          .join(" · ") || null,
      href: `/supply?workspace=purchasing&search=${encodeURIComponent(row.poNumber)}`,
      keywords: buildKeywords(
        row.poNumber,
        row.status,
        row.destination,
        row.vendorName,
      ),
    })),
    ...shipments.map((row) => ({
      id: `shipment-${row.id}`,
      type: "shipment" as const,
      title: row.shipmentNumber,
      subtitle:
        [
          row.vendorName,
          row.poNumber,
          row.status,
          row.trackingNumber ?? null,
          row.destination,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      href: `/supply?workspace=inbound&search=${encodeURIComponent(row.shipmentNumber)}`,
      keywords: buildKeywords(
        row.shipmentNumber,
        row.status,
        row.trackingNumber,
        row.destination,
        row.poNumber,
        row.vendorName,
      ),
    })),
    ...vendors.map((row) => ({
      id: `vendor-${row.id}`,
      type: "vendor" as const,
      title: row.name,
      subtitle:
        [row.vendorCode, row.primaryContactName, row.email]
          .filter(Boolean)
          .join(" · ") || null,
      href: `/supply?workspace=vendors&search=${encodeURIComponent(row.name)}`,
      keywords: buildKeywords(
        row.name,
        row.vendorCode,
        row.primaryContactName,
        row.email,
      ),
    })),
    ...receipts.map((row) => ({
      id: `receipt-${row.id}`,
      type: "receipt" as const,
      title: row.receiptNumber,
      subtitle:
        [row.status, row.receivedBy].filter(Boolean).join(" · ") || null,
      href: `/supply?workspace=bills&search=${encodeURIComponent(row.receiptNumber)}`,
      keywords: buildKeywords(row.receiptNumber, row.status, row.receivedBy),
    })),
    ...vendorBills.map((row) => ({
      id: `vendor-bill-${row.id}`,
      type: "vendor_bill" as const,
      title: row.billNumber,
      subtitle:
        [row.vendorInvoiceNumber, row.status].filter(Boolean).join(" · ") ||
        null,
      href: `/supply?workspace=bills&search=${encodeURIComponent(row.billNumber)}`,
      keywords: buildKeywords(
        row.billNumber,
        row.vendorInvoiceNumber,
        row.status,
      ),
    })),
    ...workspaceDocuments.map((row) => ({
      id: `workspace-document-${row.id}`,
      type: "workspace_document" as const,
      title: row.title,
      subtitle:
        [row.fileName, row.category, row.description ?? null, row.uploadedBy]
          .filter(Boolean)
          .join(" · ") || null,
      href: `/workspace?${new URLSearchParams({
        ...(row.folderId ? { folderId: String(row.folderId) } : {}),
        search: row.title,
        preview: String(row.id),
      }).toString()}`,
      keywords: buildKeywords(
        row.title,
        row.fileName,
        row.category,
        row.description,
        row.uploadedBy,
      ),
    })),
  ];

  res.json({ query: rawQuery, results });
});

export default router;
