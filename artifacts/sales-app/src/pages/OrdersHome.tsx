import React from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetOrders } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Eye, Truck, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function OrdersHome() {
  const { data: openOrders, isLoading: openLoading } = useGetOrders({ status: "open" });
  const { data: transitOrders, isLoading: transitLoading } = useGetOrders({ status: "in_transit" });
  const { data: fulfilledOrders, isLoading: fulfilledLoading } = useGetOrders({ status: "fulfilled" });

  const renderTable = (orders: any[], isLoading: boolean, showTracking: boolean = false) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[120px]">Order #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            {showTracking && <TableHead>Tracking</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                {showTracking && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : orders && orders.length > 0 ? (
            orders.map((order) => (
              <TableRow key={order.id} className="hover:bg-muted/50">
                <TableCell className="font-mono font-medium">{order.orderNumber}</TableCell>
                <TableCell className="font-medium">{order.customerName}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(order.orderDate)}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(order.total)}</TableCell>
                <TableCell>
                  {order.status === 'open' && <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20"><Clock className="mr-1 size-3" /> Open</Badge>}
                  {order.status === 'in_transit' && <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"><Truck className="mr-1 size-3" /> In Transit</Badge>}
                  {order.status === 'fulfilled' && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"><CheckCircle2 className="mr-1 size-3" /> Fulfilled</Badge>}
                  {order.status === 'cancelled' && <Badge variant="destructive">Cancelled</Badge>}
                </TableCell>
                {showTracking && (
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {order.trackingNumber || '-'}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <Link href={`/orders/${order.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="mr-2 size-4" /> View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={showTracking ? 7 : 6} className="h-24 text-center text-muted-foreground">
                No orders found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
            <p className="text-muted-foreground mt-1">Manage and track customer orders.</p>
          </div>
          <Link href="/orders/new">
            <Button size="lg" className="shadow-md">
              <PlusCircle className="mr-2 size-5" /> New Order
            </Button>
          </Link>
        </div>

        <Card className="flex-1">
          <Tabs defaultValue="open" className="w-full h-full flex flex-col">
            <div className="px-6 pt-4 border-b">
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
                <TabsTrigger 
                  value="open" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                >
                  Open Orders
                  {openOrders && openOrders.length > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-muted">{openOrders.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="in_transit"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                >
                  In Transit
                </TabsTrigger>
                <TabsTrigger 
                  value="fulfilled"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                >
                  Fulfilled
                </TabsTrigger>
              </TabsList>
            </div>
            
            <CardContent className="p-0 flex-1">
              <TabsContent value="open" className="m-0 border-none outline-none">
                {renderTable(openOrders || [], openLoading)}
              </TabsContent>
              <TabsContent value="in_transit" className="m-0 border-none outline-none">
                {renderTable(transitOrders || [], transitLoading, true)}
              </TabsContent>
              <TabsContent value="fulfilled" className="m-0 border-none outline-none">
                {renderTable(fulfilledOrders || [], fulfilledLoading)}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </AppLayout>
  );
}
