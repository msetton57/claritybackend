import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  DollarSign,
  FileWarning,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Ship,
  TrendingUp,
  Truck,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  cn,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
} from "@/lib/format";
import { fetchJson } from "@/lib/http";
import {
  type InventoryAlert,
  type InventoryCost,
  type InventoryRiskItem,
  type ProductOption,
  type PurchaseOrder,
  type PurchasingRecommendation,
  type Shipment,
  type SupplyReceipt,
  type SupplyStore,
  type Vendor,
  statusLabel,
  statusTone,
} from "@/lib/supply-management";
import { useCurrentUser } from "@/lib/users";

type Workspace =
  | "dashboard"
  | "purchasing"
  | "inbound"
  | "inventory"
  | "vendors"
  | "bills";
type LineDraft = { productId: string; quantity: string; unitCost: string };
const emptyLine = (): LineDraft => ({
  productId: "",
  quantity: "1",
  unitCost: "",
});

async function apiRequest<T>(path: string, method = "POST", body?: unknown) {
  return fetchJson<T>(path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function formatDateParts(year: number, month: number, day: number) {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}-${String(year).padStart(4, "0")}`;
}

function parseFlexibleDate(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return {
      year: Number(year),
      month: Number(month),
      day: Number(day),
    };
  }

  const usMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return {
      year: Number(year),
      month: Number(month),
      day: Number(day),
    };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) return null;
  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
}

function normalizeDateInputValue(value: string | null | undefined) {
  const parts = parseFlexibleDate(value);
  if (!parts) return "";
  return formatDateParts(parts.year, parts.month, parts.day);
}

function normalizeDateValueForApi(value: string | null | undefined) {
  const parts = parseFlexibleDate(value);
  if (!parts) return "";
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function todayDisplayDate() {
  const now = new Date();
  return formatDateParts(now.getMonth() + 1, now.getDate(), now.getFullYear());
}

function DateTextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder="MM-DD-YYYY"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => {
        const normalized = normalizeDateInputValue(event.target.value);
        onChange(normalized || event.target.value.trim());
      }}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("border-0", statusTone(status))}>
      {statusLabel(status)}
    </Badge>
  );
}

function PriorityBadge({
  value,
}: {
  value: PurchasingRecommendation["priority"] | InventoryAlert["severity"];
}) {
  const tone = {
    critical: "bg-rose-500/10 text-rose-700",
    high: "bg-orange-500/10 text-orange-700",
    medium: "bg-amber-500/10 text-amber-700",
    low: "bg-slate-500/10 text-slate-700",
    warning: "bg-amber-500/10 text-amber-700",
    informational: "bg-sky-500/10 text-sky-700",
  }[value];
  return <Badge className={cn("border-0", tone)}>{statusLabel(value)}</Badge>;
}

function InventoryStatusBadge({
  status,
}: {
  status: InventoryCost["inventoryStatus"];
}) {
  const tone = {
    healthy: "bg-emerald-500/10 text-emerald-700",
    reorder_soon: "bg-amber-500/10 text-amber-700",
    critical: "bg-rose-500/10 text-rose-700",
    overstock: "bg-sky-500/10 text-sky-700",
  }[status];
  return <Badge className={cn("border-0", tone)}>{statusLabel(status)}</Badge>;
}

function ProductCombobox({
  products,
  value,
  onValueChange,
}: {
  products: ProductOption[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = products.find((product) => String(product.id) === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between overflow-hidden"
        >
          <span className="truncate">
            {selected ? `${selected.sku} · ${selected.name}` : "Select product"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(32rem,var(--radix-popover-trigger-width))] p-0"
      >
        <Command>
          <CommandInput placeholder="Search SKU or product..." />
          <CommandList className="max-h-72">
            <CommandEmpty>No matching products.</CommandEmpty>
            {products.map((product) => (
              <CommandItem
                key={product.id}
                value={`${product.sku} ${product.name}`}
                onSelect={() => {
                  onValueChange(String(product.id));
                  setOpen(false);
                }}
              >
                <div>
                  <div className="font-medium">{product.sku}</div>
                  <div className="text-xs text-muted-foreground">
                    {product.name}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function SupplyManagement() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const actorName = currentUser?.name ?? "Operations";
  const [workspace, setWorkspace] = useState<Workspace>("dashboard");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [poDialog, setPoDialog] = useState(false);
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
  const [recommendationSeed, setRecommendationSeed] =
    useState<PurchasingRecommendation | null>(null);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [shipmentDialog, setShipmentDialog] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [receiptShipment, setReceiptShipment] = useState<Shipment | null>(null);
  const [documentShipment, setDocumentShipment] = useState<Shipment | null>(
    null,
  );
  const [billDialog, setBillDialog] = useState(false);
  const [vendorDialog, setVendorDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [inventoryAdjustment, setInventoryAdjustment] =
    useState<InventoryCost | null>(null);
  const [reverseReceipt, setReverseReceipt] = useState<SupplyReceipt | null>(
    null,
  );

  const query = useQuery<SupplyStore>({
    queryKey: ["supply-management-v3"],
    queryFn: () => fetchJson<SupplyStore>("/api/supply-management"),
  });
  const store = query.data;
  const refresh = async () =>
    queryClient.invalidateQueries({ queryKey: ["supply-management-v3"] });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("workspace");
    if (
      [
        "dashboard",
        "purchasing",
        "inbound",
        "inventory",
        "vendors",
        "bills",
      ].includes(target ?? "")
    ) {
      setWorkspace(target as Workspace);
    }
    setSearch(params.get("search") ?? "");
  }, [location]);

  const action = useMutation({
    mutationFn: ({
      path,
      method,
      body,
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => apiRequest(path, method, body),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Supply workspace updated" });
    },
    onError: (error: Error) =>
      toast({
        title: "Action failed",
        description: error.message,
        variant: "destructive",
      }),
  });

  const term = search.toLowerCase();
  const filteredPos = useMemo(
    () =>
      (store?.purchaseOrders ?? []).filter(
        (po) =>
          (statusFilter === "all" || po.status === statusFilter) &&
          [
            po.poNumber,
            po.vendorName,
            ...po.lines.map((line) => `${line.sku} ${line.productName}`),
          ]
            .join(" ")
            .toLowerCase()
            .includes(term),
      ),
    [statusFilter, store?.purchaseOrders, term],
  );
  const filteredShipments = useMemo(
    () =>
      (store?.shipments ?? []).filter(
        (shipment) =>
          (statusFilter === "all" || shipment.status === statusFilter) &&
          [
            shipment.shipmentNumber,
            shipment.poNumber,
            shipment.vendorName,
            shipment.carrier ?? "",
            shipment.trackingNumber ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(term),
      ),
    [statusFilter, store?.shipments, term],
  );
  const filteredInventory = useMemo(
    () =>
      (store?.inventory ?? []).filter((row) =>
        [row.sku, row.productName, row.category, row.vendorName ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(term),
      ),
    [store?.inventory, term],
  );

  function transitionPo(
    po: PurchaseOrder,
    transition: "issue" | "close" | "cancel",
  ) {
    action.mutate({
      path: `/api/supply-management/purchase-orders/${po.id}/transition`,
      body: { action: transition, actorName },
    });
  }

  function transitionShipment(
    shipment: Shipment,
    status: "in_transit" | "delivered" | "cancelled",
  ) {
    action.mutate({
      path: `/api/supply-management/shipments/${shipment.id}/status`,
      method: "PATCH",
      body: { status, actorName },
    });
  }

  function receiveFull(shipment: Shipment) {
    action.mutate({
      path: `/api/supply-management/shipments/${shipment.id}/receipts`,
      body: {
        receivedBy: actorName,
        discrepancyNotes: null,
        lines: shipment.lines
          .filter((line) => line.remainingQuantity > 0)
          .map((line) => ({
            shipmentLineId: line.id,
            acceptedQuantity: line.remainingQuantity,
            damagedQuantity: 0,
            rejectedQuantity: 0,
          })),
      },
    });
  }

  if (query.isLoading) {
    return (
      <AppLayout fluid>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading supply operations...
          </CardContent>
        </Card>
      </AppLayout>
    );
  }
  if (query.isError || !store) {
    return (
      <AppLayout fluid>
        <Card>
          <CardContent className="py-12 text-center text-rose-600">
            {(query.error as Error)?.message ??
              "Unable to load supply management."}
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const metrics = store.metrics;
  const delayedShipments = store.shipments.filter(
    (shipment) =>
      shipment.eta &&
      shipment.eta < new Date().toISOString().slice(0, 10) &&
      !["received", "cancelled"].includes(shipment.status),
  );
  const awaitingReceipt = store.shipments.filter(
    (shipment) =>
      shipment.status === "delivered" &&
      shipment.lines.some((line) => line.remainingQuantity > 0),
  );
  const billExceptions = store.bills.filter(
    (bill) => bill.status === "exception",
  );
  const openPos = store.purchaseOrders.filter(
    (po) => !["received", "closed", "cancelled"].includes(po.status),
  );
  const attentionAlerts = store.alerts
    .filter((alert) => alert.severity !== "informational")
    .slice(0, 8);
  const metricCards = [
    {
      label: "Inventory value",
      value: formatCompactCurrency(metrics.totalInventoryValue ?? 0),
      icon: DollarSign,
      target: "inventory" as Workspace,
    },
    {
      label: "Stockout risk",
      value: String(metrics.projectedStockouts ?? 0),
      icon: AlertTriangle,
      target: "inventory" as Workspace,
    },
    {
      label: "Below safety stock",
      value: String(metrics.belowSafetyStock ?? 0),
      icon: Boxes,
      target: "inventory" as Workspace,
    },
    {
      label: "Recommended buys",
      value: String(store.recommendations.length),
      icon: PackageCheck,
      target: "purchasing" as Workspace,
    },
    {
      label: "Open POs",
      value: String(metrics.openPurchaseOrders ?? 0),
      icon: FileWarning,
      target: "purchasing" as Workspace,
    },
    {
      label: "Delayed shipments",
      value: String(metrics.lateShipments ?? 0),
      icon: Ship,
      target: "inbound" as Workspace,
    },
    {
      label: "Awaiting receipt",
      value: String(metrics.receivingAwaitingAction ?? 0),
      icon: Truck,
      target: "inbound" as Workspace,
    },
    {
      label: "Bill exceptions",
      value: String(metrics.vendorBillExceptions ?? 0),
      icon: TrendingUp,
      target: "bills" as Workspace,
    },
  ];

  return (
    <AppLayout fluid>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-medium text-primary">
              Supply operations
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Supply Management
            </h1>
            <p className="mt-1 text-muted-foreground">
              Inventory need → purchase order → shipment → receipt → bill and
              cost update.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setBillDialog(true)}>
              <DollarSign className="mr-2 size-4" />
              Add bill
            </Button>
            <Button variant="outline" onClick={() => setShipmentDialog(true)}>
              <Ship className="mr-2 size-4" />
              Add shipment
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditingVendor(null);
                setVendorDialog(true);
              }}
            >
              <Truck className="mr-2 size-4" />
              Add vendor
            </Button>
            <Button
              onClick={() => {
                setEditingPo(null);
                setRecommendationSeed(null);
                setPoDialog(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Create purchase order
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {metricCards.map(({ label, value, icon: Icon, target }) => (
            <button
              key={label}
              className="rounded-xl border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
              onClick={() => setWorkspace(target)}
            >
              <Icon className="mb-3 size-4 text-muted-foreground" />
              <div className="text-2xl font-semibold">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{label}</div>
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search PO, shipment, vendor, SKU, receipt, or bill..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="lg:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {[
                    "draft",
                    "issued",
                    "partially_received",
                    "received",
                    "closed",
                    "cancelled",
                    "created",
                    "in_transit",
                    "delivered",
                    "matched",
                    "exception",
                  ].map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs
              value={workspace}
              onValueChange={(value) => setWorkspace(value as Workspace)}
            >
              <TabsList className="h-auto w-full justify-start overflow-x-auto">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="purchasing">Purchasing</TabsTrigger>
                <TabsTrigger value="inbound">Inbound Inventory</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="vendors">Vendors</TabsTrigger>
                <TabsTrigger value="bills">Bills & Costs</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="mt-6 space-y-6">
                <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle>What needs attention today?</CardTitle>
                      <CardDescription>
                        Only high-priority operational exceptions are shown
                        here.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {attentionAlerts.map((alert) => (
                        <button
                          key={alert.id}
                          className="flex w-full items-start justify-between gap-4 rounded-lg border p-4 text-left hover:bg-muted/40"
                          onClick={() =>
                            setWorkspace(alert.workspace as Workspace)
                          }
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{alert.title}</span>
                              <PriorityBadge value={alert.severity} />
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {alert.description}
                            </div>
                          </div>
                          <ArrowRight className="mt-1 size-4 shrink-0" />
                        </button>
                      ))}
                      {billExceptions.slice(0, 3).map((bill) => (
                        <button
                          key={bill.id}
                          className="flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-left"
                          onClick={() => setWorkspace("bills")}
                        >
                          <div>
                            <div className="font-medium">
                              {bill.billNumber} has a match exception
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {bill.poNumber} · {formatCurrency(bill.amount)}
                            </div>
                          </div>
                          <ArrowRight className="size-4" />
                        </button>
                      ))}
                      {attentionAlerts.length === 0 &&
                      billExceptions.length === 0 ? (
                        <Empty label="Nothing urgent. Supply operations are clear." />
                      ) : null}
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle>Recommended purchases</CardTitle>
                      <CardDescription>
                        Highest-priority replenishment suggestions.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {store.recommendations
                        .slice(0, 5)
                        .map((recommendation) => (
                          <div
                            key={recommendation.productId}
                            className="rounded-lg border p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">
                                  {recommendation.sku} ·{" "}
                                  {recommendation.productName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {recommendation.recommendedPurchaseQuantity.toLocaleString()}{" "}
                                  units ·{" "}
                                  {formatCurrency(
                                    recommendation.estimatedPurchaseCost,
                                  )}
                                </div>
                              </div>
                              <PriorityBadge value={recommendation.priority} />
                            </div>
                            <Button
                              className="mt-3"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRecommendationSeed(recommendation);
                                setEditingPo(null);
                                setPoDialog(true);
                              }}
                            >
                              Create PO
                            </Button>
                          </div>
                        ))}
                      {store.recommendations.length === 0 ? (
                        <Empty label="No purchases are recommended right now." />
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-6 xl:grid-cols-3">
                  <SummaryList
                    title="Delayed shipments"
                    empty="No delayed shipments."
                    rows={delayedShipments.slice(0, 5).map((shipment) => ({
                      id: shipment.id,
                      title: shipment.shipmentNumber,
                      detail: `${shipment.vendorName} · ETA ${shipment.eta ? formatDate(shipment.eta) : "TBD"}`,
                      status: shipment.status,
                    }))}
                    onOpen={() => setWorkspace("inbound")}
                  />
                  <SummaryList
                    title="Receiving awaiting action"
                    empty="Nothing is awaiting receipt."
                    rows={awaitingReceipt.slice(0, 5).map((shipment) => ({
                      id: shipment.id,
                      title: shipment.shipmentNumber,
                      detail: `${shipment.vendorName} · ${shipment.lines.reduce((sum, line) => sum + line.remainingQuantity, 0)} units`,
                      status: shipment.status,
                    }))}
                    onOpen={() => setWorkspace("inbound")}
                  />
                  <SummaryList
                    title="Open purchase orders"
                    empty="No open purchase orders."
                    rows={openPos.slice(0, 5).map((po) => ({
                      id: po.id,
                      title: po.poNumber,
                      detail: `${po.vendorName} · ${formatCurrency(po.total)}`,
                      status: po.status,
                    }))}
                    onOpen={() => setWorkspace("purchasing")}
                  />
                </div>
              </TabsContent>

              <TabsContent value="purchasing" className="mt-6 space-y-6">
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle>Purchase recommendations</CardTitle>
                    <CardDescription>
                      Suggestions use available inventory: on hand − allocated +
                      incoming.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DataTableEmpty
                      empty={store.recommendations.length === 0}
                      label="No replenishment recommendations."
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">
                              Available
                            </TableHead>
                            <TableHead className="text-right">
                              Monthly usage
                            </TableHead>
                            <TableHead className="text-right">
                              Days left
                            </TableHead>
                            <TableHead className="text-right">
                              Safety stock
                            </TableHead>
                            <TableHead className="text-right">
                              Suggested buy
                            </TableHead>
                            <TableHead className="text-right">
                              Est. cost
                            </TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {store.recommendations
                            .filter((row) =>
                              [row.sku, row.productName, row.vendorName ?? ""]
                                .join(" ")
                                .toLowerCase()
                                .includes(term),
                            )
                            .map((row) => (
                              <TableRow key={row.productId}>
                                <TableCell>
                                  <div className="font-mono font-medium">
                                    {row.sku}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {row.productName} ·{" "}
                                    {row.vendorName || "Vendor TBD"}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {row.availableInventory.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {row.monthlyUsage.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {row.daysRemaining == null
                                    ? "—"
                                    : row.daysRemaining.toFixed(0)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {row.safetyStock.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {row.recommendedPurchaseQuantity.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(row.estimatedPurchaseCost)}
                                </TableCell>
                                <TableCell>
                                  <PriorityBadge value={row.priority} />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setRecommendationSeed(row);
                                      setEditingPo(null);
                                      setPoDialog(true);
                                    }}
                                  >
                                    Create PO
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </DataTableEmpty>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle>Purchase orders</CardTitle>
                      <CardDescription>
                        Create, edit, issue, close, and cancel purchase orders.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingPo(null);
                        setRecommendationSeed(null);
                        setPoDialog(true);
                      }}
                    >
                      <Plus className="mr-1 size-3" />
                      PO
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <DataTableEmpty
                      empty={filteredPos.length === 0}
                      label="No purchase orders match these filters."
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>PO</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Expected</TableHead>
                            <TableHead>Received</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPos.map((po) => {
                            const ordered = po.lines.reduce(
                              (sum, line) => sum + line.orderedQuantity,
                              0,
                            );
                            const received = po.lines.reduce(
                              (sum, line) => sum + line.receivedQuantity,
                              0,
                            );
                            const hasActiveShipment = store.shipments.some(
                              (shipment) =>
                                shipment.purchaseOrderId === po.id &&
                                shipment.status !== "cancelled",
                            );
                            return (
                              <TableRow
                                key={po.id}
                                className="cursor-pointer"
                                onClick={() => setSelectedPo(po)}
                              >
                                <TableCell className="font-mono font-medium">
                                  {po.poNumber}
                                </TableCell>
                                <TableCell>{po.vendorName}</TableCell>
                                <TableCell>
                                  <StatusBadge status={po.status} />
                                </TableCell>
                                <TableCell>
                                  {po.expectedDate
                                    ? formatDate(po.expectedDate)
                                    : "Not set"}
                                </TableCell>
                                <TableCell>
                                  {received.toLocaleString()} /{" "}
                                  {ordered.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(po.total)}
                                </TableCell>
                                <TableCell
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <div className="flex justify-end gap-2">
                                    {po.status === "draft" ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingPo(po);
                                            setRecommendationSeed(null);
                                            setPoDialog(true);
                                          }}
                                        >
                                          <Pencil className="mr-1 size-3" />
                                          Edit
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            transitionPo(po, "issue")
                                          }
                                        >
                                          Issue
                                        </Button>
                                      </>
                                    ) : null}
                                    {po.status === "received" ? (
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          transitionPo(po, "close")
                                        }
                                      >
                                        Close
                                      </Button>
                                    ) : null}
                                    {["draft", "issued"].includes(po.status) &&
                                    !hasActiveShipment ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          transitionPo(po, "cancel")
                                        }
                                      >
                                        Cancel
                                      </Button>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </DataTableEmpty>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="inbound" className="mt-6 space-y-6">
                {delayedShipments.length > 0 ? (
                  <ContextAlert
                    title={`${delayedShipments.length} delayed shipment${delayedShipments.length === 1 ? "" : "s"}`}
                    detail="Review the highlighted ETAs and update the carrier plan."
                  />
                ) : null}
                <Card className="shadow-none">
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle>Inbound shipments</CardTitle>
                      <CardDescription>
                        Track the PO, carrier, ETA, expected quantity, and
                        receipt progress together.
                      </CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setShipmentDialog(true)}>
                      <Plus className="mr-1 size-3" />
                      Shipment
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <DataTableEmpty
                      empty={filteredShipments.length === 0}
                      label="No inbound shipments match these filters."
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Shipment</TableHead>
                            <TableHead>Vendor / PO</TableHead>
                            <TableHead>Carrier</TableHead>
                            <TableHead>ETA</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                              Expected
                            </TableHead>
                            <TableHead className="text-right">
                              Received
                            </TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredShipments.map((shipment) => {
                            const expected = shipment.lines.reduce(
                              (sum, line) => sum + line.quantity,
                              0,
                            );
                            const remaining = shipment.lines.reduce(
                              (sum, line) => sum + line.remainingQuantity,
                              0,
                            );
                            return (
                              <TableRow key={shipment.id}>
                                <TableCell>
                                  <div className="font-mono font-medium">
                                    {shipment.shipmentNumber}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {shipment.trackingNumber || "No tracking"}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>{shipment.vendorName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {shipment.poNumber}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {shipment.carrier || "TBD"}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    shipment.eta &&
                                      shipment.eta <
                                        new Date().toISOString().slice(0, 10) &&
                                      !["received", "cancelled"].includes(
                                        shipment.status,
                                      ) &&
                                      "text-rose-600",
                                  )}
                                >
                                  {shipment.eta
                                    ? formatDate(shipment.eta)
                                    : "TBD"}
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={shipment.status} />
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {expected.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {(expected - remaining).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap justify-end gap-2">
                                    {!["received", "cancelled"].includes(
                                      shipment.status,
                                    ) ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          setEditingShipment(shipment)
                                        }
                                      >
                                        <Pencil className="mr-1 size-3" />
                                        Update
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setDocumentShipment(shipment)
                                      }
                                    >
                                      Docs
                                    </Button>
                                    {shipment.status === "created" ? (
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          transitionShipment(
                                            shipment,
                                            "in_transit",
                                          )
                                        }
                                      >
                                        In transit
                                      </Button>
                                    ) : null}
                                    {shipment.status === "in_transit" ? (
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          transitionShipment(
                                            shipment,
                                            "delivered",
                                          )
                                        }
                                      >
                                        Delivered
                                      </Button>
                                    ) : null}
                                    {shipment.status === "delivered" &&
                                    remaining > 0 ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            setReceiptShipment(shipment)
                                          }
                                        >
                                          Review receipt
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => receiveFull(shipment)}
                                        >
                                          Receive full
                                        </Button>
                                      </>
                                    ) : null}
                                    {["created", "in_transit"].includes(
                                      shipment.status,
                                    ) ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          transitionShipment(
                                            shipment,
                                            "cancelled",
                                          )
                                        }
                                      >
                                        Cancel
                                      </Button>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </DataTableEmpty>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle>Receiving awaiting action</CardTitle>
                    <CardDescription>
                      Use Receive full for clean shipments. Open detailed
                      receiving only for discrepancies.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {awaitingReceipt.map((shipment) => (
                        <div
                          key={shipment.id}
                          className="rounded-lg border p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-mono font-medium">
                                {shipment.shipmentNumber}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {shipment.vendorName}
                              </div>
                            </div>
                            <StatusBadge status={shipment.status} />
                          </div>
                          <div className="my-4 text-sm">
                            {shipment.lines
                              .reduce(
                                (sum, line) => sum + line.remainingQuantity,
                                0,
                              )
                              .toLocaleString()}{" "}
                            units awaiting receipt
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1"
                              variant="outline"
                              onClick={() => setReceiptShipment(shipment)}
                            >
                              Review
                            </Button>
                            <Button
                              className="flex-1"
                              onClick={() => receiveFull(shipment)}
                            >
                              Receive full
                            </Button>
                          </div>
                        </div>
                      ))}
                      {awaitingReceipt.length === 0 ? (
                        <div className="md:col-span-2 xl:col-span-3">
                          <Empty label="No delivered shipments are awaiting receipt." />
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="inventory" className="mt-6 space-y-6">
                <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                  <strong>Available inventory</strong> = on hand − allocated +
                  incoming. Purchasing and stockout coverage use this same
                  value.
                </div>
                <DataTableEmpty
                  empty={filteredInventory.length === 0}
                  label="No inventory matches this search."
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">On hand</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                        <TableHead className="text-right">Incoming</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right">
                          Monthly usage
                        </TableHead>
                        <TableHead className="text-right">Days left</TableHead>
                        <TableHead className="text-right">
                          Safety stock
                        </TableHead>
                        <TableHead className="text-right">
                          Reorder point
                        </TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="font-mono font-medium">
                              {row.sku}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.productName} ·{" "}
                              {row.vendorName || "Vendor TBD"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <InventoryStatusBadge
                              status={row.inventoryStatus}
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.onHand.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.allocatedQuantity.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.incomingUnits.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {row.availableQuantity.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.averageMonthlyUsage.toFixed(1)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-mono",
                              row.daysRemaining != null &&
                                row.daysRemaining <= 30 &&
                                "text-rose-600",
                            )}
                          >
                            {row.daysRemaining == null
                              ? "—"
                              : row.daysRemaining.toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.safetyStock.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.reorderPoint.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setInventoryAdjustment(row)}
                            >
                              Adjust / count
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </DataTableEmpty>
                <div className="grid gap-6 xl:grid-cols-3">
                  <RiskCard title="Stockout risk" items={store.stockoutRisks} />
                  <RiskCard
                    title="Dead inventory"
                    items={store.deadInventory}
                  />
                  <RiskCard title="Overstock" items={store.overstock} />
                </div>
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle>Inventory movement history</CardTitle>
                    <CardDescription>
                      Receipts, reversals, damage, rejections, and manual
                      adjustments.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DataTableEmpty
                      empty={store.inventoryMovements.length === 0}
                      label="No inventory movements recorded."
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Movement</TableHead>
                            <TableHead className="text-right">
                              Quantity
                            </TableHead>
                            <TableHead className="text-right">
                              Unit cost
                            </TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {store.inventoryMovements
                            .slice(0, 30)
                            .map((movement) => (
                              <TableRow key={movement.id}>
                                <TableCell>
                                  {new Date(
                                    movement.createdAt,
                                  ).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <div className="font-mono">
                                    {movement.sku}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {movement.productName}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {statusLabel(movement.movementType)}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-right font-mono",
                                    movement.quantity < 0
                                      ? "text-rose-600"
                                      : "text-emerald-700",
                                  )}
                                >
                                  {movement.quantity > 0 ? "+" : ""}
                                  {movement.quantity}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(movement.unitCost)}
                                </TableCell>
                                <TableCell className="max-w-xs truncate">
                                  {movement.notes ||
                                    `${statusLabel(movement.referenceType)} #${movement.referenceId}`}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </DataTableEmpty>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vendors" className="mt-6">
                <Card className="shadow-none">
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle>Vendor scorecards</CardTitle>
                      <CardDescription>
                        Lead time, delivery reliability, fill rate, spend, open
                        work, and cost movement.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingVendor(null);
                        setVendorDialog(true);
                      }}
                    >
                      <Plus className="mr-1 size-3" />
                      Vendor
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead className="text-right">
                            Lead time
                          </TableHead>
                          <TableHead className="text-right">On time</TableHead>
                          <TableHead className="text-right">
                            Fill rate
                          </TableHead>
                          <TableHead className="text-right">Open POs</TableHead>
                          <TableHead className="text-right">Delayed</TableHead>
                          <TableHead className="text-right">Spend</TableHead>
                          <TableHead className="text-right">
                            Cost change
                          </TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {store.vendors
                          .filter((vendor) =>
                            [
                              vendor.name,
                              vendor.vendorCode,
                              vendor.primaryContactName,
                            ]
                              .join(" ")
                              .toLowerCase()
                              .includes(term),
                          )
                          .map((vendor) => (
                            <TableRow key={vendor.id}>
                              <TableCell>
                                <div className="font-medium">{vendor.name}</div>
                                <div className="font-mono text-xs text-muted-foreground">
                                  {vendor.vendorCode}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>{vendor.primaryContactName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {vendor.email}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {vendor.leadTimeDays} days
                              </TableCell>
                              <TableCell className="text-right">
                                {Number(vendor.onTimeDeliveryPct).toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right">
                                {Number(vendor.fillRatePct ?? 0).toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right">
                                {vendor.openPurchaseOrders ?? 0}
                              </TableCell>
                              <TableCell className="text-right">
                                {vendor.delayedShipmentCount ?? 0}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCompactCurrency(vendor.totalSpend)}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right font-mono",
                                  (vendor.costChangePct ?? 0) > 5 &&
                                    "text-rose-600",
                                )}
                              >
                                {vendor.costChangePct == null
                                  ? "—"
                                  : `${vendor.costChangePct.toFixed(1)}%`}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingVendor(vendor);
                                    setVendorDialog(true);
                                  }}
                                >
                                  <Pencil className="mr-1 size-3" />
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bills" className="mt-6 space-y-6">
                {billExceptions.length > 0 ? (
                  <ContextAlert
                    title={`${billExceptions.length} vendor bill exception${billExceptions.length === 1 ? "" : "s"}`}
                    detail="Recheck quantity and cost against the PO and confirmed receipts."
                  />
                ) : null}
                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className="shadow-none">
                    <CardHeader className="flex-row items-center justify-between">
                      <div>
                        <CardTitle>Vendor bills</CardTitle>
                        <CardDescription>
                          Three-way matching against purchase orders and
                          receipts.
                        </CardDescription>
                      </div>
                      <Button size="sm" onClick={() => setBillDialog(true)}>
                        <Plus className="mr-1 size-3" />
                        Bill
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {store.bills
                        .filter((bill) =>
                          [
                            bill.billNumber,
                            bill.poNumber,
                            bill.vendorInvoiceNumber,
                          ]
                            .join(" ")
                            .toLowerCase()
                            .includes(term),
                        )
                        .map((bill) => (
                          <div
                            key={bill.id}
                            className="flex items-center justify-between gap-3 rounded-lg border p-4"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium">
                                  {bill.billNumber}
                                </span>
                                <StatusBadge status={bill.status} />
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {bill.vendorInvoiceNumber} · {bill.poNumber} ·{" "}
                                {formatDate(bill.invoiceDate)}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono">
                                {formatCurrency(bill.amount)}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  action.mutate({
                                    path: `/api/supply-management/vendor-bills/${bill.id}/rematch`,
                                    body: { actorName },
                                  })
                                }
                              >
                                <RefreshCw className="mr-1 size-3" />
                                Recheck
                              </Button>
                            </div>
                          </div>
                        ))}
                      {store.bills.length === 0 ? (
                        <Empty label="No vendor bills recorded." />
                      ) : null}
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle>Receipt history</CardTitle>
                      <CardDescription>
                        Confirmed receipts and controlled reversals.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {store.receipts
                        .filter((receipt) =>
                          [
                            receipt.receiptNumber,
                            receipt.shipmentNumber,
                            receipt.receivedBy,
                          ]
                            .join(" ")
                            .toLowerCase()
                            .includes(term),
                        )
                        .map((receipt) => (
                          <div
                            key={receipt.id}
                            className="flex items-center justify-between gap-3 rounded-lg border p-4"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium">
                                  {receipt.receiptNumber}
                                </span>
                                <StatusBadge status={receipt.status} />
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {receipt.shipmentNumber} · {receipt.receivedBy}{" "}
                                · {formatDate(receipt.receivedAt)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {receipt.lines.reduce(
                                  (sum, line) => sum + line.acceptedQuantity,
                                  0,
                                )}{" "}
                                accepted ·{" "}
                                {receipt.lines.reduce(
                                  (sum, line) =>
                                    sum +
                                    line.damagedQuantity +
                                    line.rejectedQuantity,
                                  0,
                                )}{" "}
                                exception units
                              </div>
                            </div>
                            {receipt.status === "confirmed" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setReverseReceipt(receipt)}
                              >
                                <RotateCcw className="mr-1 size-3" />
                                Reverse
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      {store.receipts.length === 0 ? (
                        <Empty label="No receipt history." />
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle>Inventory cost reconciliation</CardTitle>
                    <CardDescription>
                      Compare weighted average, last purchase, incoming landed
                      cost, and projected margin.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">On hand</TableHead>
                          <TableHead className="text-right">
                            Average cost
                          </TableHead>
                          <TableHead className="text-right">
                            Last purchase
                          </TableHead>
                          <TableHead className="text-right">
                            Incoming units
                          </TableHead>
                          <TableHead className="text-right">
                            Incoming landed
                          </TableHead>
                          <TableHead className="text-right">
                            Projected margin
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventory.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <div className="font-mono">{row.sku}</div>
                              <div className="text-xs text-muted-foreground">
                                {row.productName}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {row.onHand.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(row.averageCost)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(row.lastPurchaseCost)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {row.incomingUnits.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {row.incomingCost == null
                                ? "—"
                                : formatCurrency(row.incomingCost)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {row.projectedMargin == null
                                ? "—"
                                : `${row.projectedMargin.toFixed(1)}%`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <PurchaseOrderDialog
        open={poDialog}
        purchaseOrder={editingPo}
        recommendation={recommendationSeed}
        products={store.products}
        vendors={store.vendors}
        actorName={actorName}
        onOpenChange={(open) => {
          setPoDialog(open);
          if (!open) {
            setEditingPo(null);
            setRecommendationSeed(null);
          }
        }}
        onSaved={refresh}
      />
      <ShipmentDialog
        open={shipmentDialog}
        purchaseOrders={store.purchaseOrders}
        actorName={actorName}
        onOpenChange={setShipmentDialog}
        onSaved={refresh}
      />
      <ReceiptDialog
        shipment={receiptShipment}
        receivedBy={actorName}
        onOpenChange={(open) => !open && setReceiptShipment(null)}
        onSaved={refresh}
      />
      <ShipmentUpdateDialog
        shipment={editingShipment}
        actorName={actorName}
        onOpenChange={(open) => !open && setEditingShipment(null)}
        onSaved={refresh}
      />
      <DocumentDialog
        shipment={documentShipment}
        documents={store.documents}
        uploadedBy={actorName}
        onOpenChange={(open) => !open && setDocumentShipment(null)}
        onSaved={refresh}
      />
      <BillDialog
        open={billDialog}
        purchaseOrders={store.purchaseOrders}
        actorName={actorName}
        onOpenChange={setBillDialog}
        onSaved={refresh}
      />
      <VendorDialog
        open={vendorDialog}
        vendor={editingVendor}
        onOpenChange={(open) => {
          setVendorDialog(open);
          if (!open) setEditingVendor(null);
        }}
        onSaved={refresh}
      />
      <InventoryAdjustmentDialog
        inventory={inventoryAdjustment}
        actorName={actorName}
        onOpenChange={(open) => !open && setInventoryAdjustment(null)}
        onSaved={refresh}
      />
      <ReverseReceiptDialog
        receipt={reverseReceipt}
        actorName={actorName}
        onOpenChange={(open) => !open && setReverseReceipt(null)}
        onSaved={refresh}
      />
      <Dialog
        open={!!selectedPo}
        onOpenChange={(open) => !open && setSelectedPo(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedPo?.poNumber}</DialogTitle>
            <DialogDescription>
              {selectedPo?.vendorName} ·{" "}
              {selectedPo ? formatCurrency(selectedPo.total) : ""}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedPo?.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div className="font-mono">{line.sku}</div>
                    <div className="text-xs text-muted-foreground">
                      {line.productName}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {line.orderedQuantity}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.receivedQuantity}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.remainingQuantity}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(line.unitCost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div>
            <h3 className="mb-2 text-sm font-medium">History</h3>
            <div className="max-h-44 space-y-2 overflow-auto">
              {store.activities
                .filter(
                  (event) =>
                    event.entityType === "purchase_order" &&
                    event.entityId === selectedPo?.id,
                )
                .map((event) => (
                  <div key={event.id} className="border-l-2 pl-3 text-sm">
                    <div>{event.summary}</div>
                    <div className="text-xs text-muted-foreground">
                      {event.actorName || "System"} ·{" "}
                      {new Date(event.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed p-7 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function DataTableEmpty({
  empty,
  label,
  children,
}: {
  empty: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      {empty ? (
        <div className="p-12 text-center text-muted-foreground">{label}</div>
      ) : (
        children
      )}
    </div>
  );
}

function ContextAlert({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <AlertTriangle className="mt-0.5 size-4 text-amber-700" />
      <div>
        <div className="font-medium text-amber-900">{title}</div>
        <div className="text-sm text-amber-800">{detail}</div>
      </div>
    </div>
  );
}

function SummaryList({
  title,
  empty,
  rows,
  onOpen,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: number; title: string; detail: string; status: string }>;
  onOpen: () => void;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <button
            key={row.id}
            className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted/40"
            onClick={onOpen}
          >
            <div>
              <div className="font-mono font-medium">{row.title}</div>
              <div className="text-xs text-muted-foreground">{row.detail}</div>
            </div>
            <StatusBadge status={row.status} />
          </button>
        ))}
        {rows.length === 0 ? <Empty label={empty} /> : null}
      </CardContent>
    </Card>
  );
}

function RiskCard({
  title,
  items,
}: {
  title: string;
  items: InventoryRiskItem[];
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 6).map((item) => (
          <div key={item.productId} className="rounded-lg border p-3">
            <div className="font-mono font-medium">{item.sku}</div>
            <div className="text-sm">{item.productName}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {item.recommendedAction}
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <Empty label="No items in this category." />
        ) : null}
      </CardContent>
    </Card>
  );
}

function PurchaseOrderDialog({
  open,
  purchaseOrder,
  recommendation,
  products,
  vendors,
  actorName,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  purchaseOrder: PurchaseOrder | null;
  recommendation: PurchasingRecommendation | null;
  products: ProductOption[];
  vendors: Vendor[];
  actorName: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [destination, setDestination] = useState("Main Warehouse");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (purchaseOrder) {
      setVendorId(String(purchaseOrder.vendorId));
      setExpectedDate(normalizeDateInputValue(purchaseOrder.expectedDate));
      setDestination(purchaseOrder.destination);
      setPaymentTerms(purchaseOrder.paymentTerms);
      setNotes(purchaseOrder.notes ?? "");
      setLines(
        purchaseOrder.lines.map((line) => ({
          productId: String(line.productId),
          quantity: String(line.orderedQuantity),
          unitCost: String(line.unitCost),
        })),
      );
      return;
    }
    const vendor = recommendation
      ? vendors.find((item) => item.name === recommendation.vendorName)
      : null;
    setVendorId(vendor ? String(vendor.id) : "");
    setExpectedDate("");
    setDestination("Main Warehouse");
    setPaymentTerms("Net 30");
    setNotes(recommendation?.reason ?? "");
    setLines(
      recommendation
        ? [
            {
              productId: String(recommendation.productId),
              quantity: String(recommendation.recommendedPurchaseQuantity),
              unitCost: String(
                recommendation.recommendedPurchaseQuantity > 0
                  ? recommendation.estimatedPurchaseCost /
                      recommendation.recommendedPurchaseQuantity
                  : 0,
              ),
            },
          ]
        : [emptyLine()],
    );
  }, [open, purchaseOrder, recommendation, vendors]);

  const updateLine = (index: number, patch: Partial<LineDraft>) =>
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  async function save() {
    try {
      setSaving(true);
      await apiRequest(
        purchaseOrder
          ? `/api/supply-management/purchase-orders/${purchaseOrder.id}`
          : "/api/supply-management/purchase-orders",
        purchaseOrder ? "PATCH" : "POST",
        {
          vendorId: Number(vendorId),
          orderDate:
            purchaseOrder?.orderDate ?? new Date().toISOString().slice(0, 10),
          expectedDate: normalizeDateValueForApi(expectedDate) || null,
          destination,
          paymentTerms,
          notes: notes || null,
          actorName,
          lines: lines.map((line) => ({
            productId: Number(line.productId),
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost),
          })),
        },
      );
      await onSaved();
      onOpenChange(false);
      toast({
        title: purchaseOrder
          ? "Purchase order updated"
          : "Draft purchase order created",
      });
    } catch (error) {
      toast({
        title: "Unable to save purchase order",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {purchaseOrder
              ? `Edit ${purchaseOrder.poNumber}`
              : "Create purchase order"}
          </DialogTitle>
          <DialogDescription>
            Drafts are working documents. Issue the PO when the order has been
            placed with the vendor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-4 overflow-auto p-1 md:grid-cols-2">
          <Field label="Vendor">
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={String(vendor.id)}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Expected date">
            <DateTextInput value={expectedDate} onChange={setExpectedDate} />
          </Field>
          <Field label="Destination">
            <Input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
          </Field>
          <Field label="Payment terms">
            <Input
              value={paymentTerms}
              onChange={(event) => setPaymentTerms(event.target.value)}
            />
          </Field>
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label>PO lines</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLines((current) => [...current, emptyLine()])}
              >
                <Plus className="mr-1 size-3" />
                Line
              </Button>
            </div>
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_120px_140px_auto]"
              >
                <ProductCombobox
                  products={products}
                  value={line.productId}
                  onValueChange={(value) =>
                    updateLine(index, { productId: value })
                  }
                />
                <Input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, { quantity: event.target.value })
                  }
                />
                <Input
                  type="number"
                  min="0"
                  step=".0001"
                  placeholder="Unit cost"
                  value={line.unitCost}
                  onChange={(event) =>
                    updateLine(index, { unitCost: event.target.value })
                  }
                />
                <Button
                  variant="ghost"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((current) => current.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <Field label="Notes" className="md:col-span-2">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              saving ||
              !vendorId ||
              lines.some(
                (line) =>
                  !line.productId ||
                  Number(line.quantity) <= 0 ||
                  Number(line.unitCost) < 0,
              )
            }
            onClick={save}
          >
            {saving
              ? "Saving..."
              : purchaseOrder
                ? "Save changes"
                : "Create draft PO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShipmentDialog({
  open,
  purchaseOrders,
  actorName,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  purchaseOrders: PurchaseOrder[];
  actorName: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const eligible = purchaseOrders.filter(
    (po) =>
      ["issued", "partially_received"].includes(po.status) &&
      po.lines.some((line) => line.availableToShipQuantity > 0),
  );
  const [poId, setPoId] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("Main Warehouse");
  const [eta, setEta] = useState(todayDisplayDate());
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [costs, setCosts] = useState({
    freight: "0",
    customs: "0",
    brokerage: "0",
    drayage: "0",
    receiving: "0",
    miscellaneous: "0",
  });
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const po = eligible.find((item) => item.id === Number(poId));
  async function save() {
    try {
      setSaving(true);
      await apiRequest("/api/supply-management/shipments", "POST", {
        purchaseOrderId: Number(poId),
        origin,
        destination,
        eta: normalizeDateValueForApi(eta) || null,
        carrier: carrier || null,
        trackingNumber: tracking || null,
        actorName,
        costs: Object.fromEntries(
          Object.entries(costs).map(([key, value]) => [key, Number(value)]),
        ),
        lines:
          po?.lines
            .filter((line) => Number(quantities[line.id] ?? 0) > 0)
            .map((line) => ({
              purchaseOrderLineId: line.id,
              quantity: Number(quantities[line.id]),
            })) ?? [],
      });
      await onSaved();
      setPoId("");
      setOrigin("");
      setDestination("Main Warehouse");
      setEta(todayDisplayDate());
      setCarrier("");
      setTracking("");
      setCosts({
        freight: "0",
        customs: "0",
        brokerage: "0",
        drayage: "0",
        receiving: "0",
        miscellaneous: "0",
      });
      setQuantities({});
      onOpenChange(false);
      toast({ title: "Shipment created" });
    } catch (error) {
      toast({
        title: "Unable to create shipment",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add inbound shipment</DialogTitle>
          <DialogDescription>
            Create a shipment from an issued PO and allocate shared landed
            costs.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-4 overflow-auto p-1 md:grid-cols-2">
          <Field label="Purchase order" className="md:col-span-2">
            <Select
              value={poId}
              onValueChange={(value) => {
                setPoId(value);
                setQuantities({});
                const selected = eligible.find(
                  (item) => item.id === Number(value),
                );
                if (selected) setDestination(selected.destination);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select issued PO" />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.poNumber} · {item.vendorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Origin">
            <Input
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
            />
          </Field>
          <Field label="Destination">
            <Input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
          </Field>
          <Field label="ETA">
            <DateTextInput value={eta} onChange={setEta} />
          </Field>
          <Field label="Carrier">
            <Input
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
            />
          </Field>
          <Field label="Tracking number" className="md:col-span-2">
            <Input
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
            />
          </Field>
          {po ? (
            <div className="space-y-2 md:col-span-2">
              <Label>Shipment quantities</Label>
              {po.lines.map((line) => (
                <div
                  key={line.id}
                  className="grid grid-cols-[1fr_120px] items-center gap-3 rounded-lg border p-3"
                >
                  <div>
                    <div className="font-medium">
                      {line.sku} · {line.productName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {line.availableToShipQuantity} available to ship
                    </div>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    max={line.availableToShipQuantity}
                    value={quantities[line.id] ?? ""}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [line.id]: String(
                          Math.min(
                            Number(event.target.value || 0),
                            line.availableToShipQuantity,
                          ),
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div className="md:col-span-2">
            <Label>Shared landed costs</Label>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {Object.entries(costs).map(([key, value]) => (
                <Field key={key} label={statusLabel(key)}>
                  <Input
                    type="number"
                    min="0"
                    step=".01"
                    value={value}
                    onChange={(event) =>
                      setCosts((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              saving ||
              !poId ||
              !origin ||
              !po?.lines.some((line) => Number(quantities[line.id] ?? 0) > 0)
            }
            onClick={save}
          >
            {saving ? "Creating..." : "Create shipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({
  shipment,
  receivedBy,
  onOpenChange,
  onSaved,
}: {
  shipment: Shipment | null;
  receivedBy: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [receiver, setReceiver] = useState(receivedBy);
  const [notes, setNotes] = useState("");
  const [values, setValues] = useState<
    Record<number, { accepted: string; damaged: string; rejected: string }>
  >({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (shipment) {
      setReceiver(receivedBy);
      setNotes("");
      setValues({});
    }
  }, [receivedBy, shipment]);
  const lines =
    shipment?.lines.filter((line) => line.remainingQuantity > 0) ?? [];
  const receiveAll = () =>
    setValues(
      Object.fromEntries(
        lines.map((line) => [
          line.id,
          {
            accepted: String(line.remainingQuantity),
            damaged: "0",
            rejected: "0",
          },
        ]),
      ),
    );
  async function save() {
    if (!shipment) return;
    try {
      setSaving(true);
      await apiRequest(
        `/api/supply-management/shipments/${shipment.id}/receipts`,
        "POST",
        {
          receivedBy: receiver,
          discrepancyNotes: notes || null,
          lines: lines
            .map((line) => {
              const row = values[line.id] ?? {
                accepted: "",
                damaged: "",
                rejected: "",
              };
              return {
                shipmentLineId: line.id,
                acceptedQuantity: Number(row.accepted || 0),
                damagedQuantity: Number(row.damaged || 0),
                rejectedQuantity: Number(row.rejected || 0),
              };
            })
            .filter(
              (line) =>
                line.acceptedQuantity +
                  line.damagedQuantity +
                  line.rejectedQuantity >
                0,
            ),
        },
      );
      await onSaved();
      onOpenChange(false);
      toast({
        title: "Receipt confirmed",
        description: "Inventory and costs were updated.",
      });
    } catch (error) {
      toast({
        title: "Unable to confirm receipt",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }
  const hasQuantity = lines.some((line) => {
    const row = values[line.id];
    return (
      Number(row?.accepted || 0) +
        Number(row?.damaged || 0) +
        Number(row?.rejected || 0) >
      0
    );
  });
  const overReceipt = lines.some((line) => {
    const row = values[line.id];
    return (
      Number(row?.accepted || 0) +
        Number(row?.damaged || 0) +
        Number(row?.rejected || 0) >
      line.remainingQuantity
    );
  });
  return (
    <Dialog open={!!shipment} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Receive {shipment?.shipmentNumber}</DialogTitle>
          <DialogDescription>
            Use Receive full shipment for a clean delivery, or enter only the
            discrepancies.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button variant="outline" onClick={receiveAll}>
            Receive full shipment
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Received by">
            <Input
              value={receiver}
              onChange={(event) => setReceiver(event.target.value)}
            />
          </Field>
          <Field label="Discrepancy notes">
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
        <div className="max-h-[55vh] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Accepted</TableHead>
                <TableHead>Damaged</TableHead>
                <TableHead>Rejected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const row = values[line.id] ?? {
                  accepted: "",
                  damaged: "",
                  rejected: "",
                };
                const set = (key: keyof typeof row, value: string) =>
                  setValues((current) => ({
                    ...current,
                    [line.id]: { ...row, [key]: value },
                  }));
                return (
                  <TableRow key={line.id}>
                    <TableCell>
                      <div className="font-mono">{line.sku}</div>
                      <div className="text-xs text-muted-foreground">
                        {line.productName}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {line.remainingQuantity}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-24"
                        type="number"
                        min="0"
                        value={row.accepted}
                        onChange={(event) =>
                          set("accepted", event.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-24"
                        type="number"
                        min="0"
                        value={row.damaged}
                        onChange={(event) => set("damaged", event.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-24"
                        type="number"
                        min="0"
                        value={row.rejected}
                        onChange={(event) =>
                          set("rejected", event.target.value)
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {overReceipt ? (
          <p className="text-sm text-rose-600">
            A line cannot exceed its remaining shipment quantity.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving || !receiver || !hasQuantity || overReceipt}
            onClick={save}
          >
            {saving ? "Confirming..." : "Confirm receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShipmentUpdateDialog({
  shipment,
  actorName,
  onOpenChange,
  onSaved,
}: {
  shipment: Shipment | null;
  actorName: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    eta: "",
    departureDate: "",
    carrier: "",
    trackingNumber: "",
    containerNumber: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (shipment)
      setForm({
        eta: normalizeDateInputValue(shipment.eta) || todayDisplayDate(),
        departureDate:
          normalizeDateInputValue(shipment.departureDate) || todayDisplayDate(),
        carrier: shipment.carrier ?? "",
        trackingNumber: shipment.trackingNumber ?? "",
        containerNumber: shipment.containerNumber ?? "",
        notes: shipment.notes ?? "",
      });
  }, [shipment]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shipment) return;
    const formData = new FormData(event.currentTarget);
    const read = (key: string) => String(formData.get(key) ?? "").trim();
    try {
      setSaving(true);
      const updated = await apiRequest<
        Pick<
          Shipment,
          | "id"
          | "eta"
          | "departureDate"
          | "carrier"
          | "trackingNumber"
          | "containerNumber"
          | "notes"
          | "status"
        >
      >(
        `/api/supply-management/shipments/${shipment.id}`,
        "PATCH",
        {
          eta: normalizeDateValueForApi(read("eta")) || null,
          departureDate: normalizeDateValueForApi(read("departureDate")) || null,
          carrier: read("carrier") || null,
          trackingNumber: read("trackingNumber") || null,
          containerNumber: read("containerNumber") || null,
          notes: read("notes") || null,
          actorName,
        },
      );
      queryClient.setQueryData<SupplyStore>(
        ["supply-management-v3"],
        (current) =>
          current
            ? {
                ...current,
                shipments: current.shipments.map((row) =>
                  row.id === updated.id ? { ...row, ...updated } : row,
                ),
              }
            : current,
      );
      await onSaved();
      onOpenChange(false);
      toast({ title: "Shipment updated" });
    } catch (error) {
      toast({
        title: "Unable to update shipment",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={!!shipment} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Update {shipment?.shipmentNumber}</DialogTitle>
            <DialogDescription>
              Keep carrier, tracking, departure, and ETA details current.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ETA">
              <DateTextInput
                value={form.eta}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    eta: value,
                  }))
                }
              />
              <input type="hidden" name="eta" value={form.eta} />
            </Field>
            <Field label="Departure">
              <DateTextInput
                value={form.departureDate}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    departureDate: value,
                  }))
                }
              />
              <input
                type="hidden"
                name="departureDate"
                value={form.departureDate}
              />
            </Field>
            <Field label="Carrier">
              <Input
                name="carrier"
                value={form.carrier}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    carrier: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Tracking">
              <Input
                name="trackingNumber"
                value={form.trackingNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    trackingNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Container" className="sm:col-span-2">
              <Input
                name="containerNumber"
                value={form.containerNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    containerNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea
                name="notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save shipment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BillDialog({
  open,
  purchaseOrders,
  actorName,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  purchaseOrders: PurchaseOrder[];
  actorName: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [poId, setPoId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    try {
      setSaving(true);
      await apiRequest("/api/supply-management/vendor-bills", "POST", {
        purchaseOrderId: Number(poId),
        vendorInvoiceNumber: invoice,
        invoiceDate: new Date().toISOString().slice(0, 10),
        amount: Number(amount),
        actorName,
      });
      await onSaved();
      onOpenChange(false);
      toast({ title: "Vendor bill recorded" });
    } catch (error) {
      toast({
        title: "Unable to add bill",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add vendor bill</DialogTitle>
          <DialogDescription>
            The bill is matched against the PO and confirmed receipts.
          </DialogDescription>
        </DialogHeader>
        <Field label="Purchase order">
          <Select value={poId} onValueChange={setPoId}>
            <SelectTrigger>
              <SelectValue placeholder="Select PO" />
            </SelectTrigger>
            <SelectContent>
              {purchaseOrders
                .filter((po) => po.status !== "cancelled")
                .map((po) => (
                  <SelectItem key={po.id} value={String(po.id)}>
                    {po.poNumber} · {po.vendorName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Vendor invoice number">
          <Input
            value={invoice}
            onChange={(event) => setInvoice(event.target.value)}
          />
        </Field>
        <Field label="Invoice amount">
          <Input
            type="number"
            min="0"
            step=".01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving || !poId || !invoice || Number(amount) <= 0}
            onClick={save}
          >
            {saving ? "Matching..." : "Add and match"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VendorDialog({
  open,
  vendor,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  vendor: Vendor | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    vendorCode: "",
    primaryContactName: "",
    email: "",
    phone: "",
    leadTimeDays: "30",
    onTimeDeliveryPct: "100",
    qualityRating: "5",
  });
  useEffect(() => {
    if (open)
      setForm(
        vendor
          ? {
              name: vendor.name,
              vendorCode: vendor.vendorCode,
              primaryContactName: vendor.primaryContactName,
              email: vendor.email,
              phone: vendor.phone ?? "",
              leadTimeDays: String(vendor.leadTimeDays),
              onTimeDeliveryPct: String(vendor.onTimeDeliveryPct),
              qualityRating: String(vendor.qualityRating),
            }
          : {
              name: "",
              vendorCode: "",
              primaryContactName: "",
              email: "",
              phone: "",
              leadTimeDays: "30",
              onTimeDeliveryPct: "100",
              qualityRating: "5",
            },
      );
  }, [open, vendor]);
  async function save() {
    try {
      setSaving(true);
      await apiRequest(
        vendor
          ? `/api/supply-management/vendors/${vendor.id}`
          : "/api/supply-management/vendors",
        vendor ? "PATCH" : "POST",
        {
          ...form,
          phone: form.phone || null,
          leadTimeDays: Number(form.leadTimeDays),
          onTimeDeliveryPct: Number(form.onTimeDeliveryPct),
          qualityRating: Number(form.qualityRating),
        },
      );
      await onSaved();
      onOpenChange(false);
      toast({ title: vendor ? "Vendor updated" : "Vendor created" });
    } catch (error) {
      toast({
        title: "Unable to save vendor",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }
  const valid =
    form.name.trim().length >= 2 &&
    form.vendorCode.trim().length >= 2 &&
    form.primaryContactName.trim().length >= 2 &&
    form.email.includes("@");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit vendor" : "Add vendor"}</DialogTitle>
          <DialogDescription>
            Maintain supplier contact and scorecard inputs.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vendor name">
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
          <Field label="Vendor code">
            <Input
              value={form.vendorCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  vendorCode: event.target.value.toUpperCase(),
                }))
              }
            />
          </Field>
          <Field label="Primary contact">
            <Input
              value={form.primaryContactName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  primaryContactName: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Email">
            <Input
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Lead time (days)">
            <Input
              type="number"
              min="0"
              value={form.leadTimeDays}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  leadTimeDays: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="On-time delivery %">
            <Input
              type="number"
              min="0"
              max="100"
              value={form.onTimeDeliveryPct}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  onTimeDeliveryPct: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Quality rating (0-5)">
            <Input
              type="number"
              min="0"
              max="5"
              value={form.qualityRating}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  qualityRating: event.target.value,
                }))
              }
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || saving} onClick={save}>
            {saving ? "Saving..." : "Save vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InventoryAdjustmentDialog({
  inventory,
  actorName,
  onOpenChange,
  onSaved,
}: {
  inventory: InventoryCost | null;
  actorName: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [countedQuantity, setCountedQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (inventory) {
      setCountedQuantity(String(inventory.onHand));
      setReason("");
    }
  }, [inventory]);
  async function save() {
    if (!inventory) return;
    try {
      setSaving(true);
      await apiRequest("/api/supply-management/inventory-adjustments", "POST", {
        productId: inventory.id,
        countedQuantity: Number(countedQuantity),
        actorName,
        reason,
      });
      await onSaved();
      onOpenChange(false);
      toast({ title: "Inventory adjusted" });
    } catch (error) {
      toast({
        title: "Unable to adjust inventory",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }
  const difference = inventory
    ? Number(countedQuantity || 0) - inventory.onHand
    : 0;
  return (
    <Dialog open={!!inventory} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inventory control · {inventory?.sku}</DialogTitle>
          <DialogDescription>
            Record a cycle count or manual correction with an audit reason.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current on hand">
            <Input disabled value={inventory?.onHand ?? 0} />
          </Field>
          <Field label="Counted quantity">
            <Input
              type="number"
              min="0"
              value={countedQuantity}
              onChange={(event) => setCountedQuantity(event.target.value)}
            />
          </Field>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm sm:col-span-2">
            Adjustment:{" "}
            <span className="font-mono font-semibold">
              {difference > 0 ? "+" : ""}
              {difference}
            </span>
          </div>
          <Field label="Reason" className="sm:col-span-2">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving || difference === 0 || reason.trim().length < 3}
            onClick={save}
          >
            {saving ? "Adjusting..." : "Confirm adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReverseReceiptDialog({
  receipt,
  actorName,
  onOpenChange,
  onSaved,
}: {
  receipt: SupplyReceipt | null;
  actorName: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (receipt) setReason("");
  }, [receipt]);
  async function save() {
    if (!receipt) return;
    try {
      setSaving(true);
      await apiRequest(
        `/api/supply-management/receipts/${receipt.id}/reverse`,
        "POST",
        { actorName, reason },
      );
      await onSaved();
      onOpenChange(false);
      toast({ title: "Receipt reversed" });
    } catch (error) {
      toast({
        title: "Unable to reverse receipt",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={!!receipt} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse {receipt?.receiptNumber}</DialogTitle>
          <DialogDescription>
            This removes accepted units from inventory and reopens the related
            PO quantities.
          </DialogDescription>
        </DialogHeader>
        <Field label="Reason">
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={saving || reason.trim().length < 3}
            onClick={save}
          >
            {saving ? "Reversing..." : "Reverse receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentDialog({
  shipment,
  documents,
  uploadedBy,
  onOpenChange,
  onSaved,
}: {
  shipment: Shipment | null;
  documents: SupplyStore["documents"];
  uploadedBy: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [documentType, setDocumentType] = useState("Packing list");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const shipmentDocuments = documents.filter(
    (document) =>
      document.entityType === "shipment" && document.entityId === shipment?.id,
  );
  async function upload() {
    if (!shipment || !file) return;
    try {
      setUploading(true);
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await apiRequest("/api/supply-management/documents", "POST", {
        entityType: "shipment",
        entityId: shipment.id,
        documentType,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        contentBase64,
        uploadedBy,
      });
      await onSaved();
      setFile(null);
      toast({ title: "Document uploaded" });
    } catch (error) {
      toast({
        title: "Unable to upload document",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }
  return (
    <Dialog open={!!shipment} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Documents · {shipment?.shipmentNumber}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Document type">
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "Commercial invoice",
                  "Packing list",
                  "Bill of lading",
                  "Freight invoice",
                  "Customs paperwork",
                  "Receiving photos",
                ].map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="File">
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
        <div className="space-y-2">
          {shipmentDocuments.map((document) => (
            <div
              key={document.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <div className="font-medium">{document.documentType}</div>
                <div className="text-xs text-muted-foreground">
                  {document.fileName}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(
                    `/api/supply-management/documents/${document.id}`,
                    "_blank",
                  )
                }
              >
                Download
              </Button>
            </div>
          ))}
          {shipmentDocuments.length === 0 ? (
            <Empty label="No shipment documents." />
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button disabled={!file || uploading} onClick={upload}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
