import { useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileWarning, Mail, Phone, Receipt, ShieldAlert, Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { fetchJson } from "@/lib/http";
import {
  recordInvoicePayment,
  updateInvoiceCollectionsStatus,
  updateInvoiceWorkflow,
  writeOffInvoice,
  type InvoiceWorkflowDetail,
} from "@/lib/operations";

type ActionMode = "payment" | "collections" | "edit" | "writeoff" | null;
const CLARITY_LOGO_URL = "https://claritydiagnostics.com/wp-content/uploads/2022/07/Asset-1@4x.png";

function StatusBadge({ label, tone }: { label: string; tone: "green" | "amber" | "rose" | "blue" | "slate" }) {
  const classes = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    slate: "border-slate-200 bg-slate-100 text-slate-700",
  };

  return <Badge variant="outline" className={classes[tone]}>{label}</Badge>;
}

function formatAddressLines(value?: string | null) {
  if (!value) return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const invoiceId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "ach",
    referenceNumber: "",
    notes: "",
  });
  const [collectionsForm, setCollectionsForm] = useState({
    collectionsStatus: "current",
    promisedPaymentDate: "",
    promiseNote: "",
    disputeReason: "",
    notes: "",
  });
  const [editForm, setEditForm] = useState({ dueDate: "", notes: "", externalRef: "" });
  const [writeOffForm, setWriteOffForm] = useState({ reason: "", notes: "" });

  const invoiceQuery = useQuery({
    queryKey: ["invoice-workflow", invoiceId],
    queryFn: () => fetchJson<InvoiceWorkflowDetail>(`/api/invoices/${invoiceId}`),
    enabled: Number.isFinite(invoiceId) && invoiceId > 0,
  });

  const invoice = invoiceQuery.data;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["invoice-workflow", invoiceId] }),
      queryClient.invalidateQueries({ queryKey: ["customer-crm", invoice?.customer.id] }),
      queryClient.invalidateQueries({ queryKey: ["report-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
    ]);
  };

  const paymentMutation = useMutation({
    mutationFn: () =>
      recordInvoicePayment(invoiceId, {
        amount: Number(paymentForm.amount),
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        referenceNumber: paymentForm.referenceNumber || null,
        notes: paymentForm.notes || null,
      }),
    onSuccess: async () => {
      await invalidate();
      setActionMode(null);
      setPaymentForm({
        amount: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: "ach",
        referenceNumber: "",
        notes: "",
      });
      toast({ title: "Payment recorded", description: "Balance and workflow status were updated." });
    },
    onError: (error: Error) => toast({ title: "Unable to record payment", description: error.message, variant: "destructive" }),
  });

  const collectionsMutation = useMutation({
    mutationFn: () =>
      updateInvoiceCollectionsStatus(invoiceId, {
        collectionsStatus: collectionsForm.collectionsStatus,
        promisedPaymentDate: collectionsForm.promisedPaymentDate || null,
        promiseNote: collectionsForm.promiseNote || null,
        disputeReason: collectionsForm.disputeReason || null,
        notes: collectionsForm.notes || null,
      }),
    onSuccess: async () => {
      await invalidate();
      setActionMode(null);
      toast({ title: "Collections status updated" });
    },
    onError: (error: Error) => toast({ title: "Unable to update collections status", description: error.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      updateInvoiceWorkflow(invoiceId, {
        dueDate: editForm.dueDate,
        notes: editForm.notes || null,
        externalRef: editForm.externalRef || null,
      }),
    onSuccess: async () => {
      await invalidate();
      setActionMode(null);
      toast({ title: "Invoice updated" });
    },
    onError: (error: Error) => toast({ title: "Unable to update invoice", description: error.message, variant: "destructive" }),
  });

  const writeOffMutation = useMutation({
    mutationFn: () => writeOffInvoice(invoiceId, writeOffForm),
    onSuccess: async () => {
      await invalidate();
      setActionMode(null);
      setWriteOffForm({ reason: "", notes: "" });
      toast({ title: "Invoice written off" });
    },
    onError: (error: Error) => toast({ title: "Unable to write off invoice", description: error.message, variant: "destructive" }),
  });

  if (invoiceQuery.isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-96 w-full rounded-3xl" />
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return <AppLayout><div /></AppLayout>;
  }

  const paymentTone =
    invoice.paymentStatus === "paid" ? "green" :
      invoice.paymentStatus === "partial" ? "amber" :
        invoice.paymentStatus === "written_off" ? "slate" :
          "rose";
  const collectionsTone =
    invoice.collectionsStatus === "current" ? "green" :
      invoice.collectionsStatus === "promised" || invoice.collectionsStatus === "in_transit" ? "blue" :
        invoice.collectionsStatus === "disputed" ? "amber" :
          "rose";
  const termsLabel = invoice.order?.effectiveTerms ?? invoice.customer.paymentTerms ?? "Net 30";
  const billingAddressLines = formatAddressLines(invoice.customer.billingAddress ?? invoice.customer.address);
  const shippingAddressLines = formatAddressLines(invoice.customer.shippingAddress ?? invoice.customer.address);
  const companyAddressLines = ["Brooklyn, NY"];
  const notesText = invoice.promiseNote || invoice.disputeReason || invoice.notes || "Thank you for your business.";
  const orderReference = invoice.order?.orderNumber ?? (invoice.externalRef || "Not provided");

  return (
    <AppLayout>
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0.35in;
          }

          html,
          body {
            background: #fff !important;
          }

          body * {
            visibility: hidden;
          }

          .invoice-print-root,
          .invoice-print-root * {
            visibility: visible;
          }

          .invoice-print-root {
            position: absolute;
            inset: 0;
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 0;
          }

          .invoice-print-card {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          .invoice-print-content {
            gap: 1.1rem !important;
            padding: 0 !important;
          }

          .invoice-print-content p,
          .invoice-print-content div,
          .invoice-print-content span,
          .invoice-print-content strong {
            line-height: 1.25 !important;
          }

          .invoice-print-content img {
            width: 180px !important;
            margin-bottom: 0.9rem !important;
          }

          .invoice-print-content h1 {
            font-size: 30px !important;
            line-height: 1 !important;
          }

          .invoice-print-section-tight {
            gap: 0.75rem !important;
            padding-bottom: 1rem !important;
            margin-bottom: 0 !important;
          }

          .invoice-print-box {
            padding: 0.8rem !important;
            border-radius: 12px !important;
          }

          .invoice-print-table-head {
            padding-top: 0.6rem !important;
            padding-bottom: 0.6rem !important;
            font-size: 10px !important;
          }

          .invoice-print-table-row {
            padding-top: 0.55rem !important;
            padding-bottom: 0.55rem !important;
            font-size: 11px !important;
          }

          .invoice-print-totals-row {
            padding-top: 0.5rem !important;
            padding-bottom: 0.5rem !important;
            font-size: 11px !important;
          }

          .invoice-print-grand-total {
            padding-top: 0.7rem !important;
            padding-bottom: 0.7rem !important;
            font-size: 14px !important;
          }

          .invoice-print-footer {
            padding-top: 0.75rem !important;
            font-size: 11px !important;
          }

          .invoice-print-notes {
            display: none !important;
          }

          .invoice-print-hide {
            display: none !important;
          }
        }
      `}</style>
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="invoice-print-hide flex items-center justify-between gap-4">
          <Link href={invoice.customer?.id ? `/customers/${invoice.customer.id}` : "/orders"} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back
          </Link>
          <Button variant="outline" onClick={() => window.print()} disabled={invoiceQuery.isLoading}>
            <Download className="size-4" /> Print / Save PDF
          </Button>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="invoice-print-root invoice-print-card overflow-hidden border-slate-200 bg-white shadow-[0_24px_70px_rgba(23,32,51,0.12)]">
            <div className="h-2.5 bg-[linear-gradient(90deg,#28466F,#78A7DE)]" />
            <CardContent className="invoice-print-content space-y-8 p-8 md:p-12">
              <div className="invoice-print-section-tight flex flex-col gap-8 border-b border-slate-200 pb-8 md:flex-row md:items-start md:justify-between">
                <div className="max-w-sm">
                  <img src={CLARITY_LOGO_URL} alt="Clarity Diagnostics" className="mb-6 h-auto w-[265px] max-w-full" />
                  <div className="space-y-1 text-sm leading-6 text-slate-500">
                    <p>{invoice.company.name}</p>
                    {companyAddressLines.map((line) => <p key={line}>{line}</p>)}
                    <p>{invoice.company.email}</p>
                    <p>{invoice.company.phone}</p>
                  </div>
                </div>

                <div className="text-left md:text-right">
                  <h1 className="text-4xl font-bold tracking-[-0.06em] text-[#28466F] md:text-[42px]">Invoice</h1>
                  <div className="mt-4 inline-flex items-center rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-700">
                    {termsLabel}
                  </div>
                  <div className="mt-5 grid grid-cols-[auto_auto] gap-x-5 gap-y-2 text-sm text-slate-500 md:justify-end">
                    <span>Invoice #</span><strong className="text-slate-900">{invoice.invoiceNumber}</strong>
                    <span>Invoice Date</span><strong className="text-slate-900">{formatDate(invoice.invoiceDate)}</strong>
                    <span>Due Date</span><strong className="text-slate-900">{formatDate(invoice.dueDate)}</strong>
                    <span>PO / Ref</span><strong className="text-slate-900">{orderReference}</strong>
                  </div>
                </div>
              </div>

              <div className="invoice-print-section-tight grid gap-4 md:grid-cols-2">
                <div className="invoice-print-box rounded-[18px] border border-slate-200 bg-slate-50 p-6">
                  <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.09em] text-[#78A7DE]">Bill To</p>
                  <p className="mb-2 text-lg font-extrabold text-[#28466F]">{invoice.customer.name}</p>
                  <div className="space-y-1 text-sm leading-6 text-slate-500">
                    {invoice.customer.repName ? <p>Attn: {invoice.customer.repName}</p> : null}
                    {billingAddressLines.length ? billingAddressLines.map((line) => <p key={line}>{line}</p>) : <p>Address not available</p>}
                    {invoice.customer.email ? <p>{invoice.customer.email}</p> : null}
                    {invoice.customer.phone ? <p>{invoice.customer.phone}</p> : null}
                  </div>
                </div>
                <div className="invoice-print-box rounded-[18px] border border-slate-200 bg-slate-50 p-6">
                  <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.09em] text-[#78A7DE]">Ship To</p>
                  <p className="mb-2 text-lg font-extrabold text-[#28466F]">{invoice.customer.name}</p>
                  <div className="space-y-1 text-sm leading-6 text-slate-500">
                    <p>Receiving Department</p>
                    {shippingAddressLines.length ? shippingAddressLines.map((line) => <p key={line}>{line}</p>) : <p>Address not available</p>}
                    <p>Ship Method: {invoice.order?.shippingMethod ?? "Not specified"}</p>
                    {invoice.order?.trackingNumber ? <p>Tracking: {invoice.order.trackingNumber}</p> : null}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                <div className="invoice-print-table-head grid grid-cols-[minmax(0,1.8fr)_90px_130px_140px] gap-4 border-b border-slate-200 bg-slate-50/60 px-4 py-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 md:px-6">
                  <div>Item</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Unit Price</div>
                  <div className="text-right">Amount</div>
                </div>
                <div className="divide-y divide-slate-200">
                  {invoice.lineItems.map((item) => (
                    <div key={`${item.productId}-${item.sku}`} className="invoice-print-table-row grid grid-cols-[minmax(0,1.8fr)_90px_130px_140px] gap-4 px-4 py-5 text-sm md:px-6">
                      <div>
                        <p className="font-semibold text-slate-950">{item.productName}</p>
                        <p className="mt-1 text-xs text-slate-500">SKU: {item.sku}</p>
                        {item.promotionName ? <p className="mt-2 text-xs font-medium text-emerald-700">{item.promotionName}</p> : null}
                      </div>
                      <div className="text-right font-mono text-slate-600">{item.quantity}</div>
                      <div className="text-right font-mono text-slate-600">{formatCurrency(item.unitPrice)}</div>
                      <div className="text-right font-mono text-slate-950">{formatCurrency(item.lineTotal)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-full max-w-[355px] overflow-hidden rounded-[18px] border border-slate-200">
                  <div className="invoice-print-totals-row flex items-center justify-between border-b border-slate-200 px-5 py-3 text-sm text-slate-500">
                    <span>Subtotal</span>
                    <strong className="text-slate-900">{formatCurrency(invoice.order?.subtotal ?? invoice.amount)}</strong>
                  </div>
                  <div className="invoice-print-totals-row flex items-center justify-between border-b border-slate-200 px-5 py-3 text-sm text-slate-500">
                    <span>Promotions</span>
                    <strong className="text-slate-900">-{formatCurrency(invoice.order?.discountTotal ?? 0)}</strong>
                  </div>
                  <div className="invoice-print-totals-row flex items-center justify-between border-b border-slate-200 px-5 py-3 text-sm text-slate-500">
                    <span>Shipping</span>
                    <strong className="text-slate-900">{formatCurrency(invoice.order?.shippingCost ?? 0)}</strong>
                  </div>
                  <div className="invoice-print-totals-row flex items-center justify-between border-b border-slate-200 px-5 py-3 text-sm text-slate-500">
                    <span>Paid to Date</span>
                    <strong className="text-slate-900">{formatCurrency(invoice.amountPaid)}</strong>
                  </div>
                  <div className="invoice-print-grand-total flex items-center justify-between bg-[#28466F] px-5 py-4 text-lg font-extrabold text-white">
                    <span>Balance Due</span>
                    <span>{formatCurrency(invoice.balanceDue)}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <div className="invoice-print-notes invoice-print-box rounded-[18px] border border-slate-200 bg-slate-50 p-6">
                  <p className="text-xs font-extrabold uppercase tracking-[0.09em] text-[#78A7DE]">Notes</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{notesText}</p>
                </div>
                <div className="invoice-print-hide rounded-[18px] border border-slate-200 bg-slate-50 p-6">
                  <p className="text-xs font-extrabold uppercase tracking-[0.09em] text-[#78A7DE]">Status</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge label={invoice.paymentStatus.replaceAll("_", " ")} tone={paymentTone} />
                    <StatusBadge label={invoice.collectionsStatus.replaceAll("_", " ")} tone={collectionsTone} />
                    <StatusBadge label={invoice.syncStatus.replaceAll("_", " ")} tone={invoice.syncStatus === "pending_sync" ? "amber" : "slate"} />
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-slate-600">
                    <p>Last payment: {invoice.lastPaymentDate ? formatDate(invoice.lastPaymentDate) : "Not recorded"}</p>
                    <p>{invoice.promisedPaymentDate ? `Promised payment: ${formatDate(invoice.promisedPaymentDate)}` : `Due: ${formatDate(invoice.dueDate)}`}</p>
                    {invoice.externalRef ? <p>External ref: {invoice.externalRef}</p> : null}
                  </div>
                </div>
              </div>

              <div className="invoice-print-footer flex flex-col gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-2"><Mail className="size-4" /> {invoice.company.email}</span>
                  <span className="inline-flex items-center gap-2"><Phone className="size-4" /> {invoice.company.phone}</span>
                </div>
                <div className="invoice-print-hide flex flex-wrap gap-2">
                  <Button onClick={() => {
                    setPaymentForm((current) => ({ ...current, amount: String(invoice.balanceDue || 0) }));
                    setActionMode("payment");
                  }}>
                    <Receipt className="mr-2 size-4" />
                    Record payment
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setCollectionsForm({
                      collectionsStatus: invoice.collectionsStatus,
                      promisedPaymentDate: invoice.promisedPaymentDate ?? "",
                      promiseNote: invoice.promiseNote ?? "",
                      disputeReason: invoice.disputeReason ?? "",
                      notes: "",
                    });
                    setActionMode("collections");
                  }}>
                    <ShieldAlert className="mr-2 size-4" />
                    Collections update
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setEditForm({
                      dueDate: invoice.dueDate,
                      notes: invoice.notes ?? "",
                      externalRef: invoice.externalRef ?? "",
                    });
                    setActionMode("edit");
                  }}>
                    Edit invoice
                  </Button>
                  <Button variant="destructive" onClick={() => setActionMode("writeoff")} disabled={invoice.balanceDue <= 0}>
                    <FileWarning className="mr-2 size-4" />
                    Write off
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="invoice-print-hide space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment history</CardTitle>
                <CardDescription>Every recorded payment against this invoice.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoice.payments.length ? invoice.payments.map((payment) => (
                  <div key={payment.id} className="rounded-2xl border px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(payment.paymentDate)} · {payment.paymentMethod || "Method not set"}</p>
                      </div>
                      <Wallet className="size-4 text-slate-400" />
                    </div>
                    {payment.referenceNumber ? <p className="mt-2 text-xs text-muted-foreground">Ref {payment.referenceNumber}</p> : null}
                    {payment.notes ? <p className="mt-2 text-sm text-muted-foreground">{payment.notes}</p> : null}
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">No payments recorded yet.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity timeline</CardTitle>
                <CardDescription>Audit trail of collections and finance actions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoice.activities.length ? invoice.activities.slice().reverse().map((activity) => (
                  <div key={activity.id} className="rounded-2xl border px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(activity.createdAt)}</p>
                    </div>
                    {activity.details ? <p className="mt-2 text-sm text-muted-foreground">{activity.details}</p> : null}
                    {(activity.previousValue || activity.nextValue) ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {activity.previousValue || "—"} to {activity.nextValue || "—"}
                      </p>
                    ) : null}
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">No workflow activity yet.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <Dialog open={actionMode === "payment"} onOpenChange={(open) => !open && setActionMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>Apply a payment and update the invoice balance immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <Input id="payment-amount" type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-date">Payment date</Label>
              <Input id="payment-date" type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Method</Label>
              <Select value={paymentForm.paymentMethod} onValueChange={(value) => setPaymentForm({ ...paymentForm, paymentMethod: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="wire">Wire</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Reference number" value={paymentForm.referenceNumber} onChange={(event) => setPaymentForm({ ...paymentForm, referenceNumber: event.target.value })} />
            <Textarea placeholder="Optional finance note" value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionMode(null)}>Cancel</Button>
            <Button disabled={paymentMutation.isPending || Number(paymentForm.amount) <= 0} onClick={() => paymentMutation.mutate()}>
              {paymentMutation.isPending ? "Recording..." : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionMode === "collections"} onOpenChange={(open) => !open && setActionMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collections update</DialogTitle>
            <DialogDescription>Track promise-to-pay, disputes, payment in transit, escalation, and related notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={collectionsForm.collectionsStatus} onValueChange={(value) => setCollectionsForm({ ...collectionsForm, collectionsStatus: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="promised">Promised</SelectItem>
                <SelectItem value="in_transit">Payment in transit</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="uncollectible">Uncollectible</SelectItem>
              </SelectContent>
            </Select>
            {(collectionsForm.collectionsStatus === "promised" || collectionsForm.collectionsStatus === "in_transit") ? (
              <>
                <Input type="date" value={collectionsForm.promisedPaymentDate} onChange={(event) => setCollectionsForm({ ...collectionsForm, promisedPaymentDate: event.target.value })} />
                <Textarea placeholder="Promise or transit note" value={collectionsForm.promiseNote} onChange={(event) => setCollectionsForm({ ...collectionsForm, promiseNote: event.target.value })} />
              </>
            ) : null}
            {collectionsForm.collectionsStatus === "disputed" ? (
              <Textarea placeholder="Dispute reason" value={collectionsForm.disputeReason} onChange={(event) => setCollectionsForm({ ...collectionsForm, disputeReason: event.target.value })} />
            ) : null}
            <Textarea placeholder="General collections note" value={collectionsForm.notes} onChange={(event) => setCollectionsForm({ ...collectionsForm, notes: event.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionMode(null)}>Cancel</Button>
            <Button disabled={collectionsMutation.isPending} onClick={() => collectionsMutation.mutate()}>
              {collectionsMutation.isPending ? "Saving..." : "Save collections update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionMode === "edit"} onOpenChange={(open) => !open && setActionMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit invoice controls</DialogTitle>
            <DialogDescription>Adjust due date, finance notes, or external reference.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="due-date">Due date</Label>
              <Input id="due-date" type="date" value={editForm.dueDate} onChange={(event) => setEditForm({ ...editForm, dueDate: event.target.value })} />
            </div>
            <Input placeholder="External reference" value={editForm.externalRef} onChange={(event) => setEditForm({ ...editForm, externalRef: event.target.value })} />
            <Textarea placeholder="Finance notes" value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionMode(null)}>Cancel</Button>
            <Button disabled={editMutation.isPending} onClick={() => editMutation.mutate()}>
              {editMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionMode === "writeoff"} onOpenChange={(open) => !open && setActionMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write off invoice</DialogTitle>
            <DialogDescription>This resolves the balance and marks the invoice as uncollectible in the current phase.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Reason for write-off" value={writeOffForm.reason} onChange={(event) => setWriteOffForm({ ...writeOffForm, reason: event.target.value })} />
            <Textarea placeholder="Optional internal note" value={writeOffForm.notes} onChange={(event) => setWriteOffForm({ ...writeOffForm, notes: event.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionMode(null)}>Cancel</Button>
            <Button variant="destructive" disabled={writeOffMutation.isPending || writeOffForm.reason.trim().length < 3} onClick={() => writeOffMutation.mutate()}>
              {writeOffMutation.isPending ? "Writing off..." : "Write off invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
