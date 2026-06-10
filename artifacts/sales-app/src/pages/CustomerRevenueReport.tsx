import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  CircleDollarSign,
  Search,
  Sparkles,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useGetCustomerRevenueReport } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendIndicator } from "@/components/ui/trend-indicator";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { toArray } from "@/lib/array";

type CustomerFilter = "all" | "growing" | "declining" | "inactive";

const FILTERS: Array<{ value: CustomerFilter; label: string }> = [
  { value: "all", label: "All customers" },
  { value: "growing", label: "Growing" },
  { value: "declining", label: "Declining" },
  { value: "inactive", label: "No revenue" },
];

function rangeLabel(range: DateRange | undefined) {
  if (!range?.from) return "Select period";
  if (!range.to) return format(range.from, "MMM d, yyyy");
  return `${format(range.from, "MMM d")} - ${format(range.to, "MMM d, yyyy")}`;
}

function queryDate(name: string, fallback: Date) {
  const value = new URLSearchParams(window.location.search).get(name);
  if (!value) return fallback;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function parseDateInput(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

interface PeriodDateInputsProps {
  date: DateRange | undefined;
  setDate: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
  idPrefix: string;
}

function PeriodDateInputs({ date, setDate, idPrefix }: PeriodDateInputsProps) {
  const updateDate = (key: "from" | "to", value: string) => {
    const parsed = parseDateInput(value);
    if (!parsed) return;
    setDate((current) => (
      key === "from"
        ? { from: parsed, to: current?.to }
        : { from: current?.from ?? parsed, to: parsed }
    ));
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/6 p-3 shadow-[0_10px_30px_-24px_rgba(15,35,63,0.75)] backdrop-blur-sm sm:grid-cols-2">
      <label htmlFor={`${idPrefix}-start`} className="grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100/90">Start date</span>
        <Input
          id={`${idPrefix}-start`}
          type="date"
          value={date?.from ? format(date.from, "yyyy-MM-dd") : ""}
          onChange={(event) => updateDate("from", event.target.value)}
          className="w-full rounded-xl border-white/10 bg-white/10 text-white shadow-none [color-scheme:dark] placeholder:text-slate-400 focus-visible:ring-blue-200/40"
        />
      </label>
      <label htmlFor={`${idPrefix}-end`} className="grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100/90">End date</span>
        <Input
          id={`${idPrefix}-end`}
          type="date"
          value={date?.to ? format(date.to, "yyyy-MM-dd") : ""}
          onChange={(event) => updateDate("to", event.target.value)}
          className="w-full rounded-xl border-white/10 bg-white/10 text-white shadow-none [color-scheme:dark] placeholder:text-slate-400 focus-visible:ring-blue-200/40"
        />
      </label>
    </div>
  );
}

export default function CustomerRevenueReport() {
  const now = new Date();
  const [primaryPeriod, setPrimaryPeriod] = useState<DateRange | undefined>({
    from: queryDate("startDate", startOfMonth(now)),
    to: queryDate("endDate", endOfMonth(now)),
  });
  const [comparisonPeriod, setComparisonPeriod] = useState<DateRange | undefined>({
    from: queryDate("compareStartDate", startOfMonth(subMonths(now, 1))),
    to: queryDate("compareEndDate", endOfMonth(subMonths(now, 1))),
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>("all");

  const startDate = format(primaryPeriod?.from || startOfMonth(now), "yyyy-MM-dd");
  const endDate = format(primaryPeriod?.to || endOfMonth(now), "yyyy-MM-dd");
  const compareStartDate = format(comparisonPeriod?.from || startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const compareEndDate = format(comparisonPeriod?.to || endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

  const { data, isLoading } = useGetCustomerRevenueReport({
    startDate,
    endDate,
    compareStartDate,
    compareEndDate,
  });
  const rows = toArray(data);

  const metrics = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.primaryRevenue += row.totalRevenue;
        acc.comparisonRevenue += row.previousRevenue;
        if (row.totalRevenue === 0 && row.previousRevenue > 0) acc.inactive += 1;
        else if (row.totalRevenue > row.previousRevenue) acc.growing += 1;
        else if (row.totalRevenue < row.previousRevenue) acc.declining += 1;
        return acc;
      },
      { primaryRevenue: 0, comparisonRevenue: 0, growing: 0, declining: 0, inactive: 0 },
    );
  }, [rows]);

  const revenueDelta = metrics.primaryRevenue - metrics.comparisonRevenue;
  const revenuePercent = metrics.comparisonRevenue === 0
    ? metrics.primaryRevenue > 0 ? 100 : 0
    : (revenueDelta / metrics.comparisonRevenue) * 100;

  const visibleRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return [...rows]
      .filter((row) => {
        if (normalizedSearch && !`${row.customerName} ${row.repName || ""}`.toLowerCase().includes(normalizedSearch)) return false;
        if (filter === "growing") return row.totalRevenue > row.previousRevenue;
        if (filter === "declining") return row.totalRevenue < row.previousRevenue && row.totalRevenue > 0;
        if (filter === "inactive") return row.totalRevenue === 0 && row.previousRevenue > 0;
        return true;
      })
      .sort((a, b) => (b.totalRevenue - b.previousRevenue) - (a.totalRevenue - a.previousRevenue));
  }, [filter, rows, search]);

  const detailQuery = new URLSearchParams({
    startDate,
    endDate,
    compareStartDate,
    compareEndDate,
  }).toString();

  const swapPeriods = () => {
    setPrimaryPeriod(comparisonPeriod);
    setComparisonPeriod(primaryPeriod);
  };

  return (
    <AppLayout fluid>
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-5">
        <section className="relative overflow-hidden rounded-2xl bg-[#10233f] px-6 py-7 text-white shadow-[0_22px_60px_-30px_rgba(15,35,63,0.8)] md:px-8">
          <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-blue-400/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                <Sparkles className="size-4" />
                Customer intelligence
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Compare customer revenue</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Compare any two periods, find the accounts driving the change, then open a customer for the same product-level comparison.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Primary period</p>
                <PeriodDateInputs date={primaryPeriod} setDate={setPrimaryPeriod} idPrefix="primary-period" />
              </div>
              <Button variant="outline" size="icon" onClick={swapPeriods} className="mx-auto h-11 w-11 rounded-full border-white/15 bg-white/10 text-white shadow-none transition-transform hover:-translate-y-0.5 hover:bg-white/15 lg:mb-3" aria-label="Swap comparison periods">
                <ArrowUpDown className="size-4" />
              </Button>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Compare with</p>
                <PeriodDateInputs date={comparisonPeriod} setDate={setComparisonPeriod} idPrefix="comparison-period" />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="overflow-hidden border-0 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.5)] sm:col-span-2">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Revenue movement</p>
                  {isLoading ? <Skeleton className="mt-3 h-10 w-40" /> : <p className="mt-2 text-3xl font-bold tracking-tight">{formatCompactCurrency(revenueDelta)}</p>}
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <TrendIndicator value={revenuePercent} />
                    <span className="text-muted-foreground">between selected periods</span>
                  </div>
                </div>
                <div className={`rounded-2xl p-3 ${revenueDelta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {revenueDelta >= 0 ? <ArrowUpRight className="size-6" /> : <ArrowDownRight className="size-6" />}
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-5">
                <div>
                  <p className="text-xs text-muted-foreground">{rangeLabel(primaryPeriod)}</p>
                  <p className="mt-1 font-mono text-lg font-semibold">{formatCurrency(metrics.primaryRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{rangeLabel(comparisonPeriod)}</p>
                  <p className="mt-1 font-mono text-lg font-semibold">{formatCurrency(metrics.comparisonRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.5)]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Growing</p>
                  {isLoading ? <Skeleton className="mt-3 h-9 w-16" /> : <p className="mt-2 text-3xl font-bold">{metrics.growing}</p>}
                  <p className="mt-2 text-sm text-muted-foreground">Customers gaining revenue</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><ArrowUpRight className="size-5" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.5)]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">At risk</p>
                  {isLoading ? <Skeleton className="mt-3 h-9 w-16" /> : <p className="mt-2 text-3xl font-bold">{metrics.declining + metrics.inactive}</p>}
                  <p className="mt-2 text-sm text-muted-foreground">{metrics.inactive} with no primary-period revenue</p>
                </div>
                <div className="rounded-xl bg-rose-50 p-2.5 text-rose-700"><UserMinus className="size-5" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-0 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.5)]">
          <div className="border-b px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <UsersRound className="size-5 text-primary" />
                  <h2 className="text-xl font-semibold">Customer movement</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Sorted by largest revenue gain. Select a customer to see the same periods by product.</p>
              </div>
              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or rep" className="pl-9" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {FILTERS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={filter === option.value ? "default" : "outline"}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                  <Badge variant="secondary" className="ml-1 border-0 bg-white/70 text-current">
                    {option.value === "all" ? rows.length : option.value === "growing" ? metrics.growing : option.value === "declining" ? metrics.declining : metrics.inactive}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="min-w-[260px]">Customer</TableHead>
                  <TableHead className="text-right">Primary period</TableHead>
                  <TableHead className="text-right">Comparison</TableHead>
                  <TableHead className="text-right">Revenue change</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 7 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 6 }).map((__, cell) => <TableCell key={cell}><Skeleton className="h-5 w-24" /></TableCell>)}
                    </TableRow>
                  ))
                ) : visibleRows.length ? (
                  visibleRows.map((row) => {
                    const delta = row.totalRevenue - row.previousRevenue;
                    const inactive = row.totalRevenue === 0 && row.previousRevenue > 0;
                    return (
                      <TableRow key={row.customerId} className="group">
                        <TableCell>
                          <Link href={`/reports/customer/${row.customerId}?${detailQuery}`} className="block">
                            <div className="flex items-center gap-3">
                              <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 font-semibold text-blue-700">
                                {row.customerName.slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold group-hover:text-primary">{row.customerName}</span>
                                  {inactive ? <Badge className="border-rose-200 bg-rose-50 text-rose-700">No current revenue</Badge> : null}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">{row.repName || "Unassigned account"}</p>
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatCurrency(row.totalRevenue)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(row.previousRevenue)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-mono text-sm font-semibold ${delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-700" : "text-muted-foreground"}`}>
                              {delta > 0 ? "+" : ""}{formatCurrency(delta)}
                            </span>
                            <TrendIndicator value={row.percentChange} className="justify-end text-xs" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{row.productCount}</TableCell>
                        <TableCell>
                          <Link href={`/reports/customer/${row.customerId}?${detailQuery}`} aria-label={`Open ${row.customerName} comparison`} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-blue-50 hover:text-blue-700">
                            <ArrowRight className="size-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <CircleDollarSign className="mx-auto size-7 text-muted-foreground/50" />
                      <p className="mt-3 font-medium">No customers match this view</p>
                      <p className="mt-1 text-sm text-muted-foreground">Try another filter, search, or pair of periods.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
