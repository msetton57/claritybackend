import { Router, type IRouter } from "express";
import { db, invoicesTable, customersTable, ordersTable, orderItemsTable, productsTable, salesRepsTable, invoicePaymentsTable, invoiceActivitiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetOrderParams } from "@workspace/api-zod";
import { z } from "zod/v4";
import { COMPANY_INVOICE_PROFILE, formatInvoiceSummary, resolvePaymentTerms } from "../lib/invoices";
import { requireFinanceUser } from "../lib/auth";
import { addCustomerTimelineNote, assertCollectionsStatus, deriveCollectionsStatus, logCustomerAction, logInvoiceActivity, recordInvoicePayment, type CollectionsStatus } from "../lib/workflows";

const router: IRouter = Router();

const recordPaymentBody = z.object({
  amount: z.number().positive(),
  paymentDate: z.string().min(1),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const collectionsStatusBody = z.object({
  collectionsStatus: z.string().min(1),
  promisedPaymentDate: z.string().optional().nullable(),
  promiseNote: z.string().optional().nullable(),
  disputeReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateInvoiceBody = z.object({
  dueDate: z.string().optional(),
  notes: z.string().nullable().optional(),
  externalRef: z.string().nullable().optional(),
});

const writeOffBody = z.object({
  reason: z.string().trim().min(3),
  notes: z.string().optional().nullable(),
});

router.get("/invoices/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({
      invoice: invoicesTable,
      customer: customersTable,
      order: ordersTable,
      repName: salesRepsTable.name,
    })
    .from(invoicesTable)
    .innerJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .leftJoin(ordersTable, eq(invoicesTable.orderId, ordersTable.id))
    .leftJoin(salesRepsTable, eq(customersTable.repId, salesRepsTable.id))
    .where(eq(invoicesTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const lineItems = row.invoice.orderId && row.order
    ? await db
        .select({
          item: orderItemsTable,
          sku: productsTable.sku,
          productName: productsTable.name,
        })
        .from(orderItemsTable)
        .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
        .where(eq(orderItemsTable.orderId, row.order.id))
    : [];

  const [payments, activities] = await Promise.all([
    db
      .select()
      .from(invoicePaymentsTable)
      .where(eq(invoicePaymentsTable.invoiceId, row.invoice.id))
      .orderBy(invoicePaymentsTable.createdAt),
    db
      .select()
      .from(invoiceActivitiesTable)
      .where(eq(invoiceActivitiesTable.invoiceId, row.invoice.id))
      .orderBy(invoiceActivitiesTable.createdAt),
  ]);

  res.json({
    ...formatInvoiceSummary(row.invoice),
    customer: {
      id: row.customer.id,
      name: row.customer.name,
      email: row.customer.email ?? null,
      phone: row.customer.phone ?? null,
      address: row.customer.address ?? null,
      billingAddress: row.customer.billingAddress ?? row.customer.address ?? null,
      shippingAddress: row.customer.shippingAddress ?? row.customer.address ?? null,
      paymentTerms: row.customer.customTerms ?? "Net 30",
      repName: row.repName ?? null,
    },
    company: COMPANY_INVOICE_PROFILE,
    order: row.order
      ? {
          id: row.order.id,
          orderNumber: row.order.orderNumber,
          orderDate: row.order.orderDate.toISOString(),
          shippingMethod: row.order.shippingMethod ?? null,
          trackingNumber: row.order.trackingNumber ?? null,
          subtotal: Number(row.order.subtotal),
          discountTotal: Number(row.order.discountTotal),
          shippingCost: Number(row.order.shippingCost),
          total: Number(row.order.total),
          customTerms: row.order.customTerms ?? null,
          effectiveTerms: resolvePaymentTerms(row.order.customTerms, row.customer.customTerms),
        }
      : null,
    lineItems: lineItems.map((item) => ({
      productId: item.item.productId,
      sku: item.sku ?? "",
      productName: item.productName ?? `Product #${item.item.productId}`,
      quantity: item.item.quantity,
      unitPrice: Number(item.item.unitPrice),
      discountAmount: Number(item.item.discountAmount),
      lineTotal: Number(item.item.lineTotal),
      promotionName: item.item.promotionName ?? null,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod ?? null,
      referenceNumber: payment.referenceNumber ?? null,
      notes: payment.notes ?? null,
      createdBy: payment.createdBy,
      createdAt: payment.createdAt.toISOString(),
    })),
    activities: activities.map((activity) => ({
      id: activity.id,
      activityType: activity.activityType,
      title: activity.title,
      details: activity.details ?? null,
      previousValue: activity.previousValue ?? null,
      nextValue: activity.nextValue ?? null,
      createdBy: activity.createdBy,
      createdAt: activity.createdAt.toISOString(),
    })),
  });
});

router.post("/invoices/:id/payments", async (req, res): Promise<void> => {
  const user = await requireFinanceUser(req, res);
  if (!user) return;

  const params = GetOrderParams.safeParse(req.params);
  const parsed = recordPaymentBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const errorMessage = !params.success
      ? params.error.message
      : !parsed.success
        ? parsed.error.message
        : "Invalid request";
    res.status(400).json({ error: errorMessage });
    return;
  }

  try {
    await recordInvoicePayment({
      invoiceId: params.data.id,
      amount: parsed.data.amount,
      paymentDate: parsed.data.paymentDate,
      paymentMethod: parsed.data.paymentMethod ?? null,
      referenceNumber: parsed.data.referenceNumber ?? null,
      notes: parsed.data.notes ?? null,
      createdBy: user.name,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to record payment" });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  res.status(201).json(formatInvoiceSummary(invoice));
});

router.post("/invoices/:id/collections-status", async (req, res): Promise<void> => {
  const user = await requireFinanceUser(req, res);
  if (!user) return;

  const params = GetOrderParams.safeParse(req.params);
  const parsed = collectionsStatusBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const errorMessage = !params.success
      ? params.error.message
      : !parsed.success
        ? parsed.error.message
        : "Invalid request";
    res.status(400).json({ error: errorMessage });
    return;
  }

  let collectionsStatus: CollectionsStatus;
  try {
    assertCollectionsStatus(parsed.data.collectionsStatus);
    collectionsStatus = parsed.data.collectionsStatus;
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid collections status" });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  await db
    .update(invoicesTable)
    .set({
      collectionsStatus,
      promisedPaymentDate: parsed.data.promisedPaymentDate ?? null,
      promiseNote: parsed.data.promiseNote ?? parsed.data.notes ?? null,
      disputeReason: parsed.data.disputeReason ?? null,
      syncStatus: "pending_sync",
      syncError: null,
      lastSyncedAt: null,
    })
    .where(eq(invoicesTable.id, invoice.id));

  await logInvoiceActivity({
    invoiceId: invoice.id,
    activityType: "collections_status_changed",
    title: `Collections status updated to ${collectionsStatus.replaceAll("_", " ")}`,
    details: parsed.data.notes ?? parsed.data.promiseNote ?? parsed.data.disputeReason ?? null,
    previousValue: invoice.collectionsStatus,
    nextValue: collectionsStatus,
    createdBy: user.name,
  });
  await addCustomerTimelineNote({
    customerId: invoice.customerId,
    subject: `Collections status: ${collectionsStatus.replaceAll("_", " ")}`,
    details: parsed.data.notes ?? parsed.data.promiseNote ?? parsed.data.disputeReason ?? null,
    createdBy: user.name,
  });
  await logCustomerAction({
    customerId: invoice.customerId,
    actionType: "collections_status_changed",
    title: `Invoice ${invoice.invoiceNumber} marked ${collectionsStatus.replaceAll("_", " ")}`,
    details: parsed.data.notes ?? parsed.data.promiseNote ?? parsed.data.disputeReason ?? null,
    previousValue: invoice.collectionsStatus,
    nextValue: collectionsStatus,
    createdBy: user.name,
  });

  const [updated] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoice.id));
  res.json(formatInvoiceSummary(updated));
});

router.patch("/invoices/:id", async (req, res): Promise<void> => {
  const user = await requireFinanceUser(req, res);
  if (!user) return;

  const params = GetOrderParams.safeParse(req.params);
  const parsed = updateInvoiceBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const errorMessage = !params.success
      ? params.error.message
      : !parsed.success
        ? parsed.error.message
        : "Invalid request";
    res.status(400).json({ error: errorMessage });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const dueDate = parsed.data.dueDate ?? invoice.dueDate;
  const notes = parsed.data.notes !== undefined ? parsed.data.notes : invoice.notes;
  const externalRef = parsed.data.externalRef !== undefined ? parsed.data.externalRef : invoice.externalRef;
  const collectionsStatus = deriveCollectionsStatus({
    dueDate,
    balanceDue: Number(invoice.amount) - Number(invoice.amountPaid),
    currentStatus: invoice.collectionsStatus as CollectionsStatus,
  });

  await db
    .update(invoicesTable)
    .set({
      dueDate,
      notes,
      externalRef,
      collectionsStatus,
      syncStatus: "pending_sync",
      syncError: null,
      lastSyncedAt: null,
    })
    .where(eq(invoicesTable.id, invoice.id));

  if (parsed.data.dueDate && parsed.data.dueDate !== invoice.dueDate) {
    await logInvoiceActivity({
      invoiceId: invoice.id,
      activityType: "due_date_changed",
      title: "Due date updated",
      previousValue: invoice.dueDate,
      nextValue: parsed.data.dueDate,
      createdBy: user.name,
    });
  }

  if (parsed.data.notes !== undefined && parsed.data.notes !== invoice.notes) {
    await logInvoiceActivity({
      invoiceId: invoice.id,
      activityType: "note_updated",
      title: "Invoice notes updated",
      details: parsed.data.notes ?? null,
      previousValue: invoice.notes ?? null,
      nextValue: parsed.data.notes ?? null,
      createdBy: user.name,
    });
  }

  const [updated] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoice.id));
  res.json(formatInvoiceSummary(updated));
});

router.post("/invoices/:id/write-off", async (req, res): Promise<void> => {
  const user = await requireFinanceUser(req, res);
  if (!user) return;

  const params = GetOrderParams.safeParse(req.params);
  const parsed = writeOffBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const errorMessage = !params.success
      ? params.error.message
      : !parsed.success
        ? parsed.error.message
        : "Invalid request";
    res.status(400).json({ error: errorMessage });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  await db
    .update(invoicesTable)
    .set({
      amountPaid: invoice.amount,
      isPaid: true,
      paymentStatus: "written_off",
      collectionsStatus: "uncollectible",
      writeOffReason: parsed.data.reason,
      syncStatus: "pending_sync",
      syncError: null,
      lastSyncedAt: null,
    })
    .where(eq(invoicesTable.id, invoice.id));

  await logInvoiceActivity({
    invoiceId: invoice.id,
    activityType: "written_off",
    title: "Invoice written off",
    details: parsed.data.notes ?? parsed.data.reason,
    previousValue: String(Number(invoice.amount) - Number(invoice.amountPaid)),
    nextValue: "0.00",
    createdBy: user.name,
  });
  await logCustomerAction({
    customerId: invoice.customerId,
    actionType: "invoice_written_off",
    title: `Invoice ${invoice.invoiceNumber} written off`,
    details: parsed.data.reason,
    createdBy: user.name,
  });

  const [updated] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoice.id));
  res.json(formatInvoiceSummary(updated));
});

export default router;
