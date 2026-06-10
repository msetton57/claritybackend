import {
  customerAccountActionsTable,
  customerActivitiesTable,
  db,
  invoiceActivitiesTable,
  invoicePaymentsTable,
  invoicesTable,
  orderActivitiesTable,
  ordersTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid" | "written_off";
export type CollectionsStatus =
  | "current"
  | "overdue"
  | "promised"
  | "in_transit"
  | "disputed"
  | "escalated"
  | "uncollectible";

const FINANCE_COLLECTIONS_STATUSES = new Set<CollectionsStatus>([
  "current",
  "overdue",
  "promised",
  "in_transit",
  "disputed",
  "escalated",
  "uncollectible",
]);

const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["open", "in_transit", "fulfilled", "cancelled"],
  in_transit: ["in_transit", "fulfilled"],
  fulfilled: ["fulfilled"],
  cancelled: ["cancelled"],
};

export function computePaymentStatus(amount: number, amountPaid: number, collectionsStatus?: CollectionsStatus): PaymentStatus {
  if (collectionsStatus === "uncollectible") return "written_off";
  if (amountPaid <= 0) return "unpaid";
  if (amountPaid < amount) return "partial";
  if (amountPaid === amount) return "paid";
  return "overpaid";
}

export function deriveCollectionsStatus(args: {
  dueDate: string;
  balanceDue: number;
  currentStatus: CollectionsStatus;
}): CollectionsStatus {
  const { dueDate, balanceDue, currentStatus } = args;
  if (balanceDue <= 0) return "current";
  if (["promised", "in_transit", "disputed", "escalated", "uncollectible"].includes(currentStatus)) {
    return currentStatus;
  }

  return new Date(`${dueDate}T23:59:59`).getTime() < Date.now() ? "overdue" : "current";
}

export function assertCollectionsStatus(value: string): asserts value is CollectionsStatus {
  if (!FINANCE_COLLECTIONS_STATUSES.has(value as CollectionsStatus)) {
    throw new Error("Invalid collections status");
  }
}

export function assertOrderStatusTransition(fromStatus: string, toStatus: string) {
  const allowed = ORDER_STATUS_TRANSITIONS[fromStatus] ?? [fromStatus];
  if (!allowed.includes(toStatus)) {
    throw new Error(`Cannot move an order from ${fromStatus} to ${toStatus}`);
  }
}

export async function logInvoiceActivity(input: {
  invoiceId: number;
  activityType: string;
  title: string;
  details?: string | null;
  previousValue?: string | null;
  nextValue?: string | null;
  createdBy?: string;
}) {
  await db.insert(invoiceActivitiesTable).values({
    invoiceId: input.invoiceId,
    activityType: input.activityType,
    title: input.title,
    details: input.details ?? null,
    previousValue: input.previousValue ?? null,
    nextValue: input.nextValue ?? null,
    createdBy: input.createdBy ?? "Clarity",
  });
}

export async function logOrderActivity(input: {
  orderId: number;
  activityType: string;
  title: string;
  details?: string | null;
  previousValue?: string | null;
  nextValue?: string | null;
  createdBy?: string;
}) {
  await db.insert(orderActivitiesTable).values({
    orderId: input.orderId,
    activityType: input.activityType,
    title: input.title,
    details: input.details ?? null,
    previousValue: input.previousValue ?? null,
    nextValue: input.nextValue ?? null,
    createdBy: input.createdBy ?? "Clarity",
  });
}

export async function logCustomerAction(input: {
  customerId: number;
  actionType: string;
  title: string;
  details?: string | null;
  previousValue?: string | null;
  nextValue?: string | null;
  createdBy?: string;
}) {
  await db.insert(customerAccountActionsTable).values({
    customerId: input.customerId,
    actionType: input.actionType,
    title: input.title,
    details: input.details ?? null,
    previousValue: input.previousValue ?? null,
    nextValue: input.nextValue ?? null,
    createdBy: input.createdBy ?? "Clarity",
  });
}

export async function addCustomerTimelineNote(input: {
  customerId: number;
  subject: string;
  details?: string | null;
  createdBy?: string;
}) {
  await db.insert(customerActivitiesTable).values({
    customerId: input.customerId,
    activityType: "note",
    subject: input.subject,
    details: input.details ?? null,
    createdBy: input.createdBy ?? "Clarity",
  });
}

export async function recordInvoicePayment(input: {
  invoiceId: number;
  amount: number;
  paymentDate: string;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  createdBy?: string;
}) {
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, input.invoiceId));
  if (!invoice) throw new Error("Invoice not found");

  const nextAmountPaid = Number(invoice.amountPaid) + input.amount;
  const amount = Number(invoice.amount);
  const paymentStatus = computePaymentStatus(amount, nextAmountPaid, invoice.collectionsStatus as CollectionsStatus);
  const balanceDue = amount - nextAmountPaid;
  const collectionsStatus = deriveCollectionsStatus({
    dueDate: invoice.dueDate,
    balanceDue,
    currentStatus: invoice.collectionsStatus as CollectionsStatus,
  });

  await db.transaction(async (tx) => {
    await tx.insert(invoicePaymentsTable).values({
      invoiceId: input.invoiceId,
      amount: input.amount.toFixed(2),
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod ?? null,
      referenceNumber: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? "Clarity",
    });

    await tx
      .update(invoicesTable)
      .set({
        amountPaid: nextAmountPaid.toFixed(2),
        paymentStatus,
        collectionsStatus,
        lastPaymentDate: input.paymentDate,
        isPaid: nextAmountPaid >= amount,
        syncStatus: "pending_sync",
        syncError: null,
        lastSyncedAt: null,
      })
      .where(eq(invoicesTable.id, input.invoiceId));
  });

  await logInvoiceActivity({
    invoiceId: input.invoiceId,
    activityType: "payment_recorded",
    title: `Payment recorded: $${input.amount.toFixed(2)}`,
    details: input.referenceNumber ? `Reference ${input.referenceNumber}` : input.notes ?? null,
    previousValue: Number(invoice.amountPaid).toFixed(2),
    nextValue: nextAmountPaid.toFixed(2),
    createdBy: input.createdBy,
  });
}

export async function syncOrderFinancialStatus(orderId: number) {
  const [invoice] = await db
    .select({
      paymentStatus: invoicesTable.paymentStatus,
      collectionsStatus: invoicesTable.collectionsStatus,
      balanceDue: sql<number>`${invoicesTable.amount} - ${invoicesTable.amountPaid}`,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.orderId, orderId))
    .limit(1);

  const invoiceStatus = !invoice
    ? "draft"
    : Number(invoice.balanceDue) <= 0
      ? "paid"
      : invoice.paymentStatus === "partial"
        ? "partial"
        : invoice.collectionsStatus === "overdue"
          ? "overdue"
          : "open";

  await db
    .update(ordersTable)
    .set({
      invoiceStatus,
      lastActionAt: new Date(),
    })
    .where(eq(ordersTable.id, orderId));
}
