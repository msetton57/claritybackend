import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { useGetCustomerRevenueDetail, getGetCustomerRevenueDetailQueryKey, useGetCustomer, getGetCustomerQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { TrendIndicator } from "@/components/ui/trend-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfYear, endOfYear, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { ChevronLeft, AlertCircle, Building2, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CustomerDetail() {
  const { customerId } = useParams();
  const id = parseInt(customerId || "0");
  
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: endOfYear(new Date()),
  });

  const startDate = date?.from ? format(date.from, "yyyy-MM-dd") : format(startOfYear(new Date()), "yyyy-MM-dd");
  const endDate = date?.to ? format(date.to, "yyyy-MM-dd") : format(endOfYear(new Date()), "yyyy-MM-dd");

  const { data: customer, isLoading: customerLoading } = useGetCustomer(id, {
    query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) }
  });

  const { data: report, isLoading: reportLoading } = useGetCustomerRevenueDetail(
    { customerId: id, startDate, endDate },
    { query: { enabled: !!id, queryKey: getGetCustomerRevenueDetailQueryKey({ customerId: id, startDate, endDate }) } }
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
          <Link href="/reports/yoy" className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="size-4" /> Back to Reports
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            {customerLoading ? (
              <Skeleton className="h-10 w-64 mb-2" />
            ) : (
              <h1 className="text-3xl font-bold tracking-tight">{customer?.name}</h1>
            )}
            <p className="text-muted-foreground mt-1">Customer Profile & Revenue Analysis</p>
          </div>
          <div className="flex items-center gap-2">
            <DatePickerWithRange date={date} setDate={setDate} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Summary */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Revenue Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Revenue</p>
                  {reportLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <h3 className="text-2xl font-bold font-mono tracking-tight">{formatCurrency(report?.totalRevenue || 0)}</h3>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Previous Period</p>
                  {reportLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <h3 className="text-2xl font-bold font-mono tracking-tight text-muted-foreground">{formatCurrency(report?.previousRevenue || 0)}</h3>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Performance</p>
                  {reportLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="mt-1">
                      <TrendIndicator value={report?.percentChange || 0} className="text-xl" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AR Balance Section */}
          <Card className={customer?.isPastDue ? "border-destructive/50 shadow-sm shadow-destructive/10" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-center">
                <span>A/R Balance</span>
                {customer?.isPastDue && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="size-3" /> Past Due
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customerLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : (
                <>
                  <h3 className={`text-3xl font-bold font-mono tracking-tight ${customer?.isPastDue ? "text-destructive" : ""}`}>
                    {formatCurrency(customer?.arBalance || 0)}
                  </h3>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Credit Limit:</span>
                      <span className="font-mono">{formatCurrency(customer?.creditLimit || 0)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Available Credit:</span>
                      <span className="font-mono font-medium text-foreground">{formatCurrency(customer?.availableCredit || 0)}</span>
                    </div>
                    {customer?.customTerms && (
                      <div className="pt-2 mt-2 border-t flex justify-between text-muted-foreground">
                        <span>Terms:</span>
                        <span>{customer.customTerms}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Product Table */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-card">
            <h3 className="font-semibold text-lg">Product Breakdown</h3>
            <p className="text-sm text-muted-foreground">Sorted by largest revenue decline to identify risk</p>
          </div>
          <div className="overflow-x-auto flex-1">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="w-[300px]">Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Units Sold</TableHead>
                  <TableHead className="text-right">Current Revenue</TableHead>
                  <TableHead className="text-right">Previous Revenue</TableHead>
                  <TableHead className="text-right">% Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : report?.products && report.products.length > 0 ? (
                  // Sort by biggest decline (most negative percentChange) first
                  [...report.products]
                    .sort((a, b) => a.percentChange - b.percentChange)
                    .map((row) => (
                    <TableRow key={row.productId} className={row.percentChange < -20 ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{row.productName}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">{row.sku}</TableCell>
                      <TableCell className="text-right font-mono">{row.unitsSold}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatCurrency(row.revenue)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(row.previousRevenue)}</TableCell>
                      <TableCell className="text-right">
                        <TrendIndicator value={row.percentChange} className="justify-end" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No product sales found for this period.
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
