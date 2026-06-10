import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Download,
  Package,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { useGetCustomerRevenueReport, useGetProducts } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { toArray } from "@/lib/array";
import { cn } from "@/lib/utils";

type Preset = "month" | "last_month" | "quarter" | "year" | "last_30" | "custom";
type ChartMetric = "revenue" | "orderCount";

interface ReportSummary {
  revenue: number;
  orderCount: number;
  customerCount: number;
  unitsSold: number;
  averageOrderValue: number;
}

interface ReportPoint {
  date: string;
  revenue: number;
  orderCount: number;
}

interface ProductRow {
  productId: number;
  productName: string;
  sku: string;
  category: string;
  revenue: number;
  unitsSold: number;
  orderCount: number;
}

interface ReportPeriod {
  summary: ReportSummary;
  trend: ReportPoint[];
  products: ProductRow[];
}

interface ReportOverview {
  bucket: "day" | "week" | "month";
  current: ReportPeriod;
  comparison: ReportPeriod | null;
}

const presetRange = (preset: Preset, now = new Date()) => {
  switch (preset) {
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case "quarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "year":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "last_30":
      return { from: subDays(now, 29), to: now };
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
};

function comparisonRange(from: Date, to: Date) {
  const duration = to.getTime() - from.getTime();
  const compareTo = subDays(from, 1);
  return { from: new Date(compareTo.getTime() - duration), to: compareTo };
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function metricFormat(metric: ChartMetric, value: number) {
  return metric === "revenue" ? formatCompactCurrency(value) : value.toLocaleString();
}

function MetricCard({
  label,
  value,
  icon: Icon,
  comparison,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  comparison?: number;
  loading: boolean;
}) {
  return (
    <Card className="border-0 shadow-[0_14px_40px_-30px_rgba(15,23,42,0.55)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            {loading ? <Skeleton className="mt-3 h-9 w-28" /> : <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>}
          </div>
          <div className="rounded-xl bg-primary/8 p-2.5 text-primary"><Icon className="size-5" /></div>
        </div>
        {comparison !== undefined ? (
          <div className={`mt-3 text-xs font-semibold ${comparison >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {comparison >= 0 ? "+" : ""}{comparison.toFixed(1)}% vs comparison
          </div>
        ) : <div className="mt-3 text-xs text-muted-foreground">Selected period</div>}
      </CardContent>
    </Card>
  );
}

function ProductCombobox({
  products,
  selectedProductId,
  onSelect,
  loading,
}: {
  products: Array<{ id: number; name: string; sku: string }>;
  selectedProductId: number | null;
  onSelect: (productId: number | null) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-white/10 bg-white/10 text-white hover:bg-white/15"
        >
          <span className="min-w-0 truncate text-left">
            {selectedProduct ? selectedProduct.sku : loading ? "Loading products..." : "All products"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(34rem,var(--radix-popover-trigger-width))] p-0"
        sideOffset={6}
      >
        <Command shouldFilter>
          <CommandInput placeholder="Search by SKU or product name..." />
          <CommandList className="max-h-80">
            <CommandItem
              value="all products company overview"
              onSelect={() => {
                onSelect(null);
                setOpen(false);
              }}
            >
              <Check className={cn("mr-2 size-4", selectedProductId === null ? "opacity-100" : "opacity-0")} />
              <div className="min-w-0">
                <div className="font-medium">All products</div>
                <div className="text-xs text-muted-foreground">Company-wide overview</div>
              </div>
            </CommandItem>
            <CommandEmpty>No matching products.</CommandEmpty>
            {products.map((product) => (
              <CommandItem
                key={product.id}
                value={`${product.sku} ${product.name}`}
                onSelect={() => {
                  onSelect(product.id);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 size-4", selectedProductId === product.id ? "opacity-100" : "opacity-0")} />
                <div className="min-w-0">
                  <div className="truncate font-medium">{product.sku}</div>
                  <div className="truncate text-xs text-muted-foreground">{product.name}</div>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function RevenueTrends() {
  const initial = presetRange("month");
  const initialComparison = comparisonRange(initial.from, initial.to);
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareFrom, setCompareFrom] = useState(initialComparison.from);
  const [compareTo, setCompareTo] = useState(initialComparison.to);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("revenue");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const { data: products = [], isLoading: productsLoading } = useGetProducts();

  const setRangePreset = (nextPreset: Preset) => {
    setPreset(nextPreset);
    if (nextPreset === "custom") return;
    const next = presetRange(nextPreset);
    const nextComparison = comparisonRange(next.from, next.to);
    setFrom(next.from);
    setTo(next.to);
    setCompareFrom(nextComparison.from);
    setCompareTo(nextComparison.to);
  };

  const startDate = format(from, "yyyy-MM-dd");
  const endDate = format(to, "yyyy-MM-dd");
  const compareStartDate = format(compareFrom, "yyyy-MM-dd");
  const compareEndDate = format(compareTo, "yyyy-MM-dd");
  const reportParams = new URLSearchParams({ startDate, endDate });
  if (selectedProductId) {
    reportParams.set("productId", String(selectedProductId));
  }
  if (compareEnabled) {
    reportParams.set("compareStartDate", compareStartDate);
    reportParams.set("compareEndDate", compareEndDate);
  }

  const { data: report, isLoading } = useQuery<ReportOverview>({
    queryKey: ["report-overview", startDate, endDate, selectedProductId, compareEnabled, compareStartDate, compareEndDate],
    queryFn: async () => {
      const response = await fetch(`/api/reports/overview?${reportParams.toString()}`);
      if (!response.ok) throw new Error("Unable to load report");
      return response.json();
    },
  });

  const { data: customers, isLoading: customersLoading } = useGetCustomerRevenueReport({
    startDate,
    endDate,
    ...(selectedProductId ? { productId: selectedProductId } : {}),
    ...(compareEnabled ? { compareStartDate, compareEndDate } : {}),
  });
  const customerRows = toArray(customers).filter((row) => row.totalRevenue > 0).slice(0, 8);
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;

  const chartData = useMemo(() => {
    const current = report?.current.trend ?? [];
    const comparison = report?.comparison?.trend ?? [];
    return current.map((point, index) => ({
      ...point,
      comparison: comparison[index]?.[chartMetric] ?? null,
      comparisonDate: comparison[index]?.date,
    }));
  }, [chartMetric, report]);

  const summary = report?.current.summary;
  const previous = report?.comparison?.summary;
  const maxProductRevenue = report?.current.products[0]?.revenue || 1;
  const periodLabel = `${format(from, "MMM d, yyyy")} - ${format(to, "MMM d, yyyy")}`;
  const scopeLabel = selectedProduct ? selectedProduct.sku : "All products";
  const scopeSubLabel = selectedProduct ? selectedProduct.name : "Company-wide overview";

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ["Product", "SKU", "Category", "Revenue", "Units sold", "Orders"],
      ...report.current.products.map((product) => [
        product.productName,
        product.sku,
        product.category,
        product.revenue,
        product.unitsSold,
        product.orderCount,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sales-report-${startDate}-${endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout fluid>
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-5">
        <section className="relative overflow-hidden rounded-3xl bg-[#0d203a] px-6 py-7 text-white shadow-[0_24px_65px_-32px_rgba(13,32,58,0.9)] md:px-8">
          <div className="pointer-events-none absolute -right-20 -top-28 size-96 rounded-full bg-blue-400/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-blue-300/40 to-transparent" />
          <div className="relative flex flex-col gap-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
                  <Sparkles className="size-4" /> Sales intelligence
                </div>
                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Reports</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Explore revenue, order activity, product performance, and customer concentration for any period.
                </p>
                <div className="mt-3 max-w-2xl rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-blue-100">Reference: {scopeLabel}</p>
                  <p className="truncate text-xs text-slate-300">{scopeSubLabel}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={exportCsv} disabled={!report} variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/15">
                  <Download className="size-4" /> Export product data
                </Button>
                <Link href="/tasks"><Button variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/15">Create follow-up task</Button></Link>
                <Link href="/customers"><Button variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/15">Open customer hub</Button></Link>
                <Link href="/ar"><Button variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/15">Open collections</Button></Link>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[180px_240px_minmax(0,1fr)_auto] xl:items-end">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-200">Report period</span>
                <Select value={preset} onValueChange={(value) => setRangePreset(value as Preset)}>
                  <SelectTrigger className="border-white/10 bg-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">This month</SelectItem>
                    <SelectItem value="last_month">Last month</SelectItem>
                    <SelectItem value="last_30">Last 30 days</SelectItem>
                    <SelectItem value="quarter">This quarter</SelectItem>
                    <SelectItem value="year">This year</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-200">Product focus</span>
                <ProductCombobox
                  products={products}
                  selectedProductId={selectedProductId}
                  onSelect={setSelectedProductId}
                  loading={productsLoading}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-200">Start date</span>
                  <Input type="date" value={startDate} onChange={(event) => { setPreset("custom"); setFrom(new Date(`${event.target.value}T12:00:00`)); }} className="border-white/10 bg-white/10 text-white [color-scheme:dark]" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-200">End date</span>
                  <Input type="date" value={endDate} onChange={(event) => { setPreset("custom"); setTo(new Date(`${event.target.value}T12:00:00`)); }} className="border-white/10 bg-white/10 text-white [color-scheme:dark]" />
                </label>
              </div>
              <div className="flex h-10 items-center gap-3 rounded-xl border border-white/10 bg-white/8 px-4">
                <Switch checked={compareEnabled} onCheckedChange={setCompareEnabled} className="data-[state=unchecked]:bg-white/25" />
                <span className="whitespace-nowrap text-sm font-medium">Compare periods</span>
              </div>
            </div>

            {compareEnabled ? (
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/6 p-4 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
                <div className="pb-2 text-xs font-semibold uppercase tracking-[0.15em] text-blue-200">Compare with</div>
                <Input type="date" value={compareStartDate} onChange={(event) => setCompareFrom(new Date(`${event.target.value}T12:00:00`))} className="border-white/10 bg-white/10 text-white [color-scheme:dark]" />
                <Input type="date" value={compareEndDate} onChange={(event) => setCompareTo(new Date(`${event.target.value}T12:00:00`))} className="border-white/10 bg-white/10 text-white [color-scheme:dark]" />
              </div>
            ) : null}
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Net revenue" value={formatCompactCurrency(summary?.revenue ?? 0)} icon={CircleDollarSign} loading={isLoading} comparison={previous ? percentChange(summary?.revenue ?? 0, previous.revenue) : undefined} />
          <MetricCard label="Orders" value={(summary?.orderCount ?? 0).toLocaleString()} icon={ReceiptText} loading={isLoading} comparison={previous ? percentChange(summary?.orderCount ?? 0, previous.orderCount) : undefined} />
          <MetricCard label="Average order" value={formatCompactCurrency(summary?.averageOrderValue ?? 0)} icon={TrendingUp} loading={isLoading} comparison={previous ? percentChange(summary?.averageOrderValue ?? 0, previous.averageOrderValue) : undefined} />
          <MetricCard label="Units sold" value={(summary?.unitsSold ?? 0).toLocaleString()} icon={Package} loading={isLoading} comparison={previous ? percentChange(summary?.unitsSold ?? 0, previous.unitsSold) : undefined} />
          <MetricCard label="Active customers" value={(summary?.customerCount ?? 0).toLocaleString()} icon={Users} loading={isLoading} comparison={previous ? percentChange(summary?.customerCount ?? 0, previous.customerCount) : undefined} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
          <Card className="overflow-hidden border-0 shadow-[0_14px_45px_-32px_rgba(15,23,42,0.6)]">
            <div className="flex flex-col gap-3 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <div className="flex items-center gap-2"><BarChart3 className="size-5 text-primary" /><h2 className="text-xl font-semibold">Performance trend</h2></div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{scopeLabel} · {periodLabel}</p>
              </div>
              <Select value={chartMetric} onValueChange={(value) => setChartMetric(value as ChartMetric)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="revenue">Revenue</SelectItem><SelectItem value="orderCount">Orders</SelectItem></SelectContent>
              </Select>
            </div>
            <CardContent className="p-4 sm:p-6">
              {isLoading ? <Skeleton className="h-[330px] w-full" /> : chartData.length ? (
                <div className="h-[330px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="report-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => format(new Date(`${value}T12:00:00`), report?.bucket === "month" ? "MMM" : "MMM d")} minTickGap={28} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => metricFormat(chartMetric, value)} width={58} />
                      <Tooltip formatter={(value) => metricFormat(chartMetric, Number(value))} labelFormatter={(value) => format(new Date(`${value}T12:00:00`), "MMM d, yyyy")} />
                      {compareEnabled ? <Area type="monotone" dataKey="comparison" name="Comparison" stroke="#94a3b8" fill="transparent" strokeDasharray="5 5" strokeWidth={2} /> : null}
                      <Area type="monotone" dataKey={chartMetric} name={chartMetric === "revenue" ? "Revenue" : "Orders"} stroke="hsl(var(--primary))" fill="url(#report-fill)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="flex h-[330px] items-center justify-center text-sm text-muted-foreground">No activity in this period.</div>}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-[0_14px_45px_-32px_rgba(15,23,42,0.6)]">
            <div className="border-b px-5 py-5 sm:px-6">
              <div className="flex items-center gap-2"><Package className="size-5 text-primary" /><h2 className="text-xl font-semibold">{selectedProduct ? "Selected product" : "Top products"}</h2></div>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedProduct ? "Focused performance for the product you selected." : "Ranked by revenue in this period."}
              </p>
            </div>
            <CardContent className="space-y-5 p-5 sm:p-6">
              {isLoading ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />) : selectedProduct ? (
                report?.current.products[0] ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-lg font-semibold">{report.current.products[0].productName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{report.current.products[0].sku} · {report.current.products[0].category}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Revenue</p>
                        <p className="mt-2 text-xl font-bold">{formatCompactCurrency(report.current.products[0].revenue)}</p>
                      </div>
                      <div className="rounded-2xl border p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Units sold</p>
                        <p className="mt-2 text-xl font-bold">{report.current.products[0].unitsSold.toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl border p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Orders</p>
                        <p className="mt-2 text-xl font-bold">{report.current.products[0].orderCount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ) : <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No sales for this product in the selected period.</div>
              ) : report?.current.products.slice(0, 6).map((product, index) => (
                <div key={product.productId}>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
                      <div className="min-w-0"><p className="truncate text-sm font-semibold">{product.productName}</p><p className="text-xs text-muted-foreground">{product.unitsSold.toLocaleString()} units · {product.category}</p></div>
                    </div>
                    <span className="whitespace-nowrap text-sm font-semibold">{formatCompactCurrency(product.revenue)}</span>
                  </div>
                  <div className="ml-10 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (product.revenue / maxProductRevenue) * 100)}%` }} /></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-0 shadow-[0_14px_45px_-32px_rgba(15,23,42,0.6)]">
          <div className="flex flex-col gap-3 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="flex items-center gap-2"><Users className="size-5 text-primary" /><h2 className="text-xl font-semibold">Top customers</h2></div>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedProduct ? `Customers buying ${selectedProduct.sku} in the selected period.` : "Your highest-value accounts for the selected period."}
              </p>
            </div>
            <Link href="/reports/customers"><Button variant="outline">Open customer revenue <ArrowRight className="size-4" /></Button></Link>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80"><TableRow><TableHead className="min-w-[260px]">Customer</TableHead><TableHead>Sales rep</TableHead><TableHead className="text-right">Products</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Share</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
              <TableBody>
                {customersLoading ? Array.from({ length: 5 }).map((_, index) => <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-7 w-full" /></TableCell></TableRow>) : customerRows.length ? customerRows.map((customer, index) => (
                  <TableRow key={customer.customerId}>
                    <TableCell><Link href={`/reports/customer/${customer.customerId}`} className="flex items-center gap-3 font-semibold hover:text-primary"><span className="flex size-8 items-center justify-center rounded-lg bg-primary/8 text-xs text-primary">{index + 1}</span>{customer.customerName}</Link></TableCell>
                    <TableCell className="text-muted-foreground">{customer.repName || "Unassigned"}</TableCell>
                    <TableCell className="text-right">{customer.productCount}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatCurrency(customer.totalRevenue)}</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary">{summary?.revenue ? ((customer.totalRevenue / summary.revenue) * 100).toFixed(1) : "0.0"}%</Badge></TableCell>
                    <TableCell><Link href={`/reports/customer/${customer.customerId}`}><ChevronRight className="size-4 text-muted-foreground" /></Link></TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No customer revenue in this period.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </Card>

        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><CalendarDays className="size-3.5" /> Report data reflects non-cancelled orders from {periodLabel}{selectedProduct ? ` for ${selectedProduct.sku}` : ""}.</div>
      </div>
    </AppLayout>
  );
}
