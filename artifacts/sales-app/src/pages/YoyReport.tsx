import React, { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { useGetRevenueSummary, useGetCustomerRevenueReport, getGetCustomerRevenueReportQueryKey } from "@workspace/api-client-react";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { TrendIndicator } from "@/components/ui/trend-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, startOfYear, endOfYear, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Users, DollarSign, Building } from "lucide-react";

export default function YoyReport() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: endOfYear(new Date()),
  });

  const startDate = date?.from ? format(date.from, "yyyy-MM-dd") : format(startOfYear(new Date()), "yyyy-MM-dd");
  const endDate = date?.to ? format(date.to, "yyyy-MM-dd") : format(endOfYear(new Date()), "yyyy-MM-dd");

  const { data: summary, isLoading: summaryLoading } = useGetRevenueSummary({
    startDate,
    endDate
  });

  const { data: customers, isLoading: customersLoading } = useGetCustomerRevenueReport({
    startDate,
    endDate
  });

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Year-over-Year Report</h1>
            <p className="text-muted-foreground mt-1">Compare revenue performance against the previous year.</p>
          </div>
          <div className="flex items-center gap-2">
            <DatePickerWithRange date={date} setDate={setDate} />
          </div>
        </div>

        {/* Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Revenue</p>
                  {summaryLoading ? (
                    <Skeleton className="h-9 w-32" />
                  ) : (
                    <h3 className="text-3xl font-bold font-mono tracking-tighter">
                      {formatCurrency(summary?.totalRevenue || 0)}
                    </h3>
                  )}
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="size-5 text-primary" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                {summaryLoading ? (
                  <Skeleton className="h-5 w-24" />
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendIndicator value={summary?.percentChange || 0} />
                    <span>vs previous year</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Active Customers</p>
                  {summaryLoading ? (
                    <Skeleton className="h-9 w-20" />
                  ) : (
                    <h3 className="text-3xl font-bold font-mono tracking-tighter">
                      {summary?.customerCount || 0}
                    </h3>
                  )}
                </div>
                <div className="p-2 bg-secondary rounded-lg">
                  <Building className="size-5 text-secondary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Previous Year</p>
                  {summaryLoading ? (
                    <Skeleton className="h-9 w-32" />
                  ) : (
                    <h3 className="text-3xl font-bold font-mono tracking-tighter text-muted-foreground">
                      {formatCurrency(summary?.previousPeriodRevenue || 0)}
                    </h3>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Table */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-card">
            <h3 className="font-semibold text-lg">Customer Performance</h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[300px]">Customer Name</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Previous Year</TableHead>
                  <TableHead className="text-right">% Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customersLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : customers && customers.length > 0 ? (
                  customers.map((row) => (
                    <TableRow key={row.customerId} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <Link href={`/reports/customer/${row.customerId}`} className="font-medium hover:underline flex items-center gap-2">
                          {row.customerName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.repName || 'Unassigned'}</TableCell>
                      <TableCell className="text-right font-mono">{row.productCount}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatCurrency(row.totalRevenue)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(row.previousRevenue)}</TableCell>
                      <TableCell className="text-right">
                        <TrendIndicator value={row.percentChange} className="justify-end" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No data available for this period.
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
