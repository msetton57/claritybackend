import { useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, FileText, MapPin, PlusCircle, Truck } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { createInvoiceForOrder, createOrderNote, getOrderWorkflow, updateOrderShipment, updateOrderStatusAction, updateOrderWorkflow } from "@/lib/operations";

function formatLabel(value: string | null | undefined) {
  return (value ?? "Unknown").replaceAll("_", " ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPillTone(value: string) {
  const normalized = value.toLowerCase();

  if (["fulfilled", "current", "paid", "healthy", "normal", "complete"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (["open", "shipped", "in progress", "in transit", "unpaid"].includes(normalized)) {
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  }

  if (["watch", "priority", "cancelled", "overdue"].includes(normalized)) {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }

  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

export default function OrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [shipmentForm, setShipmentForm] = useState({ trackingNumber: "", shippingCarrier: "", shippingMethod: "", note: "" });
  const [noteForm, setNoteForm] = useState({ title: "", details: "" });
  const [itemForm, setItemForm] = useState<Array<{ productId: number; productName: string; sku: string; quantity: number }>>([]);

  const orderQuery = useQuery({
    queryKey: ["order-workflow", orderId],
    queryFn: () => getOrderWorkflow(orderId),
    enabled: Number.isFinite(orderId) && orderId > 0,
  });

  const order = orderQuery.data;
  const noteActivities = order?.activities.filter((activity) => activity.activityType === "note") ?? [];
  const timelineActivities = order?.activities.filter((activity) => activity.activityType !== "note").slice().reverse() ?? [];
  const activeInvoiceLabel = order?.invoice ? formatLabel(order.invoice.paymentStatus) : formatLabel(order?.invoiceStatus);
  const workflowTone = order?.riskLevel === "priority"
    ? "Needs attention"
    : order?.riskLevel === "watch"
      ? "Watch closely"
      : "Workflow healthy";
  const openInvoiceCta = order?.invoice ? `/invoices/${order.invoice.id}` : null;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["order-workflow", orderId] }),
      queryClient.invalidateQueries({ queryKey: ["orders-workflow"] }),
      queryClient.invalidateQueries({ queryKey: ["invoice-workflow"] }),
    ]);
  };

  const statusMutation = useMutation({
    mutationFn: (status: "open" | "in_transit" | "fulfilled" | "cancelled") => updateOrderStatusAction(orderId, { status }),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Order workflow updated" });
    },
    onError: (error: Error) => toast({ title: "Unable to update order", description: error.message, variant: "destructive" }),
  });

  const shipmentMutation = useMutation({
    mutationFn: () => updateOrderShipment(orderId, {
      status: "in_transit",
      trackingNumber: shipmentForm.trackingNumber.trim(),
      shippingCarrier: shipmentForm.shippingCarrier.trim(),
      shippingMethod: shipmentForm.shippingMethod.trim(),
      note: shipmentForm.note.trim() || null,
    }),
    onSuccess: async () => {
      await invalidate();
      setShipmentOpen(false);
      toast({ title: "Order marked in transit" });
    },
    onError: (error: Error) => toast({ title: "Unable to start shipment", description: error.message, variant: "destructive" }),
  });

  const lineItemsMutation = useMutation({
    mutationFn: () =>
      updateOrderWorkflow(orderId, {
        lineItems: itemForm.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      }),
    onSuccess: async () => {
      await invalidate();
      setItemsOpen(false);
      toast({ title: "Line items updated" });
    },
    onError: (error: Error) => toast({ title: "Unable to update line items", description: error.message, variant: "destructive" }),
  });

  const noteMutation = useMutation({
    mutationFn: () => createOrderNote(orderId, noteForm),
    onSuccess: async () => {
      await invalidate();
      setNoteOpen(false);
      setNoteForm({ title: "", details: "" });
      toast({ title: "Order note added" });
    },
    onError: (error: Error) => toast({ title: "Unable to add note", description: error.message, variant: "destructive" }),
  });

  const invoiceMutation = useMutation({
    mutationFn: () => createInvoiceForOrder(orderId),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Invoice ready" });
    },
    onError: (error: Error) => toast({ title: "Unable to create invoice", description: error.message, variant: "destructive" }),
  });

  if (orderQuery.isLoading) {
    return <AppLayout><Skeleton className="h-96 w-full rounded-3xl" /></AppLayout>;
  }

  if (!order) {
    return <AppLayout><div /></AppLayout>;
  }

  const canModifyItems = order.status === "open";

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/orders" className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="size-4" /> Back to Orders
          </Link>
        </div>

        <section className="rounded-[30px] border border-slate-200/80 bg-white px-6 py-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.35)] md:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="font-mono text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                Order #{order.orderNumber}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                Placed {formatDate(order.orderDate)} · {order.customerName} · {order.shippingMethod || "Shipping pending"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className={getPillTone(formatLabel(order.status))}>{formatLabel(order.status)}</Badge>
                <Badge className={getPillTone(activeInvoiceLabel)}>{activeInvoiceLabel}</Badge>
                <Badge className={getPillTone(workflowTone)}>{workflowTone}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-xl lg:justify-end">
              {!order.invoice ? <Button onClick={() => invoiceMutation.mutate()}><PlusCircle className="mr-2 size-4" />Create invoice</Button> : null}
              {order.status === "open" ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShipmentForm({
                      trackingNumber: order.trackingNumber ?? "",
                      shippingCarrier: order.shippingCarrier ?? "",
                      shippingMethod: order.shippingMethod ?? "",
                      note: "",
                    });
                    setShipmentOpen(true);
                  }}
                >
                  Mark in transit
                </Button>
              ) : null}
              {order.status === "in_transit" ? <Button onClick={() => statusMutation.mutate("fulfilled")}>Mark fulfilled</Button> : null}
              {order.status !== "cancelled" && order.status !== "fulfilled" ? <Button variant="destructive" onClick={() => statusMutation.mutate("cancelled")}>Cancel order</Button> : null}
              <Button variant="outline" onClick={() => setNoteOpen(true)}>Add note</Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-muted-foreground">Order total</div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">{formatCurrency(order.total)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{order.lineItems.length} {order.lineItems.length === 1 ? "line item" : "line items"}</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-muted-foreground">Fulfillment</div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">{order.fulfillmentProgress}%</div>
            <div className="mt-1 text-sm text-muted-foreground">{formatLabel(order.fulfillmentStatus)}</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-muted-foreground">Invoice</div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">{formatLabel(order.invoiceStatus)}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {order.invoice ? `Due ${formatDate(order.invoice.dueDate)}` : "No invoice yet"}
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-muted-foreground">Shipping</div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">{order.shippingMethod || "TBD"}</div>
            <div className="mt-1 text-sm text-muted-foreground">{order.shippingCarrier || "Carrier not added"}</div>
            <div className="mt-1 text-sm text-muted-foreground">{order.trackingNumber || "Tracking not added"}</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-muted-foreground">Risk</div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">{formatLabel(order.riskLevel)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{workflowTone}</div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.85fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-200 bg-white">
                <div>
                  <CardTitle>Line Items</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Products included in this order.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canModifyItems}
                  onClick={() => {
                    setItemForm(order.lineItems.map((item) => ({
                      productId: item.productId,
                      productName: item.productName,
                      sku: item.sku,
                      quantity: item.quantity,
                    })));
                    setItemsOpen(true);
                  }}
                >
                  Modify items
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.lineItems.map((item) => (
                      <TableRow key={`${item.productId}-${item.sku}`}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                          {item.promotionName ? <Badge variant="secondary" className="mt-1 text-xs">{item.promotionName}</Badge> : null}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(item.lineTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Fulfillment Timeline</CardTitle>
                <p className="text-sm text-muted-foreground">Operational history for this order.</p>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {timelineActivities.map((activity) => (
                  <div key={activity.id} className="grid gap-3 md:grid-cols-[108px_16px_minmax(0,1fr)]">
                    <div className="pt-0.5 text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</div>
                    <div className="relative flex justify-center">
                      <span className="mt-1 size-3 rounded-full bg-primary shadow-[0_0_0_4px_rgba(59,130,246,0.12)]" />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{activity.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{activity.createdBy}</p>
                        </div>
                        <Badge variant="outline" className="capitalize">{formatLabel(activity.activityType)}</Badge>
                      </div>
                      {activity.details ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{activity.details}</p> : null}
                    </div>
                  </div>
                ))}
                {timelineActivities.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No operational activity recorded yet.</div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-200">
                <div>
                  <CardTitle>Internal Notes</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Team-only notes captured on the order.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>Add note</Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {noteActivities.length > 0 ? noteActivities.slice().reverse().map((activity) => (
                  <div key={activity.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{activity.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {activity.createdBy} · {formatDateTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                    {activity.details ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{activity.details}</p> : null}
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                    No internal notes yet. Add context here for fulfillment, customer requests, or exceptions.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Workflow Health</CardTitle>
                <p className="text-sm text-muted-foreground">Status across fulfillment, invoice, and risk.</p>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fulfillment progress</span>
                    <span className="font-medium">{order.fulfillmentProgress}%</span>
                  </div>
                  <Progress value={order.fulfillmentProgress} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Fulfillment</div>
                    <div className="mt-2 text-lg font-bold">{formatLabel(order.fulfillmentStatus)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Invoice</div>
                    <div className="mt-2 text-lg font-bold">{formatLabel(order.invoiceStatus)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Risk</div>
                    <div className="mt-2 text-lg font-bold">{formatLabel(order.riskLevel)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Payment</div>
                    <div className="mt-2 text-lg font-bold">{order.invoice ? formatLabel(order.invoice.collectionsStatus) : "Pending"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Order Summary</CardTitle>
                <p className="text-sm text-muted-foreground">Charges and totals.</p>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(order.subtotal)}</span></div>
                <div className="flex justify-between text-sm text-emerald-600"><span>Discounts</span><span className="font-mono">-{formatCurrency(order.discountTotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Shipping</span><span className="font-mono">{formatCurrency(order.shippingCost)}</span></div>
                <Separator />
                <div className="flex justify-between text-xl font-bold"><span>Total</span><span className="font-mono">{formatCurrency(order.total)}</span></div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Customer & Finance</CardTitle>
                <p className="text-sm text-muted-foreground">Account, rep, shipment, and invoice.</p>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid gap-4">
                  <div className="grid gap-1">
                    <div className="text-sm text-muted-foreground">Customer</div>
                    <div className="font-semibold">{order.customerName}</div>
                    <Link href={`/reports/customer/${order.customerId}`} className="text-sm text-primary hover:underline">View profile</Link>
                  </div>
                  <div className="flex gap-2 items-start text-sm text-muted-foreground">
                    <FileText className="mt-0.5 size-4 shrink-0" />
                    <div><span className="block font-medium text-foreground">Sales rep</span>{order.repName || "Unassigned"}</div>
                  </div>
                  <div className="flex gap-2 items-start text-sm text-muted-foreground">
                    <Truck className="mt-0.5 size-4 shrink-0" />
                    <div><span className="block font-medium text-foreground">Shipment</span>{order.shippingCarrier || "Carrier TBD"} · {order.shippingMethod || "Method TBD"}</div>
                  </div>
                  <div className="flex gap-2 items-start text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    <div><span className="block font-medium text-foreground">Tracking</span><span className="font-mono">{order.trackingNumber || "Not assigned"}</span></div>
                  </div>
                  {order.effectiveTerms ? (
                    <div className="flex gap-2 items-start text-sm text-muted-foreground">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <div><span className="block font-medium text-foreground">Terms</span><span>{order.effectiveTerms}</span></div>
                    </div>
                  ) : null}
                </div>
                {order.invoice ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{order.invoice.invoiceNumber}</div>
                        <div className="text-sm text-muted-foreground">{formatLabel(order.invoice.paymentStatus)} · {formatLabel(order.invoice.collectionsStatus)}</div>
                      </div>
                      <Link href={`/invoices/${order.invoice.id}`} className="text-sm text-primary hover:underline">Open invoice</Link>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground block">Balance due</span><span className="font-mono font-medium">{formatCurrency(order.invoice.balanceDue)}</span></div>
                      <div><span className="text-muted-foreground block">Due date</span><span>{formatDate(order.invoice.dueDate)}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No invoice created yet.</div>
                )}
              </CardContent>
            </Card>

            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900 shadow-sm">
              <strong className="font-semibold">Clean handoff:</strong>{" "}
              {order.status === "fulfilled"
                ? "fulfillment is complete"
                : `order is ${formatLabel(order.status)}`}
              , {order.invoice ? `invoice is ${formatLabel(order.invoiceStatus)}` : "invoice has not been created yet"}, and{" "}
              {order.riskLevel === "normal" ? "no operational issues are currently flagged." : `risk is marked ${formatLabel(order.riskLevel)}.`}
              {openInvoiceCta ? (
                <>
                  {" "} <Link href={openInvoiceCta} className="font-semibold text-amber-900 underline underline-offset-2">Review invoice</Link>.
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={shipmentOpen} onOpenChange={setShipmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark order in transit</DialogTitle>
            <DialogDescription>Capture shipment details as part of the status change so operations only has one logistics handoff.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="shipment-carrier">Carrier</Label>
                <Input id="shipment-carrier" value={shipmentForm.shippingCarrier} onChange={(event) => setShipmentForm({ ...shipmentForm, shippingCarrier: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shipment-method">Shipping method</Label>
                <Input id="shipment-method" value={shipmentForm.shippingMethod} onChange={(event) => setShipmentForm({ ...shipmentForm, shippingMethod: event.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tracking">Tracking number</Label>
              <Input id="tracking" value={shipmentForm.trackingNumber} onChange={(event) => setShipmentForm({ ...shipmentForm, trackingNumber: event.target.value })} />
            </div>
            <Textarea placeholder="Shipment note" value={shipmentForm.note} onChange={(event) => setShipmentForm({ ...shipmentForm, note: event.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipmentOpen(false)}>Cancel</Button>
            <Button
              disabled={
                shipmentMutation.isPending ||
                shipmentForm.trackingNumber.trim().length < 1 ||
                shipmentForm.shippingCarrier.trim().length < 1 ||
                shipmentForm.shippingMethod.trim().length < 1
              }
              onClick={() => shipmentMutation.mutate()}
            >
              {shipmentMutation.isPending ? "Saving..." : "Confirm shipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemsOpen} onOpenChange={setItemsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify line items</DialogTitle>
            <DialogDescription>
              Adjust quantities or remove items from this order. Line items can only be edited while the order is open.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {itemForm.map((item) => (
              <div key={item.productId} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{item.productName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{item.sku}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setItemForm((current) => current.filter((entry) => entry.productId !== item.productId))}
                  >
                    Remove
                  </Button>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setItemForm((current) => current.map((entry) => entry.productId === item.productId ? { ...entry, quantity: Math.max(1, entry.quantity - 1) } : entry))}
                  >
                    -
                  </Button>
                  <Input
                    className="w-24"
                    type="number"
                    min="1"
                    value={String(item.quantity)}
                    onChange={(event) => {
                      const nextQuantity = Number(event.target.value || 1);
                      setItemForm((current) => current.map((entry) => (
                        entry.productId === item.productId
                          ? { ...entry, quantity: Number.isFinite(nextQuantity) ? Math.max(1, Math.floor(nextQuantity)) : 1 }
                          : entry
                      )));
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setItemForm((current) => current.map((entry) => entry.productId === item.productId ? { ...entry, quantity: entry.quantity + 1 } : entry))}
                  >
                    +
                  </Button>
                </div>
              </div>
            ))}
            {itemForm.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                At least one line item is required. Keep one item on the order before saving.
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemsOpen(false)}>Cancel</Button>
            <Button disabled={lineItemsMutation.isPending || itemForm.length < 1} onClick={() => lineItemsMutation.mutate()}>
              {lineItemsMutation.isPending ? "Saving..." : "Save items"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add order note</DialogTitle>
            <DialogDescription>Capture an operational note directly on the order timeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Note title" value={noteForm.title} onChange={(event) => setNoteForm({ ...noteForm, title: event.target.value })} />
            <Textarea placeholder="Details" value={noteForm.details} onChange={(event) => setNoteForm({ ...noteForm, details: event.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button disabled={noteMutation.isPending || noteForm.title.trim().length < 1} onClick={() => noteMutation.mutate()}>
              {noteMutation.isPending ? "Saving..." : "Add note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
