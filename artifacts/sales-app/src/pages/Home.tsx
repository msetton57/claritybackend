import React, { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetYoyRevenue, useGetMomRevenue, useGetSalesReps } from "@workspace/api-client-react";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { TrendIndicator } from "@/components/ui/trend-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, BarChart, Bar } from "recharts";

export default function Home() {
  const [repId, setRepId] = useState<string>("all");
  
  const selectedRepId = repId === "all" ? null : parseInt(repId);
  
  const { data: reps } = useGetSalesReps();
  const { data: yoy, isLoading: yoyLoading } = useGetYoyRevenue(
    { repId: selectedRepId || undefined }
  );
  const { data: mom, isLoading: momLoading } = useGetMomRevenue(
    { repId: selectedRepId || undefined }
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-8">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
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
                {reps?.map(rep => (
                  <SelectItem key={rep.id} value={rep.id.toString()}>{rep.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Big Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* YoY Card */}
          <Link href="/reports/yoy">
            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-muted-foreground group-hover:text-primary transition-colors">
                  Year-over-Year Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                {yoyLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-[200px]" />
                    <Skeleton className="h-40 w-full" />
                  </div>
                ) : yoy ? (
                  <div>
                    <div className="flex items-baseline gap-4 mb-6">
                      <span className="text-5xl font-bold font-mono tracking-tighter">
                        {formatCompactCurrency(yoy.totalRevenue)}
                      </span>
                      <TrendIndicator value={yoy.percentChange} className="text-xl" />
                    </div>
                    
                    <div className="h-[180px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={yoy.dataPoints} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip 
                            cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                            formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                            contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-sm)' }}
                          />
                          <Bar 
                            dataKey="revenue" 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]}
                            maxBarSize={60}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* MoM Card */}
          <Link href="/reports/mom">
            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-muted-foreground group-hover:text-primary transition-colors">
                  Month-over-Month Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                {momLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-[200px]" />
                    <Skeleton className="h-40 w-full" />
                  </div>
                ) : mom ? (
                  <div>
                    <div className="flex items-baseline gap-4 mb-6">
                      <span className="text-5xl font-bold font-mono tracking-tighter">
                        {formatCompactCurrency(mom.currentMonthRevenue)}
                      </span>
                      <TrendIndicator value={mom.percentChange} className="text-xl" />
                    </div>
                    
                    <div className="h-[180px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={mom.dataPoints} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorMom" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis 
                            dataKey="month" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                            tickFormatter={(val) => {
                              const [y, m] = val.split('-');
                              const d = new Date(parseInt(y), parseInt(m)-1);
                              return d.toLocaleDateString('en-US', { month: 'short' });
                            }}
                          />
                          <Tooltip 
                            formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                            labelFormatter={(val: string) => {
                              const [y, m] = val.split('-');
                              const d = new Date(parseInt(y), parseInt(m)-1);
                              return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                            }}
                            contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-sm)' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="revenue" 
                            stroke="hsl(var(--chart-2))" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorMom)" 
                          />
                        </AreaChart>
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
      </div>
    </AppLayout>
  );
}
