import React, { useState } from "react";
import { Link, useParams } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useGetOrder, getGetOrderQueryKey, useUpdateOrder, useCancelOrder } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, Truck, CheckCircle2, Ban, MapPin, AlertCircle, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function OrderDetail() {
  const { id } = useParams();
  const orderId = parseInt(id || "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) }
  });

  const updateMutation = useUpdateOrder();
  const cancelMutation = useCancelOrder();

  const handleUpdateStatus = (status: "open" | "in_transit" | "fulfilled") => {
    updateMutation.mutate({ 
      id: orderId, 
      data: { status } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        toast({ title: "Order Updated", description: `Status changed to ${status.replace('_', ' ')}` });
      }
    });
  };

  const handleCancelOrder = () => {
    cancelMutation.mutate({ id: orderId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        toast({ title: "Order Cancelled", description: "The order has been cancelled.", variant: "destructive" });
      }
    });
  };

  const StatusBadge = ({ status }: { status?: string }) => {
    switch(status) {
      case 'open': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1"><Clock className="mr-1.5 size-4" /> Open</Badge>;
      case 'in_transit': return <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-sm py-1"><Truck className="mr-1.5 size-4" /> In Transit</Badge>;
      case 'fulfilled': return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm py-1"><CheckCircle2 className="mr-1.5 size-4" /> Fulfilled</Badge>;
      case 'cancelled': return <Badge variant="destructive" className="text-sm py-1"><Ban className="mr-1.5 size-4" /> Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
          <Link href="/orders" className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="size-4" /> Back to Orders
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            {isLoading ? (
              <Skeleton className="h-10 w-64 mb-2" />
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight font-mono">Order #{order?.orderNumber}</h1>
                <StatusBadge status={order?.status} />
              </div>
            )}
            <p className="text-muted-foreground mt-1">
              Placed on {isLoading ? <Skeleton className="h-4 w-24 inline-block align-middle" /> : order ? formatDate(order.orderDate) : ''}
            </p>
          </div>
          
          <div className="flex gap-2">
            {order?.status === 'open' && (
              <>
                <Button variant="outline" onClick={() => handleUpdateStatus('in_transit')} disabled={updateMutation.isPending}>
                  Mark In Transit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={cancelMutation.isPending}>Cancel Order</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will cancel the order permanently. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Order</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Yes, Cancel Order
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            {order?.status === 'in_transit' && (
              <Button onClick={() => handleUpdateStatus('fulfilled')} disabled={updateMutation.isPending}>
                Mark Fulfilled
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 flex flex-col gap-6">
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle>Line Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-8 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      order?.lineItems.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                            {item.promotionName && (
                              <Badge variant="secondary" className="mt-1 text-xs">{item.promotionName}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {item.discountAmount ? (
                              <div className="flex flex-col items-end">
                                <span className="line-through text-xs text-muted-foreground">{formatCurrency(item.unitPrice * item.quantity)}</span>
                                <span>{formatCurrency(item.lineTotal)}</span>
                              </div>
                            ) : (
                              formatCurrency(item.lineTotal)
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">{isLoading ? <Skeleton className="h-5 w-20" /> : formatCurrency(order?.subtotal || 0)}</span>
                </div>
                {order?.discountTotal ? (
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-500">
                    <span>Discounts</span>
                    <span className="font-mono">-{formatCurrency(order.discountTotal)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping ({order?.shippingMethod || 'Standard'})</span>
                  <span className="font-mono">{isLoading ? <Skeleton className="h-5 w-16" /> : formatCurrency(order?.shippingCost || 0)}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="font-mono">{isLoading ? <Skeleton className="h-7 w-24" /> : formatCurrency(order?.total || 0)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Customer Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium">{isLoading ? <Skeleton className="h-5 w-32" /> : order?.customerName}</h4>
                  <Link href={`/reports/customer/${order?.customerId}`} className="text-sm text-primary hover:underline">
                    View profile
                  </Link>
                </div>
                
                <div className="flex gap-2 items-start text-sm text-muted-foreground">
                  <FileText className="size-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-foreground block">Sales Rep</span>
                    {isLoading ? <Skeleton className="h-4 w-24" /> : order?.repName || 'Unassigned'}
                  </div>
                </div>
                
                {order?.trackingNumber && (
                  <div className="flex gap-2 items-start text-sm text-muted-foreground">
                    <MapPin className="size-4 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium text-foreground block">Tracking</span>
                      <span className="font-mono">{order.trackingNumber}</span>
                    </div>
                  </div>
                )}
                
                {order?.customTerms && (
                  <div className="flex gap-2 items-start text-sm text-muted-foreground">
                    <AlertCircle className="size-4 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium text-foreground block">Custom Terms</span>
                      <span>{order.customTerms}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
