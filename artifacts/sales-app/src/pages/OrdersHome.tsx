import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Eye, PlusCircle, Search, Truck } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { listOrders, type OrderWorkflowItem } from "@/lib/operations";

type QueueView = "all" | "open" | "in_transit" | "fulfilled" | "overdue_invoice" | "priority";

export default function OrdersHome() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<QueueView>("all");
  const [invoiceStatus, setInvoiceStatus] = useState("all");

  const ordersQuery = useQuery({
    queryKey: ["orders-workflow", search, view, invoiceStatus],
    queryFn: () => listOrders({
      q: search || undefined,
      status: view === "open" || view === "in_transit" || view === "fulfilled" ? view : undefined,
      invoiceStatus: invoiceStatus === "all" ? undefined : invoiceStatus,
      riskLevel: view === "priority" ? "priority" : undefined,
    }),
  });

  const orders = useMemo(() => {
    const all = ordersQuery.data ?? [];
    if (view === "overdue_invoice") {
      return all.filter((order) => order.invoiceStatus === "overdue");
    }
    return all;
  }, [ordersQuery.data, view]);

  const queueStats = {
    open: orders.filter((order) => order.status === "open").length,
    transit: orders.filter((order) => order.status === "in_transit").length,
    fulfilled: orders.filter((order) => order.status === "fulfilled").length,
    priority: orders.filter((order) => order.riskLevel === "priority").length,
  };

  const badgeForStatus = (order: OrderWorkflowItem) => {
    if (order.status === "fulfilled") return <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20">Fulfilled</Badge>;
    if (order.status === "in_transit") return <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20">In transit</Badge>;
    if (order.status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
    return <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20">Open</Badge>;
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
            <p className="mt-1 text-muted-foreground">Operate the order-to-cash queue with workflow, logistics, and invoice context in one place.</p>
          </div>
          <Link href="/orders/new">
            <Button size="lg" className="shadow-md">
              <PlusCircle className="mr-2 size-5" /> New Order
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Open</div><div className="mt-2 text-3xl font-semibold">{queueStats.open}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">In transit</div><div className="mt-2 text-3xl font-semibold">{queueStats.transit}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Fulfilled</div><div className="mt-2 text-3xl font-semibold">{queueStats.fulfilled}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Priority risk</div><div className="mt-2 text-3xl font-semibold">{queueStats.priority}</div></CardContent></Card>
        </div>

        <Card className="flex-1">
          <CardHeader className="gap-4 border-b pb-4">
            <CardTitle>Order queue</CardTitle>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order or customer" className="pl-9" />
              </div>
              <Select value={view} onValueChange={(value) => setView(value as QueueView)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All orders</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_transit">In transit</SelectItem>
                  <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  <SelectItem value="overdue_invoice">Overdue invoice</SelectItem>
                  <SelectItem value="priority">Priority risk</SelectItem>
                </SelectContent>
              </Select>
              <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All invoice states</SelectItem>
                  <SelectItem value="open">Invoice open</SelectItem>
                  <SelectItem value="partial">Invoice partial</SelectItem>
                  <SelectItem value="paid">Invoice paid</SelectItem>
                  <SelectItem value="overdue">Invoice overdue</SelectItem>
                  <SelectItem value="draft">No invoice / draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className={order.riskLevel === "priority" ? "bg-amber-50/50" : ""}>
                      <TableCell className="font-mono font-medium">{order.orderNumber}</TableCell>
                      <TableCell className="font-medium">{order.customerName}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(order.orderDate)}</TableCell>
                      <TableCell>{badgeForStatus(order)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={order.invoiceStatus === "overdue" ? "border-rose-200 bg-rose-50 text-rose-700" : ""}>
                          {order.invoiceStatus.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{order.trackingNumber || "-"}</TableCell>
                      <TableCell>
                        {order.riskLevel === "priority" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"><AlertTriangle className="size-3.5" /> Priority</span>
                        ) : order.status === "in_transit" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Truck className="size-3.5" /> Shipped</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" /> Normal</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatCurrency(order.total)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="mr-2 size-4" /> View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!orders.length ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No orders found.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
