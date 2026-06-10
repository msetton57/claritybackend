import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetProductQueryKey,
  getGetProductsQueryKey,
  type ProductDetail,
  useGetProduct,
  useGetProducts,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import { createProductRecord } from "@/lib/operations";
import { cn } from "@/lib/utils";
import {
  CalendarRange,
  Download,
  ImagePlus,
  Package,
  PencilLine,
  Save,
  Search,
  Tag,
  X,
} from "lucide-react";

type InventoryFilter = "all" | "in" | "out";
type DetailMode = "view" | "edit";

interface ProductSalesSummary {
  productId: number;
  startDate: string;
  endDate: string;
  unitsSold: number;
  orderCount: number;
  revenue: number;
}

interface ProductFormState {
  sku: string;
  name: string;
  description: string;
  unitPrice: string;
  inventoryQty: string;
  etaDate: string;
  imageUrl: string;
  packSize: string;
  certifications: string;
  brochureUrl: string;
  infoSheetUrl: string;
}

function formatDateValue(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
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
    return (
      <img
        src={imageUrl}
        alt={label}
        className={cn(
          "h-full w-full",
          fit === "contain" ? "object-contain bg-white p-4" : "object-cover",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-500",
        className
      )}
    >
      <ImagePlus className="mb-3 size-10" />
      <span className="max-w-[14rem] px-4 text-center text-sm font-medium">{label}</span>
    </div>
  );
}

function createFormState(product: ProductDetail | null): ProductFormState {
  return {
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    unitPrice: product ? String(product.unitPrice) : "",
    inventoryQty: product ? String(product.inventoryQty) : "",
    etaDate: product?.etaDate ? String(product.etaDate).slice(0, 10) : "",
    imageUrl: product?.imageUrl ?? "",
    packSize: product?.packSize ?? "",
    certifications: product?.certifications?.join(", ") ?? "",
    brochureUrl: product?.brochureUrl ?? "",
    infoSheetUrl: product?.infoSheetUrl ?? "",
  };
}

export default function Catalog() {
  const [location] = useLocation();
  const [search, setSearch] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>("all");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [mode, setMode] = useState<DetailMode>("view");
  const [startDate, setStartDate] = useState(dateInputValue(new Date(Date.now() - 89 * 24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState(dateInputValue(new Date()));
  const [form, setForm] = useState<ProductFormState>(createFormState(null));
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    sku: "",
    name: "",
    category: "General",
    unitPrice: "",
    inventoryQty: "0",
    imageUrl: "",
    etaDate: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products, isLoading: productsLoading } = useGetProducts({
    q: search || undefined,
    inStock: inventoryFilter === "all" ? undefined : inventoryFilter === "in",
  });
  const productList = products ?? [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearch(params.get("q") ?? "");
  }, [location]);

  useEffect(() => {
    if (productList.length === 0) {
      setSelectedProductId(null);
      return;
    }

    const stillSelected = selectedProductId ? productList.some((product) => product.id === selectedProductId) : false;
    if (!stillSelected) {
      setSelectedProductId(productList[0].id);
    }
  }, [productList, selectedProductId]);

  const { data: selectedProduct, isLoading: productLoading } = useGetProduct(selectedProductId || 0);

  useEffect(() => {
    setForm(createFormState(selectedProduct ?? null));
    setMode("view");
  }, [selectedProduct?.id]);

  const productSalesQuery = useQuery<ProductSalesSummary>({
    queryKey: ["product-sales", selectedProductId, startDate, endDate],
    enabled: !!selectedProductId,
    queryFn: async () => {
      const response = await fetch(
        `/api/products/${selectedProductId}/sales?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      );
      if (!response.ok) {
        throw new Error("Failed to load product sales");
      }
      return response.json() as Promise<ProductSalesSummary>;
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (payload: ProductFormState) => {
      if (!selectedProductId) {
        throw new Error("No product selected");
      }

      const body = {
        sku: payload.sku.trim(),
        name: payload.name.trim(),
        description: payload.description.trim() || null,
        unitPrice: Number(payload.unitPrice),
        inventoryQty: Number(payload.inventoryQty),
        etaDate: payload.etaDate || null,
        imageUrl: payload.imageUrl.trim() || null,
        packSize: payload.packSize.trim() || null,
        certifications: payload.certifications
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        brochureUrl: payload.brochureUrl.trim() || null,
        infoSheetUrl: payload.infoSheetUrl.trim() || null,
      };

      const response = await fetch(`/api/products/${selectedProductId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to save product" }));
        throw new Error(error.error ?? "Failed to save product");
      }

      return response.json() as Promise<ProductDetail>;
    },
    onSuccess: async (updated) => {
      toast({
        title: "Catalog updated",
        description: `${updated.name} was saved successfully.`,
      });
      setMode("view");
      setForm(createFormState(updated));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/products"] }),
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(updated.id) }),
      ]);
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to save catalog item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: () => createProductRecord({
      sku: createForm.sku.trim(),
      name: createForm.name.trim(),
      category: createForm.category.trim() || "General",
      unitPrice: Number(createForm.unitPrice),
      inventoryQty: Number(createForm.inventoryQty),
      imageUrl: createForm.imageUrl.trim() || null,
      etaDate: createForm.etaDate || null,
    }),
    onSuccess: async () => {
      toast({ title: "Product created" });
      setCreateOpen(false);
      setCreateForm({ sku: "", name: "", category: "General", unitPrice: "", inventoryQty: "0", imageUrl: "", etaDate: "" });
      await queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to create product", description: error.message, variant: "destructive" });
    },
  });

  const activePromoText = useMemo(() => {
    if (!selectedProduct?.activePromotion) return null;
    const promotion = selectedProduct.activePromotion;
    return promotion.discountType === "percent"
      ? `${promotion.discountValue}% off active`
      : `${formatCurrency(promotion.discountValue)} off per unit active`;
  }, [selectedProduct]);
  const selectedProductArchived = (selectedProduct as (ProductDetail & { archived?: boolean; archiveReason?: string | null }) | undefined)?.archived ?? false;

  const handleFormChange = (field: keyof ProductFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitEdit = () => {
    if (!form.name.trim() || !form.sku.trim()) {
      toast({
        title: "Missing product details",
        description: "SKU and title are required.",
        variant: "destructive",
      });
      return;
    }

    if (Number.isNaN(Number(form.unitPrice)) || Number(form.unitPrice) < 0) {
      toast({
        title: "Invalid price",
        description: "Unit price must be zero or greater.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isInteger(Number(form.inventoryQty)) || Number(form.inventoryQty) < 0) {
      toast({
        title: "Invalid stock level",
        description: "Inventory must be a whole number zero or greater.",
        variant: "destructive",
      });
      return;
    }

    updateProductMutation.mutate(form);
  };

  return (
    <AppLayout fluid scrollContent={false}>
      <div className="box-border flex h-full min-h-0 flex-col gap-4 overflow-hidden pb-4 md:pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Catalog Manager</h1>
            <p className="mt-1 text-muted-foreground">
              Browse the SKU catalog, inspect product detail, review sales activity, and maintain product data.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Package className="mr-2 size-4" />
              New Product
            </Button>
            <Button variant={mode === "view" ? "secondary" : "outline"} onClick={() => setMode("view")} disabled={!selectedProduct}>
              Product View
            </Button>
            <Button variant={mode === "edit" ? "default" : "outline"} onClick={() => setMode("edit")} disabled={!selectedProduct}>
              <PencilLine className="mr-2 size-4" />
              Edit Catalog
            </Button>
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[440px_minmax(0,1fr)]">
          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader className="gap-3 border-b bg-card/80 py-4">
              <div>
                <CardTitle>Catalog Browser</CardTitle>
                <CardDescription>Search by SKU or title and filter stock status to move through the assortment quickly.</CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="bg-background pl-8"
                  placeholder="Search SKU # or product name"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "in", label: "In Stock" },
                  { value: "out", label: "Out of Stock" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    size="sm"
                    variant={inventoryFilter === option.value ? "default" : "outline"}
                    onClick={() => setInventoryFilter(option.value as InventoryFilter)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-0">
              <ScrollArea className="h-full min-h-0">
                <div className="space-y-3 p-3">
                  {productsLoading ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">Loading catalog...</div>
                  ) : productList.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">No products match the current search.</div>
                  ) : (
                    productList.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setSelectedProductId(product.id)}
                        className={cn(
                          "grid w-full grid-cols-[80px_minmax(0,1fr)] items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/60 hover:bg-muted/30",
                          selectedProductId === product.id && "border-primary bg-primary/5 shadow-sm"
                        )}
                      >
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted/20">
                          <ProductImage imageUrl={product.imageUrl} label={product.name} fit="contain" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="min-w-0">
                            <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{product.sku}</p>
                            <h3 className="mt-1 whitespace-normal break-words text-[1.05rem] font-semibold leading-snug">
                              {product.name}
                            </h3>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "shrink-0",
                                product.inStock
                                  ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                              )}
                            >
                              {product.inStock ? "In Stock" : "Out"}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-end justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                              <p>{product.inStock ? `${product.inventoryQty} on hand` : `ETA ${formatDateValue(product.etaDate) ?? "Pending"}`}</p>
                              {product.packSize ? <p>{product.packSize}</p> : null}
                            </div>
                            <p className="font-mono font-semibold text-primary">{formatCurrency(product.unitPrice)}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader className="border-b bg-card/80 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle>Catalog Detail</CardTitle>
                  <CardDescription>
                    Review product imagery, sales activity, promotions, downloads, and core catalog metadata.
                  </CardDescription>
                </div>
                {selectedProduct ? (
                  <Badge variant="outline" className="font-mono">
                    {selectedProduct.sku}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-auto p-5">
              {!selectedProductId ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed text-center text-muted-foreground">
                  <Package className="mb-4 size-12 opacity-50" />
                  <h3 className="text-lg font-medium">Select a catalog item</h3>
                  <p className="mt-1 max-w-sm">Choose a product from the browser to review details or edit the catalog entry.</p>
                </div>
              ) : productLoading || !selectedProduct ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">Loading product detail...</div>
              ) : mode === "edit" ? (
                <div className="mx-auto max-w-5xl space-y-5">
                  <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="overflow-hidden rounded-2xl border bg-muted/20">
                      <div className="aspect-square">
                        <ProductImage
                          imageUrl={form.imageUrl}
                          label={form.name || selectedProduct.name}
                          fit="contain"
                        />
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">SKU</label>
                          <Input value={form.sku} onChange={(event) => handleFormChange("sku", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Product Title</label>
                          <Input value={form.name} onChange={(event) => handleFormChange("name", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Unit Price</label>
                          <Input value={form.unitPrice} onChange={(event) => handleFormChange("unitPrice", event.target.value)} inputMode="decimal" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Inventory Qty</label>
                          <Input value={form.inventoryQty} onChange={(event) => handleFormChange("inventoryQty", event.target.value)} inputMode="numeric" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Pack Size</label>
                          <Input value={form.packSize} onChange={(event) => handleFormChange("packSize", event.target.value)} placeholder="12 pack" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">ETA Date</label>
                          <Input type="date" value={form.etaDate} onChange={(event) => handleFormChange("etaDate", event.target.value)} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">Image URL</label>
                          <Input value={form.imageUrl} onChange={(event) => handleFormChange("imageUrl", event.target.value)} placeholder="https://..." />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">Description</label>
                          <Textarea value={form.description} onChange={(event) => handleFormChange("description", event.target.value)} rows={5} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">Certifications</label>
                          <Input
                            value={form.certifications}
                            onChange={(event) => handleFormChange("certifications", event.target.value)}
                            placeholder="NSF, UL Listed, RoHS"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Brochure URL</label>
                          <Input value={form.brochureUrl} onChange={(event) => handleFormChange("brochureUrl", event.target.value)} placeholder="https://..." />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Info Sheet URL</label>
                          <Input value={form.infoSheetUrl} onChange={(event) => handleFormChange("infoSheetUrl", event.target.value)} placeholder="https://..." />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={submitEdit} disabled={updateProductMutation.isPending}>
                          <Save className="mr-2 size-4" />
                          {updateProductMutation.isPending ? "Saving..." : "Save Catalog Changes"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setForm(createFormState(selectedProduct));
                            setMode("view");
                          }}
                        >
                          <X className="mr-2 size-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-6xl space-y-5">
                  <div className="grid gap-5 2xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-2xl border bg-muted/20">
                        <div className="aspect-square">
                          <ProductImage imageUrl={selectedProduct.imageUrl} label={selectedProduct.name} fit="contain" />
                        </div>
                      </div>
                      <Card className="shadow-none">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Downloads</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {selectedProduct.brochureUrl ? (
                            <Button asChild className="w-full justify-start">
                              <a href={selectedProduct.brochureUrl} target="_blank" rel="noreferrer">
                                <Download className="mr-2 size-4" />
                                Download Brochure
                              </a>
                            </Button>
                          ) : null}
                          {selectedProduct.infoSheetUrl ? (
                            <Button asChild variant="outline" className="w-full justify-start">
                              <a href={selectedProduct.infoSheetUrl} target="_blank" rel="noreferrer">
                                <Download className="mr-2 size-4" />
                                Download Info Sheet
                              </a>
                            </Button>
                          ) : null}
                          {!selectedProduct.brochureUrl && !selectedProduct.infoSheetUrl ? (
                            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                              No brochure or info sheet is attached to this SKU yet.
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="min-w-0 space-y-6">
                      <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge
                          variant="secondary"
                            className={cn(
                              selectedProduct.inStock
                                ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                                : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                            )}
                          >
                            {selectedProduct.inStock ? "In Stock" : "Out of Stock"}
                        </Badge>
                        {selectedProductArchived ? (
                          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">Archived</Badge>
                        ) : null}
                        {selectedProduct.activePromotion ? (
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20">
                              <Tag className="mr-1 size-3" />
                              Promo Active
                            </Badge>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <h2 className="max-w-full text-balance text-3xl font-semibold tracking-tight break-words">
                            {selectedProduct.name}
                          </h2>
                          <p className="mt-2 max-w-full break-words text-sm text-muted-foreground">
                            SKU #{selectedProduct.sku}
                            {selectedProduct.description ? ` • ${selectedProduct.description}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateProductMutation.mutate({
                            ...form,
                            sku: selectedProduct.sku,
                            name: selectedProduct.name,
                            description: selectedProduct.description ?? "",
                            unitPrice: String(selectedProduct.unitPrice),
                            inventoryQty: String(selectedProduct.inventoryQty),
                            etaDate: selectedProduct.etaDate ?? "",
                            imageUrl: selectedProduct.imageUrl ?? "",
                            packSize: selectedProduct.packSize ?? "",
                            certifications: (selectedProduct.certifications ?? []).join(", "),
                            brochureUrl: selectedProduct.brochureUrl ?? "",
                            infoSheetUrl: selectedProduct.infoSheetUrl ?? "",
                            archived: !selectedProductArchived,
                            archiveReason: selectedProductArchived ? null : "Archived from catalog workspace",
                          } as any)}
                        >
                          {selectedProductArchived ? "Restore" : "Archive"}
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border bg-muted/20 p-4">
                          <p className="text-sm text-muted-foreground">Unit Price</p>
                          <p className="mt-1 font-mono text-2xl font-semibold">{formatCurrency(selectedProduct.unitPrice)}</p>
                        </div>
                        <div className="rounded-2xl border bg-muted/20 p-4">
                          <p className="text-sm text-muted-foreground">Inventory</p>
                          <p className="mt-1 font-mono text-2xl font-semibold">{selectedProduct.inventoryQty}</p>
                        </div>
                        <div className="rounded-2xl border bg-muted/20 p-4">
                          <p className="text-sm text-muted-foreground">Pack Size</p>
                          <p className="mt-1 text-base font-semibold">{selectedProduct.packSize || "Not set"}</p>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <Card className="shadow-none">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Availability</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Stock status</span>
                              <span className="font-medium">{selectedProduct.inStock ? "Ready to ship" : "Backordered"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Qty on hand</span>
                              <span className="font-mono">{selectedProduct.inventoryQty}</span>
                            </div>
                            {!selectedProduct.inStock ? (
                              <Alert>
                                <AlertTitle>Out of stock</AlertTitle>
                                <AlertDescription>
                                  ETA {formatDateValue(selectedProduct.etaDate) ?? "not yet assigned"}.
                                </AlertDescription>
                              </Alert>
                            ) : null}
                          </CardContent>
                        </Card>

                        <Card className="shadow-none">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Promotion</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {selectedProduct.activePromotion ? (
                              <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4">
                                <p className="font-semibold text-blue-900">{selectedProduct.activePromotion.name}</p>
                                <p className="mt-1 text-sm text-blue-800">{activePromoText}</p>
                                {selectedProduct.activePromotion.endDate ? (
                                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-blue-700">
                                    Ends {formatDateValue(selectedProduct.activePromotion.endDate)}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                                No active promotion is attached to this product right now.
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="shadow-none">
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                              <CardTitle className="text-base">Sales Window</CardTitle>
                              <CardDescription>See how many units sold in a custom date range.</CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2">
                                <CalendarRange className="size-4 text-muted-foreground" />
                                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0" />
                              </div>
                              <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2">
                                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0" />
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {productSalesQuery.isLoading ? (
                            <div className="text-sm text-muted-foreground">Loading sales summary...</div>
                          ) : productSalesQuery.isError ? (
                            <div className="text-sm text-destructive">Unable to load sales data for this range.</div>
                          ) : productSalesQuery.data ? (
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="rounded-2xl border bg-muted/20 p-4">
                                <p className="text-sm text-muted-foreground">Units Sold</p>
                                <p className="mt-1 font-mono text-2xl font-semibold">{productSalesQuery.data.unitsSold}</p>
                              </div>
                              <div className="rounded-2xl border bg-muted/20 p-4">
                                <p className="text-sm text-muted-foreground">Orders</p>
                                <p className="mt-1 font-mono text-2xl font-semibold">{productSalesQuery.data.orderCount}</p>
                              </div>
                              <div className="rounded-2xl border bg-muted/20 p-4">
                                <p className="text-sm text-muted-foreground">Revenue</p>
                                <p className="mt-1 font-mono text-2xl font-semibold">{formatCurrency(productSalesQuery.data.revenue)}</p>
                              </div>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>

                      <Card className="shadow-none">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Certifications</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {selectedProduct.certifications && selectedProduct.certifications.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {selectedProduct.certifications.map((item) => (
                                <Badge key={item} variant="outline">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                              No certifications are listed for this item.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create product</DialogTitle>
              <DialogDescription>Add a new catalog item so it can be sold and managed in Clarity.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Input placeholder="SKU" value={createForm.sku} onChange={(event) => setCreateForm({ ...createForm, sku: event.target.value })} />
              <Input placeholder="Product name" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} />
              <Input placeholder="Category" value={createForm.category} onChange={(event) => setCreateForm({ ...createForm, category: event.target.value })} />
              <Input placeholder="Unit price" type="number" min="0" step="0.01" value={createForm.unitPrice} onChange={(event) => setCreateForm({ ...createForm, unitPrice: event.target.value })} />
              <Input placeholder="Inventory qty" type="number" min="0" step="1" value={createForm.inventoryQty} onChange={(event) => setCreateForm({ ...createForm, inventoryQty: event.target.value })} />
              <Input placeholder="Image URL" value={createForm.imageUrl} onChange={(event) => setCreateForm({ ...createForm, imageUrl: event.target.value })} />
              <Input type="date" value={createForm.etaDate} onChange={(event) => setCreateForm({ ...createForm, etaDate: event.target.value })} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button disabled={createProductMutation.isPending || !createForm.sku.trim() || !createForm.name.trim() || Number(createForm.unitPrice) < 0} onClick={() => createProductMutation.mutate()}>
                {createProductMutation.isPending ? "Creating..." : "Create product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
