import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetCustomers, useGetCustomerArBalance, useGetProducts, useGetActivePromotions, useCreateOrder } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Search, ShoppingCart, Plus, Minus, AlertCircle, ArrowRight, ArrowLeft, Building2, Package, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CartItem {
  product: any;
  quantity: number;
}

export default function NewOrder() {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: customers, isLoading: customersLoading } = useGetCustomers({ q: searchCustomer });
  const { data: customerAr, isLoading: arLoading } = useGetCustomerArBalance(selectedCustomerId || 0, {
    query: { enabled: !!selectedCustomerId }
  });
  
  const { data: products, isLoading: productsLoading } = useGetProducts({ q: searchProduct });
  const { data: promotions } = useGetActivePromotions();

  const createOrderMutation = useCreateOrder();

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
  
  const isCreditBlocked = customerAr?.isPastDue || (customerAr && customerAr.availableCredit <= 0);

  const handleNextStep = () => {
    if (selectedCustomerId && !isCreditBlocked) {
      setStep(2);
    }
  };

  const updateCart = (product: any, delta: number) => {
    setCart(current => {
      const existing = current.find(item => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          return current.filter(item => item.product.id !== product.id);
        }
        return current.map(item => 
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      } else if (delta > 0) {
        return [...current, { product, quantity: delta }];
      }
      return current;
    });
  };

  const getProductQty = (productId: number) => {
    return cart.find(item => item.product.id === productId)?.quantity || 0;
  };

  // Calculate totals
  let subtotal = 0;
  let discountTotal = 0;

  cart.forEach(item => {
    const lineTotal = item.product.unitPrice * item.quantity;
    subtotal += lineTotal;
    
    // Apply best promotion
    let bestDiscount = 0;
    promotions?.forEach(promo => {
      if (!promo.productIds || promo.productIds.length === 0 || promo.productIds.includes(item.product.id)) {
        let discount = 0;
        if (promo.discountType === 'percent') {
          discount = lineTotal * (promo.discountValue / 100);
        } else if (promo.discountType === 'fixed') {
          discount = Math.min(promo.discountValue * item.quantity, lineTotal); // don't discount more than price
        }
        if (discount > bestDiscount) bestDiscount = discount;
      }
    });
    
    discountTotal += bestDiscount;
  });

  const total = subtotal - discountTotal;

  const handleSubmit = () => {
    if (!selectedCustomerId || cart.length === 0) return;

    createOrderMutation.mutate({
      data: {
        customerId: selectedCustomerId,
        lineItems: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity
        })),
        shippingMethod: "Standard"
      }
    }, {
      onSuccess: (order) => {
        toast({ title: "Order Created", description: `Order #${order.orderNumber} placed successfully.` });
        setLocation(`/orders/${order.id}`);
      },
      onError: (err) => {
        toast({ title: "Error", description: "Failed to create order.", variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto h-[calc(100vh-120px)]">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Order</h1>
            <p className="text-muted-foreground mt-1">
              {step === 1 ? "Step 1: Select Customer" : `Step 2: Add Products for ${selectedCustomer?.name}`}
            </p>
          </div>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 size-4" /> Change Customer
            </Button>
          )}
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            <Card className="flex flex-col h-full">
              <CardHeader>
                <CardTitle>Select Customer</CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="search" 
                    placeholder="Search by name..." 
                    className="pl-8 bg-background"
                    value={searchCustomer}
                    onChange={e => setSearchCustomer(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-full border-t">
                  <div className="divide-y">
                    {customersLoading ? (
                      <div className="p-4 text-center text-muted-foreground">Loading...</div>
                    ) : customers?.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">No customers found</div>
                    ) : (
                      customers?.map(customer => (
                        <div 
                          key={customer.id}
                          className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between ${selectedCustomerId === customer.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                          onClick={() => setSelectedCustomerId(customer.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
                              <Building2 className="size-5 text-secondary-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{customer.name}</p>
                              <p className="text-sm text-muted-foreground">{customer.email || 'No email'}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div>
              {selectedCustomerId ? (
                <Card className={`h-full flex flex-col ${isCreditBlocked ? 'border-destructive' : 'border-primary'}`}>
                  <CardHeader className={`${isCreditBlocked ? 'bg-destructive/10' : 'bg-primary/5'}`}>
                    <CardTitle className="flex items-center gap-2">
                      Customer Status
                      {isCreditBlocked && <Badge variant="destructive">Credit Block</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-6 flex flex-col justify-center space-y-6">
                    {arLoading ? (
                      <div className="text-center text-muted-foreground">Checking credit status...</div>
                    ) : customerAr ? (
                      <>
                        <div className="space-y-1 text-center">
                          <p className="text-muted-foreground text-sm uppercase tracking-wider font-semibold">Available Credit</p>
                          <p className={`text-4xl font-bold font-mono ${customerAr.availableCredit <= 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-500'}`}>
                            {formatCurrency(customerAr.availableCredit)}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-y py-4">
                          <div className="text-center">
                            <p className="text-muted-foreground text-sm">Credit Limit</p>
                            <p className="font-mono font-medium">{formatCurrency(customerAr.creditLimit)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground text-sm">A/R Balance</p>
                            <p className={`font-mono font-medium ${customerAr.isPastDue ? 'text-destructive' : ''}`}>
                              {formatCurrency(customerAr.balance)}
                            </p>
                          </div>
                        </div>

                        {isCreditBlocked ? (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Order Blocked</AlertTitle>
                            <AlertDescription>
                              This customer cannot place new orders. 
                              {customerAr.isPastDue ? " They have past due invoices." : " They have exceeded their credit limit."}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Button size="lg" className="w-full h-14 text-lg mt-auto" onClick={handleNextStep}>
                            Continue to Catalog <ArrowRight className="ml-2 size-5" />
                          </Button>
                        )}
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground p-8 text-center bg-card/50">
                  <Building2 className="size-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-1">Select a customer</h3>
                  <p className="max-w-xs">Choose a customer from the list to check their credit status and start an order.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex gap-6 h-full min-h-0">
            {/* Catalog Panel */}
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="py-4 border-b shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="search" 
                    placeholder="Search SKUs or products..." 
                    className="pl-8 bg-background"
                    value={searchProduct}
                    onChange={e => setSearchProduct(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {productsLoading ? (
                      <div className="col-span-full p-4 text-center text-muted-foreground">Loading products...</div>
                    ) : products?.map(product => {
                      const qty = getProductQty(product.id);
                      return (
                        <div key={product.id} className={`border rounded-lg p-4 flex flex-col bg-card hover:border-primary/50 transition-colors ${!product.inStock ? 'opacity-70' : ''}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-mono text-muted-foreground">{product.sku}</span>
                            {product.inStock ? (
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 text-[10px] px-1.5 py-0">In Stock</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-destructive/10 text-destructive hover:bg-destructive/20 text-[10px] px-1.5 py-0">Out of Stock</Badge>
                            )}
                          </div>
                          
                          <h4 className="font-medium flex-1 line-clamp-2 leading-tight mb-2">{product.name}</h4>
                          
                          <div className="flex items-center justify-between mt-auto pt-2 border-t">
                            <span className="font-mono font-bold text-primary">{formatCurrency(product.unitPrice)}</span>
                            
                            {qty > 0 ? (
                              <div className="flex items-center gap-2 bg-muted rounded-md p-1">
                                <Button size="icon" variant="ghost" className="size-6 h-6 w-6 rounded-sm" onClick={() => updateCart(product, -1)}>
                                  <Minus className="size-3" />
                                </Button>
                                <span className="font-mono w-4 text-center text-sm">{qty}</span>
                                <Button size="icon" variant="ghost" className="size-6 h-6 w-6 rounded-sm" onClick={() => updateCart(product, 1)}>
                                  <Plus className="size-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" onClick={() => updateCart(product, 1)} disabled={!product.inStock}>
                                Add
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Order Summary Panel */}
            <Card className="w-80 flex flex-col shrink-0">
              <CardHeader className="py-4 border-b shrink-0 bg-muted/20">
                <CardTitle className="flex items-center justify-between">
                  Order Summary
                  <Badge variant="secondary" className="bg-primary text-primary-foreground">{cart.length} items</Badge>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 p-4">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-12 text-center">
                      <ShoppingCart className="size-12 mb-2" />
                      <p>Cart is empty</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map(item => (
                        <div key={item.product.id} className="flex flex-col gap-1 text-sm border-b pb-3">
                          <div className="flex justify-between font-medium">
                            <span className="truncate pr-2" title={item.product.name}>{item.product.name}</span>
                            <span className="font-mono shrink-0">{formatCurrency(item.product.unitPrice * item.quantity)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground text-xs">
                            <span className="font-mono">{item.product.sku}</span>
                            <span>{item.quantity} × {formatCurrency(item.product.unitPrice)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                
                {cart.length > 0 && (
                  <div className="p-4 bg-muted/30 border-t space-y-3 shrink-0">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-mono">{formatCurrency(subtotal)}</span>
                    </div>
                    {discountTotal > 0 && (
                      <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-500">
                        <span className="flex items-center gap-1"><Tag className="size-3" /> Promos</span>
                        <span className="font-mono">-{formatCurrency(discountTotal)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span className="font-mono text-primary">{formatCurrency(total)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
              
              <CardFooter className="p-4 border-t bg-card shrink-0">
                <Button 
                  className="w-full h-12 text-lg shadow-sm" 
                  disabled={cart.length === 0 || createOrderMutation.isPending}
                  onClick={handleSubmit}
                >
                  {createOrderMutation.isPending ? "Processing..." : "Submit Order"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
