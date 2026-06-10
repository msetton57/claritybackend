import React, { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpDown,
  ArrowUpRight,
  Boxes,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { endOfYear, format, startOfYear, subYears } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  getGetCustomerQueryKey,
  getGetCustomerRevenueDetailQueryKey,
  useGetCustomer,
  useGetCustomerRevenueDetail,
  useGetProducts,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendIndicator } from "@/components/ui/trend-indicator";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { toArray } from "@/lib/array";

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
  loading,
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "blue" | "green" | "amber" | "rose";
  loading: boolean;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };

  return (
    <Card className="border-0 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.5)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
            {loading ? <Skeleton className="mt-3 h-8 w-28" /> : <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>}
          </div>
          <div className={`rounded-xl p-2.5 ${tones[tone]}`}>
            <Icon className="size-5" />
          </div>
        </div>
        <div className="mt-3 min-h-5 text-xs text-muted-foreground">{loading ? <Skeleton className="h-4 w-24" /> : detail}</div>
      </CardContent>
    </Card>
  );
}

function queryDate(name: string, fallback: Date) {
  const value = new URLSearchParams(window.location.search).get(name);
  if (!value) return fallback;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function rangeLabel(range: DateRange | undefined) {
  if (!range?.from) return "Select period";
  if (!range.to) return format(range.from, "MMM d, yyyy");
  return `${format(range.from, "MMM d")} - ${format(range.to, "MMM d, yyyy")}`;
}

function ProductThumbnail({
  imageUrl,
  label,
}: {
  imageUrl?: string | null;
  label: string;
}) {
  if (imageUrl) {
    return <img src={imageUrl} alt={label} className="h-full w-full object-contain bg-white p-1" />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-400">
      <Boxes className="size-4" />
    </div>
  );
}

function ProductDeltaList({
  title,
  description,
  emptyLabel,
  products,
  imageById,
  accent,
}: {
  title: string;
  description: string;
  emptyLabel: string;
  products: Array<{
    productId: number;
    productName: string;
    sku?: string;
    revenue: number;
    previousRevenue: number;
    percentChange: number;
  }>;
  imageById: Map<number, string | null>;
  accent: "emerald" | "rose";
}) {
  const accentClasses = accent === "emerald"
    ? {
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
        delta: "text-emerald-700",
        border: "border-emerald-100",
      }
    : {
        badge: "border-rose-200 bg-rose-50 text-rose-700",
        delta: "text-rose-700",
        border: "border-rose-100",
      };

  return (
    <Card className="border-0 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)]">
      <CardContent className="p-0">
        <div className="border-b px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <Badge className={accentClasses.badge}>{products.length}</Badge>
          </div>
        </div>
        <div className="divide-y">
          {products.length ? products.map((product) => {
            const revenueDelta = product.revenue - product.previousRevenue;
            const imageUrl = imageById.get(product.productId);
            return (
              <div key={product.productId} className={`flex items-start gap-3 px-6 py-4 ${accentClasses.border}`}>
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <ProductThumbnail imageUrl={imageUrl} label={product.productName} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{product.productName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{product.sku || "No SKU"}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-sm font-semibold ${accentClasses.delta}`}>
                        {revenueDelta > 0 ? "+" : ""}{formatCurrency(revenueDelta)}
                      </p>
                      <TrendIndicator value={product.percentChange} className="justify-end text-xs" />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Now {formatCurrency(product.revenue)}</span>
                    <span>Before {formatCurrency(product.previousRevenue)}</span>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="px-6 py-10 text-sm text-muted-foreground">{emptyLabel}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerDetail() {
  const { customerId } = useParams();
  const id = parseInt(customerId || "0", 10);
  const [date, setDate] = useState<DateRange | undefined>({
    from: queryDate("startDate", startOfYear(new Date())),
    to: queryDate("endDate", endOfYear(new Date())),
  });
  const [comparisonDate, setComparisonDate] = useState<DateRange | undefined>({
    from: queryDate("compareStartDate", startOfYear(subYears(new Date(), 1))),
    to: queryDate("compareEndDate", endOfYear(subYears(new Date(), 1))),
  });

  const startDate = date?.from ? format(date.from, "yyyy-MM-dd") : format(startOfYear(new Date()), "yyyy-MM-dd");
  const endDate = date?.to ? format(date.to, "yyyy-MM-dd") : format(endOfYear(new Date()), "yyyy-MM-dd");
  const compareStartDate = comparisonDate?.from ? format(comparisonDate.from, "yyyy-MM-dd") : format(startOfYear(subYears(new Date(), 1)), "yyyy-MM-dd");
  const compareEndDate = comparisonDate?.to ? format(comparisonDate.to, "yyyy-MM-dd") : format(endOfYear(subYears(new Date(), 1)), "yyyy-MM-dd");
  const comparisonQuery = new URLSearchParams({ startDate, endDate, compareStartDate, compareEndDate }).toString();

  const { data: customer, isLoading: customerLoading } = useGetCustomer(id, {
    query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) },
  });
  const { data: report, isLoading: reportLoading } = useGetCustomerRevenueDetail(
    { customerId: id, startDate, endDate, compareStartDate, compareEndDate },
    { query: { enabled: !!id, queryKey: getGetCustomerRevenueDetailQueryKey({ customerId: id, startDate, endDate, compareStartDate, compareEndDate }) } },
  );
  const { data: products } = useGetProducts({});

  const productImageById = useMemo(
    () =>
      new Map(toArray(products).map((product) => [product.id, product.imageUrl ?? null])),
    [products],
  );

  const productRows = useMemo(
    () => [...toArray(report?.products)].sort((a, b) => b.revenue - a.revenue),
    [report?.products],
  );
  const invoices = useMemo(
    () => [...toArray(customer?.invoices)].sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()),
    [customer?.invoices],
  );
  const openInvoices = invoices.filter((invoice) => !invoice.isPaid);
  const currentProducts = productRows.filter((product) => product.revenue > 0);
  const topProduct = currentProducts[0];
  const decliningProducts = productRows
    .filter((product) => product.revenue - product.previousRevenue < 0)
    .sort((a, b) => (a.revenue - a.previousRevenue) - (b.revenue - b.previousRevenue));
  const growingProducts = productRows
    .filter((product) => product.revenue - product.previousRevenue > 0)
    .sort((a, b) => (b.revenue - b.previousRevenue) - (a.revenue - a.previousRevenue));
  const churnedProducts = productRows.filter((product) => product.previousRevenue > 0 && product.revenue === 0);
  const newProducts = productRows.filter((product) => product.previousRevenue === 0 && product.revenue > 0);
  const focusProducts = useMemo(() => {
    const seen = new Set<number>();
    return [...decliningProducts, ...growingProducts]
      .filter((product) => {
        if (seen.has(product.productId)) return false;
        seen.add(product.productId);
        return true;
      })
      .slice(0, 8);
  }, [decliningProducts, growingProducts]);

  const accountHealth = customer?.isPastDue
    ? { label: "Needs attention", className: "border-rose-200 bg-rose-50 text-rose-700", icon: AlertCircle }
    : customer?.arBalance
      ? { label: "Healthy, balance open", className: "border-amber-200 bg-amber-50 text-amber-700", icon: ShieldCheck }
      : { label: "In good standing", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 };
  const HealthIcon = accountHealth.icon;

  return (
    <AppLayout fluid>
      <div className="mx-auto flex w-full max-w-[1820px] flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <Link href={`/reports/customers?${comparisonQuery}`} className="inline-flex items-center gap-2 self-start text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Customer comparison
          </Link>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Primary period</p>
              <DatePickerWithRange date={date} setDate={setDate} className="[&_button]:w-full sm:[&_button]:w-[270px]" />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="mb-0.5"
              aria-label="Swap comparison periods"
              onClick={() => {
                setDate(comparisonDate);
                setComparisonDate(date);
              }}
            >
              <ArrowUpDown className="size-4" />
            </Button>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Compare with</p>
              <DatePickerWithRange date={comparisonDate} setDate={setComparisonDate} className="[&_button]:w-full sm:[&_button]:w-[270px]" />
            </div>
          </div>
        </div>

        <section className="relative overflow-hidden rounded-2xl bg-[#10233f] px-6 py-7 text-white shadow-[0_22px_60px_-30px_rgba(15,35,63,0.8)] md:px-8">
          <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-blue-400/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-1/3 h-28 w-80 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden rounded-2xl border border-white/10 bg-white/10 p-3.5 sm:block">
                <Building2 className="size-7 text-blue-100" />
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className={`gap-1.5 border ${accountHealth.className}`}>
                    <HealthIcon className="size-3.5" />
                    {accountHealth.label}
                  </Badge>
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-blue-200">Account brief</span>
                </div>
                {customerLoading ? (
                  <Skeleton className="h-11 w-72 bg-white/15" />
                ) : (
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{customer?.name || "Customer"}</h1>
                )}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
                  {customer?.repName ? <span className="inline-flex items-center gap-2"><UserRound className="size-4" /> {customer.repName}</span> : null}
                  {customer?.email ? <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-2 hover:text-white"><Mail className="size-4" /> {customer.email}</a> : null}
                  {customer?.phone ? <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-2 hover:text-white"><Phone className="size-4" /> {customer.phone}</a> : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-white/15 bg-white/10 text-white shadow-none hover:bg-white/15">
                <Link href={`/customers/${id}`}>
                  View CRM profile
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
              <Button asChild className="border-blue-300 bg-blue-400 text-slate-950 hover:bg-blue-300">
                <Link href={`/orders/new?customerId=${id}`}>Create order</Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Period revenue"
            value={formatCompactCurrency(report?.totalRevenue || 0)}
            detail={<TrendIndicator value={report?.percentChange || 0} />}
            icon={CircleDollarSign}
            tone={(report?.percentChange || 0) >= 0 ? "green" : "rose"}
            loading={reportLoading}
          />
          <MetricCard
            label="Comparison period"
            value={formatCompactCurrency(report?.previousRevenue || 0)}
            detail={rangeLabel(comparisonDate)}
            icon={CalendarDays}
            loading={reportLoading}
          />
          <MetricCard
            label="Products bought"
            value={String(currentProducts.length)}
            detail={`${productRows.reduce((sum, product) => sum + product.unitsSold, 0)} units in period`}
            icon={Boxes}
            tone="blue"
            loading={reportLoading}
          />
          <MetricCard
            label="Products down"
            value={String(decliningProducts.length)}
            detail={decliningProducts[0] ? `${decliningProducts[0].productName} fell the most` : "No product declines in this comparison"}
            icon={ArrowDownRight}
            tone={decliningProducts.length ? "rose" : "green"}
            loading={reportLoading}
          />
          <MetricCard
            label="Products up"
            value={String(growingProducts.length)}
            detail={growingProducts[0] ? `${growingProducts[0].productName} gained the most` : "No product gains in this comparison"}
            icon={ArrowUpRight}
            tone={growingProducts.length ? "green" : "blue"}
            loading={reportLoading}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="overflow-hidden border-0 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)]">
            <CardContent className="p-0">
              <div className="border-b px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Comparison focus</p>
                    <h2 className="mt-1 text-xl font-semibold">What changed by product</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="font-mono">{rangeLabel(date)}</Badge>
                    <span className="text-muted-foreground">vs</span>
                    <Badge variant="outline" className="font-mono">{rangeLabel(comparisonDate)}</Badge>
                  </div>
                </div>
              </div>
              <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
                <div className="p-6">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Sparkles className="size-5" /></div>
                  <p className="text-sm font-semibold">Top product now</p>
                  <p className="mt-2 text-lg font-bold">{topProduct?.productName || "No primary-period sales"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {topProduct ? `${formatCurrency(topProduct.revenue)} · ${Math.round((topProduct.revenue / Math.max(report?.totalRevenue || 1, 1)) * 100)}% of period revenue` : "The comparison below shows which products stopped contributing."}
                  </p>
                </div>
                <div className="p-6">
                  <div className={`mb-4 flex size-10 items-center justify-center rounded-xl ${decliningProducts.length ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {decliningProducts.length ? <ArrowDownRight className="size-5" /> : <ArrowUpRight className="size-5" />}
                  </div>
                  <p className="text-sm font-semibold">Biggest drop</p>
                  <p className="mt-2 text-lg font-bold">{decliningProducts.length ? `${decliningProducts.length} declining` : "No declines detected"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {decliningProducts.length ? `${decliningProducts[0].productName} dropped ${formatCurrency(Math.abs(decliningProducts[0].revenue - decliningProducts[0].previousRevenue))} versus the comparison period.` : "Current purchased products are stable or growing."}
                  </p>
                </div>
                <div className="p-6">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ArrowUpRight className="size-5" /></div>
                  <p className="text-sm font-semibold">Biggest gain</p>
                  <p className="mt-2 text-lg font-bold">{growingProducts.length ? `${growingProducts.length} growing` : "No gains detected"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {growingProducts.length ? `${growingProducts[0].productName} added ${formatCurrency(growingProducts[0].revenue - growingProducts[0].previousRevenue)} versus the comparison period.` : "No products expanded in the selected window."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Next step</p>
                  <p className="mt-1 text-2xl font-bold">Open the CRM record</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Jump into the full account profile when you want contacts, notes, tasks, invoice detail, or the wider relationship context.
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><ExternalLink className="size-6" /></div>
              </div>
              <div className="mt-6 space-y-3">
                <Button asChild className="w-full justify-between">
                  <Link href={`/customers/${id}`}>
                    View in CRM
                    <ExternalLink className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link href={`/orders/new?customerId=${id}`}>
                    Create order
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-5">
                <div>
                  <p className="text-xs text-muted-foreground">New this period</p>
                  <p className="mt-1 font-mono text-sm font-semibold">{newProducts.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stopped buying</p>
                  <p className="mt-1 font-mono text-sm font-semibold">{churnedProducts.length}</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
                <span className="text-muted-foreground">Open invoices</span>
                <span className="font-medium">{openInvoices.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <ProductDeltaList
            title="Products declined"
            description="Revenue down versus the comparison period, including products that dropped to zero."
            emptyLabel="No products declined in this comparison."
            products={decliningProducts.slice(0, 6)}
            imageById={productImageById}
            accent="rose"
          />
          <ProductDeltaList
            title="Products increased"
            description="Revenue up versus the comparison period, including newly purchased products."
            emptyLabel="No products increased in this comparison."
            products={growingProducts.slice(0, 6)}
            imageById={productImageById}
            accent="emerald"
          />
        </div>

        <Card className="overflow-hidden border-0 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)]">
          <CardContent className="p-0">
            <div className="border-b px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Quick compare summary</h2>
                  <p className="mt-1 text-sm text-muted-foreground">A compact view of the products driving the biggest changes.</p>
                </div>
                <Badge variant="outline">{productRows.length} compared products</Badge>
              </div>
            </div>
            <div className="grid gap-4 px-6 py-5 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Stopped buying</p>
                <p className="mt-2 text-2xl font-bold">{churnedProducts.length}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {churnedProducts[0] ? `${churnedProducts[0].productName} is now at $0 in the current period.` : "No products fully dropped out."}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Newly added</p>
                <p className="mt-2 text-2xl font-bold">{newProducts.length}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {newProducts[0] ? `${newProducts[0].productName} was not purchased in the comparison period.` : "No brand-new product wins in this window."}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Most movement</p>
                <p className="mt-2 text-2xl font-bold">{focusProducts.length}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {focusProducts[0] ? `${focusProducts[0].productName} is one of the strongest drivers of change.` : "No product movement detected yet."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
