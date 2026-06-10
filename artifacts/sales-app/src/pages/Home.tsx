import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetArAging, useGetYoyRevenue, useGetMomRevenue, useGetSalesReps } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { toArray } from "@/lib/array";
import { TrendIndicator } from "@/components/ui/trend-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/lib/users";
import { useCollaborationTasks, usePosterBoardPosts } from "@/lib/collaboration";
import { listOrders } from "@/lib/operations";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function compactDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
}

function ChartTooltip({ active, payload, label, labelFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card shadow-md px-3 py-2 text-sm min-w-[160px]">
      <p className="font-semibold mb-1 text-foreground">{labelFormatter ? labelFormatter(label ?? "") : label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </span>
          <span className="font-mono font-medium">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [repId, setRepId] = useState<string>("all");

  const selectedRepId = repId === "all" ? null : parseInt(repId);
  const { data: currentUser } = useCurrentUser();
  const firstName = currentUser?.name.split(" ")[0] ?? "there";

  const { data: reps } = useGetSalesReps();
  const salesReps = toArray(reps);
  const { data: tasks = [] } = useCollaborationTasks();
  const { data: posterPosts = [] } = usePosterBoardPosts();
  const { data: yoy, isLoading: yoyLoading } = useGetYoyRevenue(
    { repId: selectedRepId || undefined }
  );
  const { data: mom, isLoading: momLoading } = useGetMomRevenue(
    { repId: selectedRepId || undefined }
  );
  const { data: arRows = [] } = useGetArAging({});
  const ordersQueueQuery = useQuery({
    queryKey: ["dashboard-order-queues"],
    queryFn: () => listOrders({}),
  });
  const overdueAccounts = toArray(arRows).filter((row) => row.days30 + row.days60 + row.days90 + row.days90plus > 0).length;
  const transitOrders = (ordersQueueQuery.data ?? []).filter((order) => order.status === "in_transit").length;
  const overdueInvoices = (ordersQueueQuery.data ?? []).filter((order) => order.invoiceStatus === "overdue").length;
  const priorityOrders = (ordersQueueQuery.data ?? []).filter((order) => order.riskLevel === "priority").length;
  const pendingTasks = tasks.filter((task) => !task.completed);

  return (
    <AppLayout>
      <div className="flex flex-col gap-8">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Welcome {firstName}</p>
            <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
            <p className="text-muted-foreground mt-1">Real-time revenue intelligence and performance tracking.</p>
          </div>
          <div className="flex items-center gap-3 bg-card p-2 rounded-lg border shadow-sm">
            <span className="text-sm font-medium text-muted-foreground px-2">Scope:</span>
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger className="w-[200px] border-none shadow-none focus:ring-0">
                <SelectValue placeholder="Entire Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entire Company</SelectItem>
                {salesReps.map(rep => (
                  <SelectItem key={rep.id} value={rep.id.toString()}>{rep.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Big Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── YoY Card ── */}
          <Link href="/reports">
            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-muted-foreground group-hover:text-primary transition-colors">
                  Year-over-Year Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                {yoyLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-[280px]" />
                    <Skeleton className="h-6 w-[220px]" />
                    <Skeleton className="h-[200px] w-full" />
                  </div>
                ) : yoy ? (
                  <div>
                    {/* Prior year total */}
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="text-2xl font-bold font-mono tracking-tight text-muted-foreground">
                        {yoy.previousYear} YTD
                      </span>
                      <span className="text-2xl font-bold font-mono tracking-tight text-muted-foreground">
                        {formatCurrency(yoy.previousYearRevenue)}
                      </span>
                    </div>
                    {/* Current year + pace */}
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                      <span className="text-3xl font-bold font-mono tracking-tight">
                        {yoy.currentYear} YTD
                      </span>
                      <span className="text-3xl font-bold font-mono tracking-tight">
                        {formatCurrency(yoy.totalRevenue)}
                      </span>
                      <TrendIndicator value={yoy.percentChange} className="text-base" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">
                      On pace for <span className="font-semibold text-foreground font-mono">{formatCurrency(yoy.pacedRevenue)}</span> this year
                    </p>

                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={yoy.monthlyPoints}
                          margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis
                            dataKey="monthNum"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(v: number) => MONTH_ABBR[v - 1]}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={compactDollars}
                            width={52}
                          />
                          <Tooltip
                            content={<ChartTooltip labelFormatter={(v) => MONTH_ABBR[Number(v) - 1]} />}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            formatter={(value) =>
                              value === "lastYear" ? String(yoy.previousYear) : String(yoy.currentYear)
                            }
                            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="lastYear"
                            stroke="hsl(var(--muted-foreground))"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="4 4"
                          />
                          <Line
                            type="monotone"
                            dataKey="thisYear"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* ── MoM Card ── */}
          <Link href="/reports">
            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-muted-foreground group-hover:text-primary transition-colors">
                  Month-over-Month Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                {momLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-[280px]" />
                    <Skeleton className="h-6 w-[220px]" />
                    <Skeleton className="h-[200px] w-full" />
                  </div>
                ) : mom ? (
                  <div>
                    {/* Prior month total */}
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="text-2xl font-bold font-mono tracking-tight text-muted-foreground">
                        {mom.previousYearMonth} MTD
                      </span>
                      <span className="text-2xl font-bold font-mono tracking-tight text-muted-foreground">
                        {formatCurrency(mom.previousMonthRevenue)}
                      </span>
                    </div>
                    {/* Current month + pace */}
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                      <span className="text-3xl font-bold font-mono tracking-tight">
                        {mom.currentYearMonth} MTD
                      </span>
                      <span className="text-3xl font-bold font-mono tracking-tight">
                        {formatCurrency(mom.currentMonthRevenue)}
                      </span>
                      <TrendIndicator value={mom.percentChange} className="text-base" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">
                      On pace for <span className="font-semibold text-foreground font-mono">{formatCurrency(mom.pacedRevenue)}</span> this month
                    </p>

                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={mom.dailyPoints}
                          margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(v: number) => v % 5 === 0 || v === 1 ? String(v) : ""}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={compactDollars}
                            width={52}
                          />
                          <Tooltip
                            content={<ChartTooltip labelFormatter={(v) => `Day ${v}`} />}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            formatter={(value) =>
                              value === "lastMonth" ? mom.previousYearMonth : mom.currentYearMonth
                            }
                            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="lastMonth"
                            stroke="hsl(var(--muted-foreground))"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="4 4"
                          />
                          <Line
                            type="monotone"
                            dataKey="thisMonth"
                            stroke="hsl(142 71% 45%)"
                            strokeWidth={2.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-6 xl:grid-cols-4">
          <Link href="/ar">
            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-3"><CardTitle className="text-lg font-medium text-muted-foreground group-hover:text-primary transition-colors">Collections queue</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold tracking-tight">{overdueAccounts}</div><p className="text-sm text-muted-foreground mt-1">Accounts with overdue receivables.</p></CardContent>
            </Card>
          </Link>
          <Link href="/orders">
            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-3"><CardTitle className="text-lg font-medium text-muted-foreground group-hover:text-primary transition-colors">Transit orders</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold tracking-tight">{transitOrders}</div><p className="text-sm text-muted-foreground mt-1">Orders that still need delivery follow-through.</p></CardContent>
            </Card>
          </Link>
          <Link href="/orders">
            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-3"><CardTitle className="text-lg font-medium text-muted-foreground group-hover:text-primary transition-colors">Overdue order invoices</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold tracking-tight">{overdueInvoices}</div><p className="text-sm text-muted-foreground mt-1">Order-linked invoices in overdue state.</p></CardContent>
            </Card>
          </Link>
          <Link href="/orders">
            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-3"><CardTitle className="text-lg font-medium text-muted-foreground group-hover:text-primary transition-colors">Priority orders</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold tracking-tight">{priorityOrders}</div><p className="text-sm text-muted-foreground mt-1">Orders flagged for operational risk.</p></CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
        <Link href="/tasks">
          <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-muted-foreground group-hover:text-primary transition-colors">
                Task List
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-3xl font-bold tracking-tight">{pendingTasks.length}</div>
                  <p className="text-sm text-muted-foreground">
                    {pendingTasks.length === 1 ? "task left for today" : "tasks left for today"}
                  </p>
                </div>
                <p className="text-sm text-primary">Open full to-do list</p>
              </div>

              <div className="space-y-3">
                {tasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3">
                    <span
                      className={`flex size-5 shrink-0 rounded-full border-2 ${
                        task.completed ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className={task.completed ? "text-sm text-muted-foreground line-through" : "text-sm"}>
                        {task.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {task.assignees.map((assignee) => assignee.name).join(", ")}
                      </div>
                    </div>
                  </div>
                ))}

                {tasks.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    No tasks yet.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/board">
          <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-muted-foreground group-hover:text-primary transition-colors">
                Poster Board
              </CardTitle>
            </CardHeader>
            <CardContent className="flex h-full flex-col gap-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-3xl font-bold tracking-tight">{posterPosts.length}</div>
                  <p className="text-sm text-muted-foreground">
                    {posterPosts.length === 1 ? "visible post for you" : "visible posts for you"}
                  </p>
                </div>
                <p className="text-sm text-primary">Open poster board</p>
              </div>

              <div className="space-y-3">
                {posterPosts.slice(0, 3).map((post) => (
                  <div key={post.id} className="rounded-lg border bg-muted/30 px-4 py-3">
                    <div className="text-sm font-medium">{post.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {post.includeAllUsers ? "Everyone" : post.targets.map((target) => target.name).join(", ")}
                    </div>
                  </div>
                ))}

                {posterPosts.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    No poster board updates yet.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </Link>
        </div>
      </div>
    </AppLayout>
  );
}
