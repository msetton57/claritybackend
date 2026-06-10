import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Building2, Receipt, Search, ShieldAlert, Users, Wallet } from "lucide-react";
import { useGetArAging } from "@workspace/api-client-react";
import type { ArAgingRow } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { toArray } from "@/lib/array";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/format";
import { fetchJson } from "@/lib/http";
import { recordInvoicePayment, updateInvoiceCollectionsStatus } from "@/lib/operations";
import { cn } from "@/lib/utils";

type WorkspaceView = "priority" | "past-due" | "all" | "promised" | "disputes";
type RepFilter = "all" | "unassigned" | string;
type SortKey = "risk" | "total" | "pastDue" | "customer";
type Severity = "current" | "watch" | "priority" | "critical";

type DecoratedArRow = ArAgingRow & {
  pastDueTotal: number;
  pastDueRatio: number;
  severity: Severity;
  oldestBucketLabel: "Current" | "1-30" | "31-60" | "61-90" | "90+";
  actionLabel: string;
  riskScore: number;
};

type CustomerArDetail = {
  id: number;
  name: string;
  arBalance: number;
  availableCredit: number;
  isPastDue: boolean;
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    amount: number;
    amountPaid: number;
    balanceDue: number;
    invoiceDate: string;
    dueDate: string;
    paymentStatus: string;
    collectionsStatus: string;
    promisedPaymentDate: string | null;
    promiseNote: string | null;
    disputeReason: string | null;
  }>;
};

function getOldestBucketLabel(row: ArAgingRow): DecoratedArRow["oldestBucketLabel"] {
  if (row.days90plus > 0) return "90+";
  if (row.days90 > 0) return "61-90";
  if (row.days60 > 0) return "31-60";
  if (row.days30 > 0) return "1-30";
  return "Current";
}

function getSeverity(row: ArAgingRow): Severity {
  if (row.days90plus > 0 || row.days90 > 0) return "critical";
  if (row.days60 > 0) return "priority";
  if (row.days30 > 0) return "watch";
  return "current";
}

function decorateRows(rows: ArAgingRow[]) {
  return rows.map<DecoratedArRow>((row) => {
    const pastDueTotal = row.days30 + row.days60 + row.days90 + row.days90plus;
    const pastDueRatio = row.total > 0 ? pastDueTotal / row.total : 0;
    const severity = getSeverity(row);
    const riskScore =
      row.days30 * 0.8 +
      row.days60 * 1.4 +
      row.days90 * 1.9 +
      row.days90plus * 2.5 +
      row.total * 0.08;

    return {
      ...row,
      pastDueTotal,
      pastDueRatio,
      severity,
      oldestBucketLabel: getOldestBucketLabel(row),
      actionLabel:
        severity === "critical"
          ? "Escalate and contact now"
          : severity === "priority"
            ? "Call and confirm payment date"
            : severity === "watch"
              ? "Update collections posture"
              : "Healthy account",
      riskScore,
    };
  });
}

function severityBadgeClass(severity: Severity) {
  switch (severity) {
    case "critical":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "priority":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "watch":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

export default function ArAging() {
  const [location] = useLocation();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<WorkspaceView>("priority");
  const [repFilter, setRepFilter] = useState<RepFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentDate: new Date().toISOString().slice(0, 10), referenceNumber: "", notes: "" });
  const [collectionsForm, setCollectionsForm] = useState({ collectionsStatus: "current", promisedPaymentDate: "", promiseNote: "", disputeReason: "", notes: "" });
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: agingRows, isLoading } = useGetArAging({});
  const rows = useMemo(() => decorateRows(toArray(agingRows)), [agingRows]);

  const customerDetailQuery = useQuery({
    queryKey: ["ar-customer", selectedCustomerId],
    queryFn: () => fetchJson<CustomerArDetail>(`/api/customers/${selectedCustomerId}`),
    enabled: selectedCustomerId !== null,
  });

  const reps = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.repName?.trim()).filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => {
        const matchesSearch =
          deferredSearch.length === 0 ||
          row.customerName.toLowerCase().includes(deferredSearch) ||
          (row.repName ?? "").toLowerCase().includes(deferredSearch);
        const matchesRep = repFilter === "all" || (repFilter === "unassigned" ? !row.repName : row.repName === repFilter);
        const matchesView =
          view === "all" ||
          (view === "past-due" ? row.pastDueTotal > 0 : view === "priority" ? row.severity === "critical" || row.severity === "priority" : true);
        return matchesSearch && matchesRep && matchesView;
      })
      .sort((left, right) => {
        switch (sortKey) {
          case "customer": return left.customerName.localeCompare(right.customerName);
          case "total": return right.total - left.total;
          case "pastDue": return right.pastDueTotal - left.pastDueTotal;
          default: return right.riskScore - left.riskScore;
        }
      });
  }, [deferredSearch, repFilter, rows, sortKey, view]);

  const queueRows = filteredRows.slice(0, 5);
  const metrics = filteredRows.reduce((acc, row) => {
    acc.total += row.total;
    acc.pastDue += row.pastDueTotal;
    acc.accounts += 1;
    return acc;
  }, { total: 0, pastDue: 0, accounts: 0 });

  const selectedInvoice = customerDetailQuery.data?.invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const customerId = Number(new URLSearchParams(window.location.search).get("customerId"));
    if (Number.isFinite(customerId) && customerId > 0) {
      setSelectedCustomerId((current) => current ?? customerId);
    }
  }, [location]);

  const paymentMutation = useMutation({
    mutationFn: () => recordInvoicePayment(selectedInvoiceId!, {
      amount: Number(paymentForm.amount),
      paymentDate: paymentForm.paymentDate,
      referenceNumber: paymentForm.referenceNumber || null,
      notes: paymentForm.notes || null,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ar-customer", selectedCustomerId] }),
        queryClient.invalidateQueries({ queryKey: ["/ar/aging"] }),
      ]);
      setPaymentForm({ amount: "", paymentDate: new Date().toISOString().slice(0, 10), referenceNumber: "", notes: "" });
      toast({ title: "Payment recorded" });
    },
    onError: (error: Error) => toast({ title: "Unable to record payment", description: error.message, variant: "destructive" }),
  });

  const collectionsMutation = useMutation({
    mutationFn: () => updateInvoiceCollectionsStatus(selectedInvoiceId!, {
      collectionsStatus: collectionsForm.collectionsStatus,
      promisedPaymentDate: collectionsForm.promisedPaymentDate || null,
      promiseNote: collectionsForm.promiseNote || null,
      disputeReason: collectionsForm.disputeReason || null,
      notes: collectionsForm.notes || null,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ar-customer", selectedCustomerId] }),
        queryClient.invalidateQueries({ queryKey: ["/ar/aging"] }),
      ]);
      toast({ title: "Collections status updated" });
    },
    onError: (error: Error) => toast({ title: "Unable to update collections status", description: error.message, variant: "destructive" }),
  });

  return (
    <AppLayout fluid>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="relative overflow-hidden rounded-[30px] bg-[#3b1020] px-6 py-7 text-white shadow-[0_22px_60px_-30px_rgba(59,16,32,0.85)] md:px-8">
          <div className="relative flex flex-col gap-5">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.24em] text-white/55">Collections workspace</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Accounts Receivable</h1>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Prioritize accounts, update collections posture, and record payments without leaving the queue.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">Visible exposure</p>
                <p className="mt-3 text-2xl font-semibold">{formatCompactCurrency(metrics.total)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">Past due</p>
                <p className="mt-3 text-2xl font-semibold">{formatCompactCurrency(metrics.pastDue)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">Accounts</p>
                <p className="mt-3 text-2xl font-semibold">{metrics.accounts}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_1.5fr]">
          <Card className="border-0 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-sm font-medium text-rose-700">
                <ShieldAlert className="size-4" />
                Attention queue
              </div>
              <CardTitle className="text-2xl">Start with the riskiest accounts</CardTitle>
              <CardDescription>Open the workspace drawer from here to update invoice status or record payment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 w-full rounded-2xl" />)
              ) : queueRows.length > 0 ? (
                queueRows.map((row) => (
                  <div key={row.customerId} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-lg font-semibold">{row.customerName}</p>
                          <Badge variant="outline" className={severityBadgeClass(row.severity)}>{row.severity}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>{row.repName || "Unassigned rep"}</span>
                          <span>Oldest bucket {row.oldestBucketLabel}</span>
                          <span>{Math.round(row.pastDueRatio * 100)}% past due</span>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-mono text-lg font-semibold">{formatCurrency(row.total)}</p>
                        <p className="text-sm text-rose-700">{formatCurrency(row.pastDueTotal)} past due</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setSelectedCustomerId(row.customerId)}>Open workspace</Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/customers/${row.customerId}`}>Open account <ArrowRight className="ml-2 size-4" /></Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty className="border border-dashed">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><AlertTriangle className="size-5" /></EmptyMedia>
                    <EmptyTitle>No accounts match this queue</EmptyTitle>
                    <EmptyDescription>Try widening the workspace or clearing a filter.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">Receivables view</CardTitle>
              <CardDescription>Filter by ownership, switch views, and jump into action on any account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" placeholder="Search customer or rep..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <Select value={repFilter} onValueChange={(value) => setRepFilter(value as RepFilter)}>
                  <SelectTrigger className="lg:w-52"><SelectValue placeholder="All reps" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All reps</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {reps.map((rep) => <SelectItem key={rep} value={rep}>{rep}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                  <SelectTrigger className="lg:w-52"><SelectValue placeholder="Sort by" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risk">Sort by risk</SelectItem>
                    <SelectItem value="pastDue">Sort by past due</SelectItem>
                    <SelectItem value="total">Sort by total A/R</SelectItem>
                    <SelectItem value="customer">Sort alphabetically</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Tabs value={view} onValueChange={(value) => setView(value as WorkspaceView)}>
                <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl bg-slate-100 p-1">
                  <TabsTrigger value="priority">Priority queue</TabsTrigger>
                  <TabsTrigger value="past-due">Past due</TabsTrigger>
                  <TabsTrigger value="all">All accounts</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="overflow-hidden rounded-2xl border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[220px]">Customer</TableHead>
                        <TableHead>Rep</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total A/R</TableHead>
                        <TableHead className="text-right">Past due</TableHead>
                        <TableHead className="text-right">Oldest</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.length > 0 ? filteredRows.map((row) => (
                        <TableRow key={row.customerId} className={cn("hover:bg-muted/40", row.severity === "critical" && "bg-rose-50/60", row.severity === "priority" && "bg-orange-50/50")}>
                          <TableCell>
                            <div className="truncate font-medium">{row.customerName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{row.oldestBucketLabel === "Current" ? "No past-due exposure" : `${Math.round(row.pastDueRatio * 100)}% of balance is overdue`}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{row.repName || "Unassigned"}</TableCell>
                          <TableCell><Badge variant="outline" className={severityBadgeClass(row.severity)}>{row.severity}</Badge></TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatCurrency(row.total)}</TableCell>
                          <TableCell className={cn("text-right font-mono", row.pastDueTotal > 0 ? "font-semibold text-rose-700" : "text-muted-foreground")}>{formatCurrency(row.pastDueTotal)}</TableCell>
                          <TableCell className="text-right font-mono">{row.oldestBucketLabel}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedCustomerId(row.customerId)}>Manage</Button>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No receivables found.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <Drawer open={selectedCustomerId !== null} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{customerDetailQuery.data?.name ?? "Collections workspace"}</DrawerTitle>
            <DrawerDescription>Record payments, flag disputes, and update promise-to-pay status from the queue.</DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-6 overflow-y-auto px-4 pb-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Open invoices</CardTitle>
                <CardDescription>Pick an invoice to update operationally.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {customerDetailQuery.isLoading ? (
                  <Skeleton className="h-40 w-full rounded-2xl" />
                ) : customerDetailQuery.data?.invoices.filter((invoice) => invoice.balanceDue > 0).length ? (
                  customerDetailQuery.data.invoices.filter((invoice) => invoice.balanceDue > 0).map((invoice) => (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => {
                        setSelectedInvoiceId(invoice.id);
                        setPaymentForm({ ...paymentForm, amount: String(invoice.balanceDue) });
                        setCollectionsForm({
                          collectionsStatus: invoice.collectionsStatus,
                          promisedPaymentDate: invoice.promisedPaymentDate ?? "",
                          promiseNote: invoice.promiseNote ?? "",
                          disputeReason: invoice.disputeReason ?? "",
                          notes: "",
                        });
                      }}
                      className={cn("w-full rounded-2xl border px-4 py-4 text-left transition hover:border-primary/40", selectedInvoiceId === invoice.id && "border-primary bg-primary/5")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-muted-foreground">Due {formatDate(invoice.dueDate)} · {invoice.collectionsStatus.replaceAll("_", " ")}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-semibold">{formatCurrency(invoice.balanceDue)}</p>
                          <p className="text-xs text-muted-foreground">{invoice.paymentStatus.replaceAll("_", " ")}</p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">No open invoices for this account.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{selectedInvoice ? selectedInvoice.invoiceNumber : "Select an invoice"}</CardTitle>
                <CardDescription>{selectedInvoice ? `Balance ${formatCurrency(selectedInvoice.balanceDue)}` : "Choose an invoice from the list to act on it."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {selectedInvoice ? (
                  <>
                    <div className="rounded-2xl border bg-slate-50 p-4 text-sm">
                      <div className="flex items-center justify-between"><span className="text-muted-foreground">Payment status</span><span className="font-medium">{selectedInvoice.paymentStatus.replaceAll("_", " ")}</span></div>
                      <div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Collections</span><span className="font-medium">{selectedInvoice.collectionsStatus.replaceAll("_", " ")}</span></div>
                    </div>

                    <div className="space-y-3 rounded-2xl border p-4">
                      <div className="flex items-center gap-2 font-medium"><Receipt className="size-4" /> Record payment</div>
                      <Input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} placeholder="Amount" />
                      <Input type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} />
                      <Input value={paymentForm.referenceNumber} onChange={(event) => setPaymentForm({ ...paymentForm, referenceNumber: event.target.value })} placeholder="Reference number" />
                      <Textarea value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} placeholder="Payment note" />
                      <Button className="w-full" disabled={paymentMutation.isPending || Number(paymentForm.amount) <= 0} onClick={() => paymentMutation.mutate()}>
                        {paymentMutation.isPending ? "Recording..." : "Record payment"}
                      </Button>
                    </div>

                    <div className="space-y-3 rounded-2xl border p-4">
                      <div className="flex items-center gap-2 font-medium"><Wallet className="size-4" /> Collections workflow</div>
                      <Select value={collectionsForm.collectionsStatus} onValueChange={(value) => setCollectionsForm({ ...collectionsForm, collectionsStatus: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">Current</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="promised">Promised</SelectItem>
                          <SelectItem value="in_transit">Payment in transit</SelectItem>
                          <SelectItem value="disputed">Disputed</SelectItem>
                          <SelectItem value="escalated">Escalated</SelectItem>
                        </SelectContent>
                      </Select>
                      {(collectionsForm.collectionsStatus === "promised" || collectionsForm.collectionsStatus === "in_transit") ? (
                        <>
                          <Input type="date" value={collectionsForm.promisedPaymentDate} onChange={(event) => setCollectionsForm({ ...collectionsForm, promisedPaymentDate: event.target.value })} />
                          <Textarea value={collectionsForm.promiseNote} onChange={(event) => setCollectionsForm({ ...collectionsForm, promiseNote: event.target.value })} placeholder="Promise / transit note" />
                        </>
                      ) : null}
                      {collectionsForm.collectionsStatus === "disputed" ? (
                        <Textarea value={collectionsForm.disputeReason} onChange={(event) => setCollectionsForm({ ...collectionsForm, disputeReason: event.target.value })} placeholder="Dispute reason" />
                      ) : null}
                      <Textarea value={collectionsForm.notes} onChange={(event) => setCollectionsForm({ ...collectionsForm, notes: event.target.value })} placeholder="General note" />
                      <Button variant="outline" className="w-full" disabled={collectionsMutation.isPending} onClick={() => collectionsMutation.mutate()}>
                        {collectionsMutation.isPending ? "Saving..." : "Save collections update"}
                      </Button>
                    </div>

                    <div className="rounded-2xl border bg-slate-50 p-4 text-sm">
                      <p className="font-medium">Next step</p>
                      <p className="mt-2 text-muted-foreground">
                        {selectedInvoice.collectionsStatus === "disputed"
                          ? "Resolve the dispute or capture a promise date once the customer responds."
                          : selectedInvoice.promisedPaymentDate
                            ? `Follow up on ${formatDate(selectedInvoice.promisedPaymentDate)} if payment has not landed.`
                            : "Record a payment or move the invoice into a collections follow-up state."}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">Select an invoice to manage it.</div>
                )}
              </CardContent>
            </Card>
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setSelectedCustomerId(null)}>Close</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </AppLayout>
  );
}
