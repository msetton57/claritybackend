import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useGetArAging } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

export default function ArAging() {
  const [search, setSearch] = useState("");
  
  const { data: agingRows, isLoading } = useGetArAging({});

  const filteredRows = agingRows?.filter(row => 
    row.customerName.toLowerCase().includes(search.toLowerCase()) || 
    (row.repName && row.repName.toLowerCase().includes(search.toLowerCase()))
  );

  const totalCurrent = filteredRows?.reduce((sum, row) => sum + row.current, 0) || 0;
  const total30 = filteredRows?.reduce((sum, row) => sum + row.days30, 0) || 0;
  const total60 = filteredRows?.reduce((sum, row) => sum + row.days60, 0) || 0;
  const total90 = filteredRows?.reduce((sum, row) => sum + row.days90, 0) || 0;
  const total90plus = filteredRows?.reduce((sum, row) => sum + row.days90plus, 0) || 0;
  const grandTotal = filteredRows?.reduce((sum, row) => sum + row.total, 0) || 0;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Accounts Receivable Aging</h1>
            <p className="text-muted-foreground mt-1">Outstanding balances by customer and aging bucket.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search customers..." 
              className="pl-8 bg-card"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 sm:gap-4">
          <Card className="md:col-span-2">
            <CardContent className="p-4 sm:p-6">
              <p className="text-sm font-medium text-muted-foreground">Total A/R</p>
              {isLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
                <p className="text-2xl font-bold font-mono">{formatCurrency(grandTotal)}</p>
              )}
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-4 sm:p-6">
              <p className="text-sm font-medium text-muted-foreground">Current</p>
              {isLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
                <p className="text-xl font-semibold font-mono">{formatCurrency(totalCurrent)}</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 sm:p-6">
              <p className="text-sm font-medium text-muted-foreground">1-30 Days</p>
              {isLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
                <p className="text-xl font-semibold font-mono text-warning-foreground">{formatCurrency(total30)}</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 sm:p-6">
              <p className="text-sm font-medium text-muted-foreground">31-60 Days</p>
              {isLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
                <p className="text-xl font-semibold font-mono text-destructive">{formatCurrency(total60)}</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-destructive shadow-sm shadow-destructive/10">
            <CardContent className="p-4 sm:p-6">
              <p className="text-sm font-medium text-muted-foreground">60+ Days</p>
              {isLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
                <p className="text-xl font-semibold font-mono text-destructive">{formatCurrency(total90 + total90plus)}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail Table */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="w-[250px]">Customer</TableHead>
                  <TableHead>Rep</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">1-30 Days</TableHead>
                  <TableHead className="text-right">31-60 Days</TableHead>
                  <TableHead className="text-right">61-90 Days</TableHead>
                  <TableHead className="text-right">&gt; 90 Days</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredRows && filteredRows.length > 0 ? (
                  filteredRows.map((row) => {
                    const isPastDue = row.days30 > 0 || row.days60 > 0 || row.days90 > 0 || row.days90plus > 0;
                    const isSevere = row.days60 > 0 || row.days90 > 0 || row.days90plus > 0;
                    
                    return (
                      <TableRow 
                        key={row.customerId} 
                        className={isSevere ? "bg-destructive/5 hover:bg-destructive/10" : isPastDue ? "bg-warning/5 hover:bg-warning/10" : ""}
                      >
                        <TableCell className="font-medium">{row.customerName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{row.repName || 'Unassigned'}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(row.current)}</TableCell>
                        <TableCell className={`text-right font-mono ${row.days30 > 0 ? 'text-warning-foreground font-medium' : 'text-muted-foreground'}`}>{formatCurrency(row.days30)}</TableCell>
                        <TableCell className={`text-right font-mono ${row.days60 > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{formatCurrency(row.days60)}</TableCell>
                        <TableCell className={`text-right font-mono ${row.days90 > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{formatCurrency(row.days90)}</TableCell>
                        <TableCell className={`text-right font-mono ${row.days90plus > 0 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>{formatCurrency(row.days90plus)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No accounts receivable data found.
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
