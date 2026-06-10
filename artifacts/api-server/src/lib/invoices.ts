import { invoicesTable } from "@workspace/db";

const DEFAULT_PAYMENT_TERMS = "Net 30";

export const COMPANY_INVOICE_PROFILE = {
  name: "Clarity Supply Co.",
  email: "billing@claritysupply.com",
  phone: "(800) 555-0142",
};

export function generateInvoiceNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `INV-${ts}`;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function getInvoiceTermsLabel(customTerms?: string | null): string {
  return customTerms?.trim() || DEFAULT_PAYMENT_TERMS;
}

export function normalizePaymentTerms(customTerms?: string | null): string | null {
  const normalized = customTerms?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function resolvePaymentTerms(orderCustomTerms?: string | null, customerPaymentTerms?: string | null): string {
  return getInvoiceTermsLabel(normalizePaymentTerms(orderCustomTerms) ?? normalizePaymentTerms(customerPaymentTerms));
}

export function getPaymentTermsNetDays(customTerms?: string | null): number {
  const terms = getInvoiceTermsLabel(customTerms);
  if (/due\s+on\s+receipt|upon\s+receipt|cod|c\.?o\.?d\.?/i.test(terms)) {
    return 0;
  }

  const match = terms.match(/net\s*(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 30;
}

export function getInvoiceDueDate(invoiceDate: Date, customTerms?: string | null): string {
  const netDays = getPaymentTermsNetDays(customTerms);
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + netDays);
  return formatDateOnly(dueDate);
}

export function formatInvoiceSummary(invoice: typeof invoicesTable.$inferSelect) {
  const amount = Number(invoice.amount);
  const amountPaid = Number(invoice.amountPaid);
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount,
    amountPaid,
    balanceDue: amount - amountPaid,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    isPaid: invoice.isPaid,
    paymentStatus: invoice.paymentStatus,
    collectionsStatus: invoice.collectionsStatus,
    lastPaymentDate: invoice.lastPaymentDate ?? null,
    promisedPaymentDate: invoice.promisedPaymentDate ?? null,
    promiseNote: invoice.promiseNote ?? null,
    disputeReason: invoice.disputeReason ?? null,
    writeOffReason: invoice.writeOffReason ?? null,
    externalRef: invoice.externalRef ?? null,
    syncStatus: invoice.syncStatus,
    syncError: invoice.syncError ?? null,
    lastSyncedAt: invoice.lastSyncedAt?.toISOString() ?? null,
    notes: invoice.notes ?? null,
    orderId: invoice.orderId ?? null,
  };
}
