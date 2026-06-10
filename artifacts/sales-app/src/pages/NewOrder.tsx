import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createCustomerActivity, getCustomerCrm, getCustomers, type CustomerListItem } from "@/lib/customer-crm";
import { createCollaborationTask } from "@/lib/collaboration";
import { fetchJson } from "@/lib/http";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { toArray } from "@/lib/array";
import { createShippingPolicy, listShippingPolicies, type ShippingPolicyRecord, updateShippingPolicy } from "@/lib/operations";
import {
  getGetCustomerQueryKey,
  getGetCustomerArBalanceQueryKey,
  getGetOrderQueryKey,
  getGetProductQueryKey,
  getGetProductsQueryKey,
  useCreateOrder,
  useGetActivePromotions,
  useGetCustomerArBalance,
  useGetCustomer,
  useGetProduct,
  useGetProducts,
  type Product,
  type ProductDetail,
  type Promotion,
} from "@workspace/api-client-react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Mail,
  PencilLine,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  UserRound,
  ZoomIn,
} from "lucide-react";

interface CartItem {
  product: Product;
  quantity: number;
  excludePromotion: boolean;
}

type InventoryFilter = "all" | "in" | "out";
type CustomerStandingFilter = "all" | "active" | "good" | "credit_hold" | "past_due";

const CUSTOMER_FILTERS: Array<{ value: CustomerStandingFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "good", label: "Good standing" },
  { value: "credit_hold", label: "Credit hold" },
  { value: "past_due", label: "Past due" },
];

function formatCustomerStatusLabel(status: CustomerListItem["status"]) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getCustomerStatusBadgeClass(status: CustomerListItem["status"]) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "prospect":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "on_hold":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "inactive":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getCustomerMonogram(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("");
}

function isInvoicePastDue(invoice: { isPaid: boolean; dueDate: Date | string }) {
  if (invoice.isPaid) return false;
  const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate.toISOString().slice(0, 10) : invoice.dueDate;
  return new Date(`${dueDate}T23:59:59`).getTime() < Date.now();
}

function formatDateValue(value?: string | Date | null) {
  if (!value) return null;
  return formatDate(value instanceof Date ? value.toISOString().slice(0, 10) : value);
}

function getPromotionDiscount(promotion: Promotion, unitPrice: number, quantity: number) {
  if (promotion.discountType === "percent") {
    return unitPrice * quantity * (promotion.discountValue / 100);
  }
  return Math.min(promotion.discountValue * quantity, unitPrice * quantity);
}

function getBestPromotion(productId: number, promotions: Promotion[], unitPrice: number, quantity: number) {
  return promotions.reduce<{ promotion: Promotion | null; discount: number }>(
    (best, promotion) => {
      const appliesToProduct =
        !promotion.productIds ||
        promotion.productIds.length === 0 ||
        promotion.productIds.includes(productId);

      if (!appliesToProduct) return best;

      const discount = getPromotionDiscount(promotion, unitPrice, quantity);
      if (discount > best.discount) {
        return { promotion, discount };
      }

      return best;
    },
    { promotion: null, discount: 0 }
  );
}

function ProductImage({
  imageUrl,
  label,
  className,
  fit = "cover",
}: {
  imageUrl?: string | null;
  label: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  if (imageUrl) {
    return <img src={imageUrl} alt={label} className={cn("h-full w-full", fit === "contain" ? "object-contain" : "object-cover", className)} />;
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-white text-slate-500",
        className
      )}
    >
      <Package className="mb-3 size-10" />
      <span className="max-w-[12rem] px-4 text-center text-sm font-medium leading-tight">{label}</span>
    </div>
  );
}

export default function NewOrder() {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchCustomer, setSearchCustomer] = useState("");
  const deferredCustomerSearch = useDeferredValue(searchCustomer.trim());
  const [searchProduct, setSearchProduct] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>("all");
  const [customerFilter, setCustomerFilter] = useState<CustomerStandingFilter>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [quickAddQuantities, setQuickAddQuantities] = useState<Record<number, string>>({});
  const [promoPreference, setPromoPreference] = useState<Record<number, boolean>>({});
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [selectedShippingPolicyId, setSelectedShippingPolicyId] = useState<string>("none");
  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);
  const [policyForm, setPolicyForm] = useState({
    name: "",
    description: "",
    carrier: "",
    shippingMethod: "",
    shippingCost: "0",
  });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const shippingPoliciesQuery = useQuery({
    queryKey: ["shipping-policies"],
    queryFn: listShippingPolicies,
  });

  const customersQuery = useQuery({
    queryKey: ["customers-crm", deferredCustomerSearch],
    queryFn: () => getCustomers({ q: deferredCustomerSearch || undefined, status: "all" }),
  });
  const customerCrmQuery = useQuery({
    queryKey: ["customer-crm", selectedCustomerId],
    queryFn: () => getCustomerCrm(selectedCustomerId as number),
    enabled: selectedCustomerId !== null,
  });
  const customerDetailQuery = useGetCustomer(selectedCustomerId || 0, {
    query: {
      enabled: !!selectedCustomerId,
      queryKey: getGetCustomerQueryKey(selectedCustomerId || 0),
    },
  });
  const { data: customerAr, isLoading: arLoading } = useGetCustomerArBalance(selectedCustomerId || 0, {
    query: {
      enabled: !!selectedCustomerId,
      queryKey: getGetCustomerArBalanceQueryKey(selectedCustomerId || 0),
    },
  });

  const { data: products, isLoading: productsLoading } = useGetProducts(
    {
      q: searchProduct || undefined,
      inStock: inventoryFilter === "all" ? undefined : inventoryFilter === "in",
      customerId: selectedCustomerId || null,
    },
    {
      query: {
        enabled: step === 2,
        queryKey: getGetProductsQueryKey({
          q: searchProduct || undefined,
          inStock: inventoryFilter === "all" ? undefined : inventoryFilter === "in",
          customerId: selectedCustomerId || null,
        }),
      },
    }
  );
  const { data: productDetail, isLoading: productDetailLoading } = useGetProduct(selectedProductId || 0, {
    query: {
      enabled: !!selectedProductId && step === 2,
      queryKey: getGetProductQueryKey(selectedProductId || 0),
    },
  });
  const { data: promotions } = useGetActivePromotions();

  const customerList = customersQuery.data ?? [];
  const productList = toArray(products);
  const promotionList = toArray(promotions);
  const shippingPolicies = shippingPoliciesQuery.data ?? [];
  const createOrderMutation = useCreateOrder();
  const saveShippingPolicyMutation = useMutation({
    mutationFn: async () => {
      const shippingCost = Number.parseFloat(policyForm.shippingCost || "0");
      const payload = {
        name: policyForm.name.trim(),
        description: policyForm.description.trim() || null,
        carrier: policyForm.carrier.trim() || null,
        shippingMethod: policyForm.shippingMethod.trim(),
        shippingCost: Number.isFinite(shippingCost) ? Math.max(0, shippingCost) : 0,
      };

      return editingPolicyId
        ? updateShippingPolicy(editingPolicyId, payload)
        : createShippingPolicy(payload);
    },
    onSuccess: async (policy) => {
      await queryClient.invalidateQueries({ queryKey: ["shipping-policies"] });
      setSelectedShippingPolicyId(String(policy.id));
      setPolicyForm({ name: "", description: "", carrier: "", shippingMethod: "", shippingCost: "0" });
      setEditingPolicyId(null);
      setPolicyDialogOpen(false);
      toast({ title: editingPolicyId ? "Shipping policy updated" : "Shipping policy created" });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to save shipping policy", description: error.message, variant: "destructive" });
    },
  });
  const requestOverrideMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId || !selectedCustomer) {
        throw new Error("Select a customer before requesting approval.");
      }

      const overdueInvoiceList = pastDueInvoices
        .map((invoice) => `${invoice.invoiceNumber}: ${formatCurrency(invoice.balanceDue)} due ${formatDateValue(invoice.dueDate)}`)
        .join("; ");

      await Promise.all([
        createCustomerActivity(selectedCustomerId, {
          activityType: "task",
          subject: "Credit override approval requested",
          details: `Override requested from new order flow. Available credit: ${formatCurrency(customerAr?.availableCredit ?? 0)}. Past-due invoices: ${overdueInvoiceList || "None listed."}`,
          createdBy: "Sales Team",
          isCompleted: false,
        }),
        createCollaborationTask({
          title: `Credit override approval needed for ${selectedCustomer.name}`,
          notes: `New order is blocked for ${selectedCustomer.name}. Available credit: ${formatCurrency(customerAr?.availableCredit ?? 0)}. A/R balance: ${formatCurrency(customerAr?.balance ?? 0)}.${overdueInvoiceList ? ` Past-due invoices: ${overdueInvoiceList}.` : ""}`,
          priority: "high",
          category: "Accounts",
        }),
      ]);
    },
    onSuccess: () => {
      toast({
        title: "Override approval requested",
        description: "A follow-up approval task was created for the blocked account.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to request override approval", description: error.message, variant: "destructive" });
    },
  });

  const selectedCustomer = customerList.find((customer) => customer.id === selectedCustomerId);
  const selectedCustomerCrm = customerCrmQuery.data ?? null;
  const selectedCustomerDetail = customerDetailQuery.data ?? null;
  const selectedShippingPolicy = shippingPolicies.find((policy) => String(policy.id) === selectedShippingPolicyId) ?? null;
  const selectedProduct = productList.find((product) => product.id === selectedProductId) ?? null;
  const selectedProductData: Product | ProductDetail | null = selectedProduct
    ? productDetail
      ? { ...productDetail, unitPrice: selectedProduct.unitPrice }
      : selectedProduct
    : productDetail ?? null;
  const selectedCartItem = cart.find((item) => item.product.id === selectedProductId) ?? null;
  const selectedPromoExcluded = selectedProductId ? promoPreference[selectedProductId] ?? selectedCartItem?.excludePromotion ?? false : false;

  const isCreditBlocked = customerAr?.isPastDue || (customerAr ? customerAr.availableCredit <= 0 : false);
  const pastDueInvoices = useMemo(
    () => (selectedCustomerDetail?.invoices ?? []).filter((invoice) => isInvoicePastDue(invoice)),
    [selectedCustomerDetail]
  );
  const filteredCustomerList = useMemo(() => {
    return customerList.filter((customer) => {
      switch (customerFilter) {
        case "active":
          return customer.status === "active";
        case "good":
          return customer.status === "active" && customer.currentArBalance <= 0;
        case "credit_hold":
          return customer.status === "on_hold" || customer.status === "inactive";
        case "past_due":
          return customer.currentArBalance > 0;
        case "all":
        default:
          return true;
      }
    });
  }, [customerFilter, customerList]);
  const stepItems = [
    { stepNumber: 1, label: "Customer", active: step === 1 },
    { stepNumber: 2, label: "Products", active: step === 2 },
    { stepNumber: 3, label: "Review", active: false },
    { stepNumber: 4, label: "Fulfill", active: false },
  ];
  const customerSnapshot = useMemo(() => {
    if (!selectedCustomerCrm) return [];

    return [
      {
        label: "Last order",
        value: selectedCustomerCrm.lastPurchaseDate ? formatDateValue(selectedCustomerCrm.lastPurchaseDate) : "No orders yet",
      },
      {
        label: "Primary rep",
        value: selectedCustomerCrm.assignedSalesRep || selectedCustomer?.repName || "Unassigned",
      },
      {
        label: "Top category",
        value: selectedCustomerCrm.productCategoriesPurchased[0] || "No category history",
      },
      {
        label: "Avg order value",
        value: formatCurrency(selectedCustomerCrm.averageOrderValue ?? 0),
      },
    ];
  }, [selectedCustomer, selectedCustomerCrm]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const preselectedCustomerId = Number(new URLSearchParams(window.location.search).get("customerId"));
    if (Number.isFinite(preselectedCustomerId) && preselectedCustomerId > 0) {
      setSelectedCustomerId((current) => current ?? preselectedCustomerId);
    }
  }, []);

  useEffect(() => {
    if (!selectedProductId) return;
    setDraftQuantity(1);
  }, [selectedProductId]);

  useEffect(() => {
    if (selectedShippingPolicyId !== "none") return;
    if (shippingPolicies.length > 0) {
      setSelectedShippingPolicyId(String(shippingPolicies[0].id));
    }
  }, [selectedShippingPolicyId, shippingPolicies]);

  const cartMetrics = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let totalUnits = 0;

    const items = cart.map((item) => {
      const lineSubtotal = item.product.unitPrice * item.quantity;
      const { promotion, discount } = item.excludePromotion
        ? { promotion: null, discount: 0 }
        : getBestPromotion(item.product.id, promotionList, item.product.unitPrice, item.quantity);

      subtotal += lineSubtotal;
      discountTotal += discount;
      totalUnits += item.quantity;

      return {
        ...item,
        lineSubtotal,
        discount,
        lineTotal: lineSubtotal - discount,
        promotionName: promotion?.name ?? null,
      };
    });

    return {
      items,
      subtotal,
      discountTotal,
      total: subtotal - discountTotal,
      totalUnits,
    };
  }, [cart, promotionList]);

  const shippingCost = selectedShippingPolicy?.shippingCost ?? 0;
  const orderTotal = cartMetrics.total + shippingCost;

  const selectedPromotionSummary = useMemo(() => {
    if (!selectedProductData) return { promotion: null as Promotion | null, discount: 0 };
    if (selectedPromoExcluded) return { promotion: null as Promotion | null, discount: 0 };

    if (productDetail?.activePromotion) {
      return {
        promotion: productDetail.activePromotion,
        discount: getPromotionDiscount(productDetail.activePromotion, selectedProductData.unitPrice, draftQuantity),
      };
    }

    return getBestPromotion(selectedProductData.id, promotionList, selectedProductData.unitPrice, draftQuantity);
  }, [draftQuantity, productDetail, promotionList, selectedProductData, selectedPromoExcluded]);

  const handleNextStep = () => {
    if (selectedCustomerId && !isCreditBlocked) {
      setStep(2);
    }
  };

  const getSkuOrderState = (product: Product | ProductDetail | null, requestedQuantity: number, currentQuantity = 0) => {
    if (!product || requestedQuantity <= 0) {
      return { canAdd: false, message: null as string | null };
    }

    const availableInventory = product.inventoryQty ?? 0;
    const backorderAllowed = !product.inStock;
    const totalRequestedQty = currentQuantity + requestedQuantity;

    if (!backorderAllowed && availableInventory <= 0) {
      return {
        canAdd: false,
        message: "This SKU is unavailable and cannot be added right now.",
      };
    }

    if (!backorderAllowed && totalRequestedQty > availableInventory) {
      return {
        canAdd: false,
        message: `Only ${availableInventory} units are available for this SKU.`,
      };
    }

    if (backorderAllowed) {
      return {
        canAdd: true,
        message: product.etaDate
          ? `Backordered units are allowed. ETA ${formatDateValue(product.etaDate)}.`
          : "Backordered units are allowed for this SKU.",
      };
    }

    return {
      canAdd: true,
      message: `${availableInventory} units available to allocate immediately.`,
    };
  };

  const currentCartQty = selectedCartItem?.quantity ?? 0;
  const selectedSkuState = getSkuOrderState(selectedProductData, draftQuantity, currentCartQty);
  const quantityMessage = selectedSkuState.message;
  const canAddSelectedSku = selectedSkuState.canAdd;

  const adjustDraftQuantity = (delta: number) => {
    setDraftQuantity((current) => Math.max(1, current + delta));
  };

  const parsePositiveInteger = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const next = Number.parseInt(trimmed, 10);
    if (Number.isNaN(next)) return null;

    return Math.max(1, next);
  };

  const handleDraftQuantityChange = (value: string) => {
    const next = parsePositiveInteger(value);
    if (next === null) {
      setDraftQuantity(1);
      return;
    }
    setDraftQuantity(next);
  };

  const getQuickAddQuantity = (productId: number) => parsePositiveInteger(quickAddQuantities[productId] ?? "") ?? 1;

  const setQuickAddQuantity = (productId: number, value: string) => {
    setQuickAddQuantities((current) => ({
      ...current,
      [productId]: value.replace(/[^\d]/g, ""),
    }));
  };

  const addProductToOrder = ({
    product,
    quantity,
    excludePromotion,
    promotionName,
  }: {
    product: Product;
    quantity: number;
    excludePromotion: boolean;
    promotionName?: string | null;
  }) => {
    if (quantity <= 0) return;

    setCart((current) => {
      const existingItem = current.find((item) => item.product.id === product.id);
      if (existingItem) {
        return current.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                product,
                quantity: item.quantity + quantity,
                excludePromotion,
              }
            : item
        );
      }

      return [
        ...current,
        {
          product,
          quantity,
          excludePromotion,
        },
      ];
    });

    toast({
      title: "SKU added to order",
      description: excludePromotion
        ? `${product.sku} added without promo pricing.`
        : promotionName
          ? `${product.sku} added with ${promotionName}.`
          : `${product.sku} added to the order summary.`,
    });
  };

  const addSelectedSkuToOrder = () => {
    if (!selectedProduct || !selectedProductData || !canAddSelectedSku) return;

    addProductToOrder({
      product: selectedProduct,
      quantity: draftQuantity,
      excludePromotion: selectedPromoExcluded,
      promotionName: selectedPromoExcluded ? null : selectedPromotionSummary.promotion?.name ?? null,
    });
  };

  const handleOpenProductDetail = (productId: number) => {
    setSelectedProductId(productId);
    setIsDetailOpen(true);
  };

  const handleQuickAdd = (product: Product, requestedQuantity = 1) => {
    const quantity = Math.max(1, requestedQuantity);
    const currentQuantity = cart.find((item) => item.product.id === product.id)?.quantity ?? 0;
    const skuState = getSkuOrderState(product, quantity, currentQuantity);

    if (!skuState.canAdd) {
      toast({
        title: "Unable to add SKU",
        description: skuState.message ?? "This SKU cannot be added right now.",
        variant: "destructive",
      });
      return;
    }

    const bestPromotion = getBestPromotion(product.id, promotionList, product.unitPrice, quantity);
    addProductToOrder({
      product,
      quantity,
      excludePromotion: false,
      promotionName: bestPromotion.promotion?.name ?? null,
    });

    setQuickAddQuantities((current) => ({
      ...current,
      [product.id]: "1",
    }));
  };

  const updateCartQuantity = (productId: number, nextQuantity: number) => {
    setCart((current) => {
      if (nextQuantity <= 0) {
        return current.filter((item) => item.product.id !== productId);
      }
      return current.map((item) => (item.product.id === productId ? { ...item, quantity: nextQuantity } : item));
    });
  };

  const handleCartQuantityChange = (productId: number, value: string) => {
    const next = parsePositiveInteger(value);
    if (next === null) return;
    updateCartQuantity(productId, next);
  };

  const handleSubmit = () => {
    if (!selectedCustomerId || cart.length === 0) return;

    createOrderMutation.mutate(
      {
        data: {
          customerId: selectedCustomerId,
          lineItems: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            excludePromotion: item.excludePromotion,
          })),
          shippingPolicyId: selectedShippingPolicy?.id ?? null,
          shippingMethod: selectedShippingPolicy?.shippingMethod,
          shippingCost,
        },
      },
      {
        onSuccess: (order) => {
          const productIds = [...new Set(cart.map((item) => item.product.id))];
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(order.id) }),
            ...productIds.map((productId) =>
              queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(productId) })
            ),
          ]);
          toast({
            title: "Order Created",
            description: `Order #${order.orderNumber} placed successfully.`,
          });
          setLocation(`/orders/${order.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to create order.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const startEditingPolicy = (policy: ShippingPolicyRecord) => {
    setEditingPolicyId(policy.id);
    setPolicyForm({
      name: policy.name,
      description: policy.description ?? "",
      carrier: policy.carrier ?? "",
      shippingMethod: policy.shippingMethod,
      shippingCost: String(policy.shippingCost),
    });
    setPolicyDialogOpen(true);
  };

  const startCreatingPolicy = () => {
    setEditingPolicyId(null);
    setPolicyForm({ name: "", description: "", carrier: "", shippingMethod: "", shippingCost: "0" });
    setPolicyDialogOpen(true);
  };

  const handleViewPastDueInvoices = () => {
    if (!selectedCustomerId) return;
    setLocation(`/ar?customerId=${selectedCustomerId}`);
  };

  const handleSendStatement = async () => {
    if (!selectedCustomerId || !selectedCustomer) return;

    const detail =
      selectedCustomerDetail ??
      (await fetchJson<NonNullable<typeof selectedCustomerDetail>>(`/api/customers/${selectedCustomerId}`));
    const overdueInvoices = detail.invoices.filter((invoice) => isInvoicePastDue(invoice));

    if (overdueInvoices.length === 0) {
      toast({
        title: "No past-due invoices",
        description: "This customer does not currently have overdue invoices to include in a statement.",
      });
      return;
    }

    const recipient = detail.email || selectedCustomer.email;
    if (!recipient) {
      toast({
        title: "No customer email on file",
        description: "Add an email address for this customer before sending a statement.",
        variant: "destructive",
      });
      return;
    }

    const bodyLines = [
      `Hello ${selectedCustomer.primaryContact || selectedCustomer.name},`,
      "",
      "Please find the current past-due balance on your account below:",
      "",
      ...overdueInvoices.map(
        (invoice) => `- ${invoice.invoiceNumber}: ${formatCurrency(invoice.balanceDue)} due ${formatDateValue(invoice.dueDate)}`
      ),
      "",
      `Total past-due balance: ${formatCurrency(overdueInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0))}`,
      "",
      "Please contact us if you need a copy of any invoice or would like to discuss payment timing.",
      "",
      "Thank you,",
      "Clarity Sales & Orders",
    ];

    await createCustomerActivity(selectedCustomerId, {
      activityType: "email",
      subject: "Past-due statement sent",
      details: `Statement prepared for ${recipient}. Included invoices: ${overdueInvoices.map((invoice) => invoice.invoiceNumber).join(", ")}.`,
      createdBy: "Sales Team",
      isCompleted: true,
    });

    if (typeof window !== "undefined") {
      window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(`Past-due statement for ${selectedCustomer.name}`)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    }

    toast({
      title: "Statement draft opened",
      description: `An email draft was prepared for ${recipient}.`,
    });
  };

  return (
    <AppLayout fluid scrollContent={false}>
      <div className="mx-auto box-border flex h-full min-h-0 max-w-7xl flex-col gap-6 pb-4 md:pb-5">
        <div className="shrink-0">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">New Order</h1>
              <p className="mt-1 text-muted-foreground">
                {step === 1
                  ? "Start by selecting a customer. Credit, A/R, and account restrictions are checked before products are added."
                  : `Build order for ${selectedCustomer?.name}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {stepItems.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold",
                    item.active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500"
                  )}
                >
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-white text-xs font-bold shadow-sm">
                    {item.stepNumber}
                  </span>
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {step === 1 && (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200 pb-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Select Customer</CardTitle>
                    <CardDescription className="mt-1">Search by customer, company, contact, email, or city.</CardDescription>
                  </div>
                  <Badge className="border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                    {customerList.length} customers
                  </Badge>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by name, contact, email, city..."
                    className="h-11 rounded-xl bg-slate-50 pl-8"
                    value={searchCustomer}
                    onChange={(event) => setSearchCustomer(event.target.value)}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {CUSTOMER_FILTERS.map((filterOption) => (
                    <button
                      key={filterOption.value}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                        customerFilter === filterOption.value
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      )}
                      onClick={() => setCustomerFilter(filterOption.value)}
                    >
                      {filterOption.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 p-0">
                <ScrollArea className="h-full border-t">
                  <div className="space-y-3 p-4">
                    {customersQuery.isLoading ? (
                      <div className="p-4 text-center text-muted-foreground">Loading...</div>
                    ) : filteredCustomerList.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">No customers found</div>
                    ) : (
                      filteredCustomerList.map((customer) => {
                        const isSelected = selectedCustomerId === customer.id;
                        const hasArBalance = customer.currentArBalance > 0;
                        const isCreditHold = customer.status === "on_hold" || customer.status === "inactive";

                        return (
                        <button
                          key={customer.id}
                          type="button"
                          className={cn(
                            "w-full rounded-2xl border px-4 py-4 text-left transition-all hover:border-slate-300 hover:bg-slate-50/80",
                            isSelected && "border-blue-200 bg-blue-50/70 shadow-[inset_4px_0_0_0_rgb(59,130,246)]"
                          )}
                          onClick={() => setSelectedCustomerId(customer.id)}
                        >
                          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-700">
                                {getCustomerMonogram(customer.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate font-semibold text-slate-950">{customer.name}</p>
                                  <Badge variant="outline" className={getCustomerStatusBadgeClass(customer.status)}>
                                    {formatCustomerStatusLabel(customer.status)}
                                  </Badge>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                  <span className="truncate">{customer.companyName}</span>
                                  <span className="truncate">{customer.email || customer.phone || "No direct contact saved"}</span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {isCreditHold ? (
                                    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                                      Credit block
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                      Good standing
                                    </Badge>
                                  )}
                                  {hasArBalance ? (
                                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                      Past due
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                                      {customer.paymentTerms}
                                    </Badge>
                                  )}
                                  {customer.openOrders > 0 ? (
                                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                                      {customer.openOrders} open orders
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="text-left md:text-right">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">A/R balance</p>
                              <p className={cn("mt-1 font-mono text-lg font-semibold", hasArBalance ? "text-amber-700" : "text-slate-950")}>
                                {formatCurrency(customer.currentArBalance)}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">{customer.repName || "Unassigned rep"}</p>
                            </div>
                          </div>
                        </button>
                      )})
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="min-h-0 space-y-6 xl:sticky xl:top-0 xl:self-start">
              {selectedCustomerId ? (
                <>
                  <Card className={cn("overflow-hidden rounded-[24px] border shadow-sm", isCreditBlocked ? "border-rose-200" : "border-blue-200")}>
                    <CardHeader className={cn("gap-3 border-b", isCreditBlocked ? "bg-rose-50" : "bg-blue-50")}>
                      <CardTitle className="flex items-center gap-2">
                        Customer Status
                        {isCreditBlocked ? (
                          <Badge variant="destructive">Credit Block</Badge>
                        ) : (
                          <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Approved</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{selectedCustomer?.name}</CardDescription>
                      {selectedCustomer?.primaryContact ? (
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <UserRound className="size-4" />
                            {selectedCustomer.primaryContact}
                          </span>
                          {selectedCustomer.email ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="size-4" />
                              {selectedCustomer.email}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </CardHeader>
                    <CardContent className="space-y-5 p-6">
                      {arLoading ? (
                        <div className="text-sm text-muted-foreground">Checking credit status...</div>
                      ) : customerAr ? (
                        <>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Available Credit</p>
                            <p
                              className={cn(
                                "font-mono text-4xl font-bold tracking-tight",
                                customerAr.availableCredit <= 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-500"
                              )}
                            >
                              {formatCurrency(customerAr.availableCredit)}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border bg-slate-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Credit Limit</p>
                              <p className="mt-1 font-mono text-lg font-semibold">{formatCurrency(customerAr.creditLimit)}</p>
                            </div>
                            <div className="rounded-2xl border bg-slate-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">A/R Balance</p>
                              <p className={cn("mt-1 font-mono text-lg font-semibold", customerAr.isPastDue && "text-destructive")}>
                                {formatCurrency(customerAr.balance)}
                              </p>
                            </div>
                            <div className="rounded-2xl border bg-slate-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Past Due</p>
                              <p className={cn("mt-1 text-lg font-semibold", customerAr.isPastDue ? "text-destructive" : "text-slate-950")}>
                                {customerAr.isPastDue ? "Yes" : "No"}
                              </p>
                            </div>
                            <div className="rounded-2xl border bg-slate-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Open Orders</p>
                              <p className="mt-1 text-lg font-semibold text-slate-950">{selectedCustomer?.openOrders ?? 0}</p>
                            </div>
                          </div>

                          {isCreditBlocked ? (
                            <>
                              <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-900">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Order Blocked</AlertTitle>
                                <AlertDescription>
                                  This customer cannot place new orders.
                                  {customerAr.isPastDue
                                    ? " They have past due invoices."
                                    : " They have exceeded their available credit."}
                                </AlertDescription>
                              </Alert>
                              <div className="grid gap-2">
                                <Button variant="destructive" onClick={handleViewPastDueInvoices}>
                                  View past due invoices
                                </Button>
                                <Button variant="outline" onClick={() => void handleSendStatement()}>
                                  Send statement
                                </Button>
                                <Button variant="outline" disabled={requestOverrideMutation.isPending} onClick={() => requestOverrideMutation.mutate()}>
                                  {requestOverrideMutation.isPending ? "Requesting..." : "Request override approval"}
                                </Button>
                              </div>
                            </>
                          ) : (
                            <Button className="w-full" onClick={handleNextStep}>
                              Continue to Catalog <ArrowRight className="ml-2 size-4" />
                            </Button>
                          )}
                        </>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card className="rounded-[24px] border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle>Customer Snapshot</CardTitle>
                      <CardDescription>Useful context before creating the order.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {customerCrmQuery.isLoading ? (
                        <div className="text-sm text-muted-foreground">Loading account context...</div>
                      ) : (
                        <>
                          <div className="space-y-3">
                            {customerSnapshot.map((item) => (
                              <div key={item.label} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                                <span className="text-sm text-muted-foreground">{item.label}</span>
                                <span className="text-right text-sm font-semibold text-slate-950">{item.value}</span>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground">
                            {selectedCustomerCrm?.purchaseFrequency
                              ? `Buying cadence: ${selectedCustomerCrm.purchaseFrequency}.`
                              : "Order history will surface repeat-buying patterns here as activity builds."}{" "}
                            {selectedCustomerCrm?.mostPurchasedProducts[0]
                              ? `Top SKU: ${selectedCustomerCrm.mostPurchasedProducts[0].name}.`
                              : "Recently purchased products can be prioritized in the next step once history is available."}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="rounded-[24px] border-2 border-dashed bg-card/50 p-8 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-4 size-12 opacity-50" />
                  <h3 className="mb-1 text-lg font-medium">Select a customer</h3>
                  <p className="mx-auto max-w-xs">Choose a customer from the list to check credit status and start a new order.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid h-full min-h-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,2.1fr)]">
            <Card className="flex min-h-0 flex-col overflow-hidden">
              <CardHeader className="border-b bg-muted/20 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-3">
                    Order Summary
                    <Badge variant="secondary" className="bg-primary text-primary-foreground">
                      {cartMetrics.totalUnits} units
                    </Badge>
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className="mr-2 size-4" /> Change Customer
                    </Button>
                    <Button disabled={cart.length === 0 || createOrderMutation.isPending} onClick={handleSubmit}>
                      {createOrderMutation.isPending ? "Processing..." : "Submit Order"}
                    </Button>
                  </div>
                </div>
                {selectedCustomer ? (
                  <CardDescription>
                    Building order for {selectedCustomer.name}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="shrink-0 border-b bg-card p-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Shipping policy</p>
                      <p className="mt-1 text-sm text-muted-foreground">Pick a saved policy for carrier, method, and default freight cost.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={startCreatingPolicy}>Manage policies</Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <Select value={selectedShippingPolicyId} onValueChange={setSelectedShippingPolicyId}>
                      <SelectTrigger>
                        <SelectValue placeholder={shippingPoliciesQuery.isLoading ? "Loading policies..." : "Select a shipping policy"} />
                      </SelectTrigger>
                      <SelectContent>
                        {shippingPolicies.map((policy) => (
                          <SelectItem key={policy.id} value={String(policy.id)}>
                            {policy.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedShippingPolicy ? (
                      <Button variant="ghost" size="sm" onClick={() => startEditingPolicy(selectedShippingPolicy)}>
                        <PencilLine className="mr-2 size-4" /> Edit
                      </Button>
                    ) : null}
                  </div>
                  {selectedShippingPolicy ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <div className="font-medium text-slate-950">{selectedShippingPolicy.name}</div>
                      <div className="mt-1 text-muted-foreground">
                        {(selectedShippingPolicy.carrier ?? "Carrier TBD")} · {selectedShippingPolicy.shippingMethod}
                      </div>
                      {selectedShippingPolicy.description ? (
                        <div className="mt-2 text-muted-foreground">{selectedShippingPolicy.description}</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                      Create a shipping policy to standardize order handoff.
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">{formatCurrency(cartMetrics.subtotal)}</span>
                  </div>
                  {cartMetrics.discountTotal > 0 ? (
                    <div className="flex items-center justify-between text-sm text-emerald-700">
                      <span className="flex items-center gap-1">
                        <Tag className="size-3" /> Promotions
                      </span>
                      <span className="font-mono">-{formatCurrency(cartMetrics.discountTotal)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-mono">{formatCurrency(shippingCost)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="font-mono text-primary">{formatCurrency(orderTotal)}</span>
                  </div>
                </div>
              </CardContent>
              <CardContent className="min-h-0 flex-1 p-0">
                {cartMetrics.items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center text-muted-foreground">
                    <ShoppingCart className="mb-3 size-10 opacity-50" />
                    <p className="font-medium">No SKUs added yet</p>
                    <p className="mt-1 text-sm">Use the browser on the right to add products into this order.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="space-y-4 p-4">
                      {cartMetrics.items.map((item) => (
                        <div key={item.product.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold">{item.product.name}</p>
                              <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.product.sku}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.promotionName ? (
                                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-700">
                                    {item.promotionName}
                                  </Badge>
                                ) : item.excludePromotion ? (
                                  <Badge variant="outline">Promo removed</Badge>
                                ) : null}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-semibold text-primary">{formatCurrency(item.lineTotal)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.quantity} × {formatCurrency(item.product.unitPrice)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="flex items-center rounded-xl border bg-muted/20 p-1">
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}>
                                <Minus className="size-3.5" />
                              </Button>
                              <Input
                                value={item.quantity}
                                onChange={(event) => handleCartQuantityChange(item.product.id, event.target.value)}
                                inputMode="numeric"
                                aria-label={`Order quantity for ${item.product.name}`}
                                className="h-8 w-16 border-0 bg-transparent px-1 text-center font-mono text-sm shadow-none focus-visible:ring-0"
                              />
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}>
                                <Plus className="size-3.5" />
                              </Button>
                            </div>
                            {item.discount > 0 ? (
                              <p className="text-sm text-emerald-700">Saved {formatCurrency(item.discount)}</p>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => updateCartQuantity(item.product.id, 0)}>
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="flex min-h-0 flex-col overflow-hidden">
              <CardHeader className="gap-4 border-b bg-card/80 py-5">
                <div>
                  <CardTitle>SKU Browser</CardTitle>
                  <CardDescription>Search by SKU number or product name, then view details or add items directly into the order.</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search SKU # or product name"
                    className="bg-background pl-8"
                    value={searchProduct}
                    onChange={(event) => setSearchProduct(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: "All" },
                    { value: "in", label: "In Stock" },
                    { value: "out", label: "Out of Stock" },
                  ].map((filterOption) => (
                    <Button
                      key={filterOption.value}
                      size="sm"
                      variant={inventoryFilter === filterOption.value ? "default" : "outline"}
                      onClick={() => setInventoryFilter(filterOption.value as InventoryFilter)}
                    >
                      {filterOption.label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 p-0">
                <ScrollArea className="h-full">
                  <div className="space-y-3 p-4">
                    {productsLoading ? (
                      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">Loading catalog...</div>
                    ) : productList.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">No SKUs match the current search.</div>
                    ) : (
                      productList.map((product) => {
                        const requestedQuantity = getQuickAddQuantity(product.id);
                        const quickAddState = getSkuOrderState(
                          product,
                          requestedQuantity,
                          cart.find((item) => item.product.id === product.id)?.quantity ?? 0
                        );
                        return (
                          <div
                            key={product.id}
                            className={cn(
                              "rounded-xl border p-3 transition-all hover:border-primary/60 hover:bg-muted/30"
                            )}
                          >
                            <div className="flex gap-3">
                              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-br from-white via-slate-50 to-slate-100 p-2">
                                <ProductImage imageUrl={product.imageUrl} label={product.name} fit="contain" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{product.sku}</p>
                                    <h3 className="line-clamp-2 font-semibold leading-tight">{product.name}</h3>
                                  </div>
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      product.inStock
                                        ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                                        : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                                    )}
                                  >
                                    {product.inStock ? "In Stock" : "Out of Stock"}
                                  </Badge>
                                </div>
                                <div className="mt-3 flex items-end justify-between gap-3">
                                  <div className="text-sm text-muted-foreground">
                                    {product.inStock ? (
                                      <span>{product.inventoryQty} available</span>
                                    ) : product.etaDate ? (
                                      <span>ETA {formatDateValue(product.etaDate)}</span>
                                    ) : (
                                      <span>Backorder pending</span>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="font-mono text-sm font-semibold text-primary">{formatCurrency(product.unitPrice)}</p>
                                    {product.orderFrequency ? (
                                      <p className="text-xs text-muted-foreground">Frequent reorder</p>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                              <p className={cn("text-sm", quickAddState.canAdd ? "text-muted-foreground" : "text-destructive")}>
                                {quickAddState.message}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  value={quickAddQuantities[product.id] ?? "1"}
                                  onChange={(event) => setQuickAddQuantity(product.id, event.target.value)}
                                  inputMode="numeric"
                                  aria-label={`Quantity for ${product.name}`}
                                  className="h-9 w-20 font-mono"
                                />
                                <Button variant="secondary" size="sm" onClick={() => handleOpenProductDetail(product.id)}>
                                  View Details
                                </Button>
                                <Button size="sm" disabled={!quickAddState.canAdd} onClick={() => handleQuickAdd(product, requestedQuantity)}>
                                  Add to Order
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
            {!selectedProductData ? (
              <div className="p-6 text-muted-foreground">Select a SKU to review details.</div>
            ) : productDetailLoading && !productDetail ? (
              <div className="p-6 text-muted-foreground">Loading product detail...</div>
            ) : (
              <div className="grid max-h-[90vh] min-h-0 gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
                <div className="border-b bg-muted/20 lg:border-b-0 lg:border-r">
                  <div className="p-6">
                    <DialogHeader>
                      <DialogTitle>{selectedProductData.name}</DialogTitle>
                      <DialogDescription>SKU #{selectedProductData.sku}</DialogDescription>
                    </DialogHeader>
                  </div>
                  <div className="px-6 pb-6">
                    <div className="overflow-hidden rounded-2xl border bg-muted/20">
                      <div className="relative aspect-square">
                        <ProductImage imageUrl={selectedProductData.imageUrl} label={selectedProductData.name} />
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" className="absolute right-3 top-3">
                              <ZoomIn className="size-4" /> Zoom
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl p-4">
                            <DialogHeader>
                              <DialogTitle>{selectedProductData.name}</DialogTitle>
                              <DialogDescription>{selectedProductData.sku}</DialogDescription>
                            </DialogHeader>
                            <div className="overflow-hidden rounded-xl border">
                              <ProductImage imageUrl={selectedProductData.imageUrl} label={selectedProductData.name} className="max-h-[70vh] object-contain" />
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border bg-slate-50/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Product View</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {productDetail?.description || "High-resolution product photography is available here for quick confirmation before ordering."}
                      </p>
                    </div>
                  </div>
                </div>

                <ScrollArea className="max-h-[90vh]">
                  <div className="space-y-6 p-6">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={cn(
                            selectedProductData.inStock
                              ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                              : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                          )}
                        >
                          {selectedProductData.inStock ? "In Stock" : "Backordered"}
                        </Badge>
                        {selectedPromotionSummary.promotion ? (
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20">
                            <Tag className="mr-1 size-3" /> Promo Available
                          </Badge>
                        ) : null}
                      </div>
                      <p className="max-w-2xl text-sm text-muted-foreground">
                        {productDetail?.description || "Review inventory, promotions, and pricing before adding units to the order."}
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border bg-muted/20 p-4">
                        <p className="text-sm text-muted-foreground">Unit Price</p>
                        <p className="mt-1 font-mono text-2xl font-semibold">{formatCurrency(selectedProductData.unitPrice)}</p>
                      </div>
                      <div className="rounded-2xl border bg-muted/20 p-4">
                        <p className="text-sm text-muted-foreground">Inventory</p>
                        <p className="mt-1 font-mono text-2xl font-semibold">{selectedProductData.inventoryQty}</p>
                      </div>
                      <div className="rounded-2xl border bg-muted/20 p-4">
                        <p className="text-sm text-muted-foreground">Availability</p>
                        <p className="mt-1 text-base font-semibold">
                          {selectedProductData.inStock ? "Ready to ship" : "Backordered"}
                        </p>
                        {selectedProductData.etaDate ? (
                          <p className="mt-1 text-sm text-muted-foreground">ETA {formatDateValue(selectedProductData.etaDate)}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">Promotions</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Active promos apply automatically and update pricing instantly.
                          </p>
                        </div>
                        {selectedPromotionSummary.promotion ? (
                          <Button
                            variant={selectedPromoExcluded ? "outline" : "secondary"}
                            size="sm"
                            onClick={() =>
                              selectedProductId &&
                              setPromoPreference((current) => ({
                                ...current,
                                [selectedProductId]: !selectedPromoExcluded,
                              }))
                            }
                          >
                            {selectedPromoExcluded ? "Reapply Promo" : "Remove Promo"}
                          </Button>
                        ) : null}
                      </div>

                      {selectedPromotionSummary.promotion ? (
                        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/80 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-blue-900">{selectedPromotionSummary.promotion.name}</p>
                              <p className="mt-1 text-sm text-blue-800">
                                {selectedPromoExcluded
                                  ? "Promo removed from this line item."
                                  : selectedPromotionSummary.promotion.discountType === "percent"
                                    ? `${selectedPromotionSummary.promotion.discountValue}% off applied automatically`
                                    : `${formatCurrency(selectedPromotionSummary.promotion.discountValue)} off per unit applied automatically`}
                              </p>
                            </div>
                            {!selectedPromoExcluded ? (
                              <div className="text-right">
                                <p className="text-xs uppercase tracking-[0.18em] text-blue-700">Savings</p>
                                <p className="font-mono text-lg font-semibold text-blue-900">
                                  -{formatCurrency(selectedPromotionSummary.discount)}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                          No active promotion is currently attached to this SKU.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border p-5">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">Quantity Entry</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Units already in order: <span className="font-mono">{currentCartQty}</span>
                          </p>
                        </div>
                        <div className="flex items-center rounded-xl border bg-muted/20 p-1">
                          <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => adjustDraftQuantity(-1)}>
                            <Minus className="size-4" />
                          </Button>
                          <Input
                            value={draftQuantity}
                            onChange={(event) => handleDraftQuantityChange(event.target.value)}
                            inputMode="numeric"
                            className="h-9 w-20 border-0 bg-transparent px-1 text-center font-mono text-base shadow-none focus-visible:ring-0"
                          />
                          <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => adjustDraftQuantity(1)}>
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl bg-muted/30 p-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Line subtotal</span>
                          <span className="font-mono">{formatCurrency(selectedProductData.unitPrice * draftQuantity)}</span>
                        </div>
                        {!selectedPromoExcluded && selectedPromotionSummary.discount > 0 ? (
                          <div className="mt-2 flex items-center justify-between text-sm text-emerald-700">
                            <span className="flex items-center gap-1">
                              <Tag className="size-3" /> Promo discount
                            </span>
                            <span className="font-mono">-{formatCurrency(selectedPromotionSummary.discount)}</span>
                          </div>
                        ) : null}
                        <Separator className="my-3" />
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Net line total</span>
                          <span className="font-mono text-xl font-semibold text-primary">
                            {formatCurrency(selectedProductData.unitPrice * draftQuantity - (selectedPromoExcluded ? 0 : selectedPromotionSummary.discount))}
                          </span>
                        </div>
                      </div>

                      <p className={cn("mt-4 text-sm", canAddSelectedSku ? "text-muted-foreground" : "text-destructive")}>
                        {quantityMessage}
                      </p>

                      <div className="mt-5 flex flex-wrap justify-end gap-3">
                        <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                          Close
                        </Button>
                        <Button disabled={!canAddSelectedSku} onClick={addSelectedSkuToOrder}>
                          Add to Order
                        </Button>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPolicyId ? "Edit shipping policy" : "Create shipping policy"}</DialogTitle>
              <DialogDescription>Saved policies keep carrier and freight choices consistent when orders are created.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!editingPolicyId && shippingPolicies.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Existing policies</p>
                  <div className="mt-3 space-y-2">
                    {shippingPolicies.map((policy) => (
                      <button
                        key={policy.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left"
                        onClick={() => startEditingPolicy(policy)}
                      >
                        <span>
                          <span className="block font-medium text-slate-950">{policy.name}</span>
                          <span className="block text-xs text-muted-foreground">{(policy.carrier ?? "Carrier TBD")} · {policy.shippingMethod}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{formatCurrency(policy.shippingCost)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="policy-name">Policy name</Label>
                <Input id="policy-name" value={policyForm.name} onChange={(event) => setPolicyForm({ ...policyForm, name: event.target.value })} />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="policy-carrier">Carrier</Label>
                  <Input id="policy-carrier" value={policyForm.carrier} onChange={(event) => setPolicyForm({ ...policyForm, carrier: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="policy-method">Shipping method</Label>
                  <Input id="policy-method" value={policyForm.shippingMethod} onChange={(event) => setPolicyForm({ ...policyForm, shippingMethod: event.target.value })} />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px]">
                <div className="grid gap-2">
                  <Label htmlFor="policy-description">Description</Label>
                  <Textarea id="policy-description" value={policyForm.description} onChange={(event) => setPolicyForm({ ...policyForm, description: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="policy-cost">Shipping cost</Label>
                  <Input id="policy-cost" inputMode="decimal" value={policyForm.shippingCost} onChange={(event) => setPolicyForm({ ...policyForm, shippingCost: event.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPolicyDialogOpen(false)}>Cancel</Button>
                <Button
                  disabled={saveShippingPolicyMutation.isPending || policyForm.name.trim().length < 1 || policyForm.shippingMethod.trim().length < 1}
                  onClick={() => saveShippingPolicyMutation.mutate()}
                >
                  {saveShippingPolicyMutation.isPending ? "Saving..." : editingPolicyId ? "Save changes" : "Create policy"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
