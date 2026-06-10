import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Pencil, Search, Trash2, Upload } from "lucide-react";
import { getGetProductsQueryKey, useGetProducts, type Product } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  downloadCustomerPricingCsv,
  getCustomerCrm,
  getCustomerCustomPricing,
  importCustomerPricingCsv,
  type CustomerCustomPriceEntry,
  upsertCustomerCustomPrice,
  deleteCustomerCustomPrice,
} from "@/lib/customer-crm";
import { formatCurrency } from "@/lib/format";

type PricingProduct = Product & {
  category?: string;
};

function CustomerPricingDialog({
  open,
  onOpenChange,
  products,
  search,
  onSearchChange,
  editingPrice,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: PricingProduct[];
  search: string;
  onSearchChange: (value: string) => void;
  editingPrice: CustomerCustomPriceEntry | null;
  onSubmit: (payload: { productId: number; customUnitPrice: number; notes: string | null }) => void;
  saving: boolean;
}) {
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [customUnitPrice, setCustomUnitPrice] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedProductId(editingPrice?.productId ?? null);
    setCustomUnitPrice(editingPrice ? String(editingPrice.customUnitPrice) : "");
    setNotes(editingPrice?.notes ?? "");
  }, [editingPrice, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(50rem,calc(100vw-2rem))] max-w-none overflow-hidden p-0">
        <div className="flex flex-col">
          <div className="px-5 pt-5">
            <DialogHeader>
              <DialogTitle>{editingPrice ? "Edit custom price" : "Add custom price"}</DialogTitle>
              <DialogDescription>Set account-specific pricing that will automatically apply on new orders.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 py-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex flex-col gap-3">
                <Input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search products by name or SKU"
                />
                <div className="max-h-[22rem] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-2 md:max-h-[24rem]">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProductId(product.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left ${
                        selectedProductId === product.id ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-950">{product.name}</p>
                        <p className="text-sm text-slate-500">
                          {product.sku} · {product.category}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium text-slate-700">{formatCurrency(product.unitPrice)}</p>
                    </button>
                  ))}
                  {products.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">No products found.</p> : null}
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-700">Selected product</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">
                    {products.find((product) => product.id === selectedProductId)?.name ?? "Choose a product"}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Custom unit price</p>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customUnitPrice}
                    onChange={(event) => setCustomUnitPrice(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Notes</p>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional note about contract pricing, volume terms, or exceptions"
                    className="min-h-24"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t px-5 py-3">
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={saving || !selectedProductId || Number(customUnitPrice) < 0 || customUnitPrice.trim() === ""}
                onClick={() => {
                  if (!selectedProductId) return;
                  onSubmit({
                    productId: selectedProductId,
                    customUnitPrice: Number(customUnitPrice),
                    notes: notes.trim() || null,
                  });
                }}
              >
                {saving ? "Saving..." : editingPrice ? "Save pricing" : "Add pricing"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CustomerAccountPricing() {
  const { customerId } = useParams<{ customerId: string }>();
  const id = Number(customerId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pricingOpen, setPricingOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<CustomerCustomPriceEntry | null>(null);
  const [pricingSearch, setPricingSearch] = useState("");
  const [pricingListSearch, setPricingListSearch] = useState("");
  const [pricingCategoryFilter, setPricingCategoryFilter] = useState("all");
  const [pricingPage, setPricingPage] = useState(1);
  const pricingImportInputRef = useRef<HTMLInputElement | null>(null);

  const detailQuery = useQuery({
    queryKey: ["customer-crm", id, "pricing-page"],
    queryFn: () => getCustomerCrm(id),
    enabled: Number.isFinite(id),
  });
  const pricingQuery = useQuery({
    queryKey: ["customer-pricing", id],
    queryFn: () => getCustomerCustomPricing(id),
    enabled: Number.isFinite(id),
  });
  const productsQuery = useGetProducts(
    { q: pricingSearch || undefined },
    {
      query: {
        queryKey: getGetProductsQueryKey({ q: pricingSearch || undefined }),
        enabled: pricingOpen,
      },
    },
  );

  const upsertPricingMutation = useMutation({
    mutationFn: (payload: { productId: number; customUnitPrice: number; notes: string | null }) => upsertCustomerCustomPrice(id, payload),
    onSuccess: async () => {
      setPricingOpen(false);
      setEditingPrice(null);
      setPricingSearch("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-pricing", id] }),
        queryClient.invalidateQueries({ queryKey: ["customer-crm", id] }),
      ]);
      toast({ title: "Account pricing saved", description: "This pricing will be used automatically on new orders." });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to save pricing", description: error.message, variant: "destructive" });
    },
  });

  const deletePricingMutation = useMutation({
    mutationFn: (productId: number) => deleteCustomerCustomPrice(id, productId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-pricing", id] }),
        queryClient.invalidateQueries({ queryKey: ["customer-crm", id] }),
      ]);
      toast({ title: "Custom price removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to remove pricing", description: error.message, variant: "destructive" });
    },
  });

  const exportPricingMutation = useMutation({
    mutationFn: () => downloadCustomerPricingCsv(id),
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast({ title: "Catalog CSV downloaded", description: "You can edit custom prices in the file and upload it back here." });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to export pricing", description: error.message, variant: "destructive" });
    },
  });

  const importPricingMutation = useMutation({
    mutationFn: (file: File) => importCustomerPricingCsv(id, file),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-pricing", id] }),
        queryClient.invalidateQueries({ queryKey: ["customer-crm", id] }),
      ]);
      toast({
        title: "Custom pricing imported",
        description: `${result.importedCount} SKU price${result.importedCount === 1 ? "" : "s"} updated from ${result.fileName}.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to import pricing", description: error.message, variant: "destructive" });
    },
  });

  const detail = detailQuery.data ?? null;
  const customPricingEntries = pricingQuery.data ?? [];
  const pricingProducts: PricingProduct[] = (productsQuery.data ?? []) as PricingProduct[];
  const pricingCategories = useMemo(
    () => Array.from(new Set(customPricingEntries.map((entry) => entry.category).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [customPricingEntries],
  );
  const filteredCustomPricingEntries = useMemo(() => {
    const normalizedSearch = pricingListSearch.trim().toLowerCase();

    return [...customPricingEntries]
      .filter((entry) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          entry.productName.toLowerCase().includes(normalizedSearch) ||
          entry.sku.toLowerCase().includes(normalizedSearch) ||
          entry.category.toLowerCase().includes(normalizedSearch) ||
          (entry.notes ?? "").toLowerCase().includes(normalizedSearch);
        const matchesCategory = pricingCategoryFilter === "all" || entry.category === pricingCategoryFilter;

        return matchesSearch && matchesCategory;
      })
      .sort((left, right) => {
        const deltaLeft = Math.abs(left.customUnitPrice - left.baseUnitPrice);
        const deltaRight = Math.abs(right.customUnitPrice - right.baseUnitPrice);
        if (deltaRight !== deltaLeft) return deltaRight - deltaLeft;
        return left.productName.localeCompare(right.productName);
      });
  }, [customPricingEntries, pricingCategoryFilter, pricingListSearch]);
  const pricingStats = useMemo(() => {
    const withDiscount = customPricingEntries.filter((entry) => entry.customUnitPrice < entry.baseUnitPrice);
    const withMarkup = customPricingEntries.filter((entry) => entry.customUnitPrice > entry.baseUnitPrice);
    const averageAdjustment = customPricingEntries.length
      ? customPricingEntries.reduce((sum, entry) => sum + (entry.customUnitPrice - entry.baseUnitPrice), 0) / customPricingEntries.length
      : 0;
    const largestDiscount = withDiscount.reduce((best, entry) => Math.max(best, entry.baseUnitPrice - entry.customUnitPrice), 0);

    return {
      discountedCount: withDiscount.length,
      markupCount: withMarkup.length,
      averageAdjustment,
      largestDiscount,
    };
  }, [customPricingEntries]);
  const pricingPageSize = 8;
  const pricingTotalPages = Math.max(1, Math.ceil(filteredCustomPricingEntries.length / pricingPageSize));
  const pricingPageEntries = filteredCustomPricingEntries.slice((pricingPage - 1) * pricingPageSize, pricingPage * pricingPageSize);

  useEffect(() => {
    setPricingPage(1);
  }, [pricingListSearch, pricingCategoryFilter]);

  if (detailQuery.isLoading) {
    return (
      <AppLayout fluid>
        <div className="space-y-4 px-4 pb-4">
          <Skeleton className="h-20 w-full rounded-3xl" />
          <Skeleton className="h-96 w-full rounded-3xl" />
        </div>
      </AppLayout>
    );
  }

  if (!detail) {
    return <AppLayout fluid><div /></AppLayout>;
  }

  return (
    <AppLayout fluid>
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 pb-8">
        <div className="flex items-center gap-4 px-1 text-sm text-slate-500">
          <Link href={`/customers/${detail.id}`} className="flex items-center gap-2 transition hover:text-slate-950">
            <ArrowLeft className="size-4" />
            Back to Customer
          </Link>
        </div>

        <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#f2f6fc_100%)] px-6 py-6 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] md:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Account Pricing</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{detail.companyName}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Customer-specific prices that override the catalog during order creation.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={pricingImportInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  importPricingMutation.mutate(file);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => exportPricingMutation.mutate()}
                disabled={exportPricingMutation.isPending}
              >
                <Download className="mr-2 size-4" />
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => pricingImportInputRef.current?.click()}
                disabled={importPricingMutation.isPending}
              >
                <Upload className="mr-2 size-4" />
                Import CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  setEditingPrice(null);
                  setPricingSearch("");
                  setPricingOpen(true);
                }}
              >
                Add custom price
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Custom-priced SKUs</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{customPricingEntries.length}</p>
            <p className="mt-1 text-sm text-slate-500">Account-specific overrides in effect</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Categories Covered</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{pricingCategories.length}</p>
            <p className="mt-1 text-sm text-slate-500">Product groups with custom terms</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Discounted vs Marked Up</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{pricingStats.discountedCount} / {pricingStats.markupCount}</p>
            <p className="mt-1 text-sm text-slate-500">SKUs below or above catalog price</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Largest Unit Discount</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatCurrency(pricingStats.largestDiscount)}</p>
            <p className="mt-1 text-sm text-slate-500">Average adjustment {formatCurrency(pricingStats.averageAdjustment)}</p>
          </div>
        </div>

        {customPricingEntries.length > 0 ? (
          <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
                <Input
                  value={pricingListSearch}
                  onChange={(event) => setPricingListSearch(event.target.value)}
                  placeholder="Search custom-priced SKUs, category, notes..."
                  className="pl-9"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="hidden lg:flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={pricingCategoryFilter === "all" ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setPricingCategoryFilter("all")}
                  >
                    All
                  </Button>
                  {pricingCategories.slice(0, 5).map((category) => (
                    <Button
                      key={category}
                      size="sm"
                      variant={pricingCategoryFilter === category ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => setPricingCategoryFilter(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
                <Select value={pricingCategoryFilter} onValueChange={setPricingCategoryFilter}>
                  <SelectTrigger className="h-9 w-full sm:w-[220px] rounded-full">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {pricingCategories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200">
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing <span className="font-medium text-slate-700">{pricingPageEntries.length}</span> of{" "}
                  <span className="font-medium text-slate-700">{filteredCustomPricingEntries.length}</span> matching SKU price overrides
                </span>
                <span>Page {pricingPage} of {pricingTotalPages}</span>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[920px]">
                  <div className="max-h-[32rem] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-slate-50">
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Catalog</TableHead>
                          <TableHead className="text-right">Account</TableHead>
                          <TableHead className="text-right">Adjustment</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="w-[96px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pricingPageEntries.map((entry) => {
                          const delta = entry.customUnitPrice - entry.baseUnitPrice;
                          const isDiscount = delta < 0;
                          return (
                            <TableRow key={entry.productId}>
                              <TableCell className="min-w-[280px]">
                                <div className="font-medium text-slate-950">{entry.productName}</div>
                                <div className="mt-1 text-sm text-slate-500">{entry.sku}</div>
                              </TableCell>
                              <TableCell>{entry.category}</TableCell>
                              <TableCell className="text-right font-medium text-slate-700">{formatCurrency(entry.baseUnitPrice)}</TableCell>
                              <TableCell className="text-right font-semibold text-primary">{formatCurrency(entry.customUnitPrice)}</TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="outline"
                                  className={isDiscount ? "border-emerald-200 bg-emerald-50 text-emerald-700" : delta > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"}
                                >
                                  {delta === 0 ? "No change" : `${delta > 0 ? "+" : "-"}${formatCurrency(Math.abs(delta))}`}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[280px]">
                                <span className="line-clamp-2 text-sm text-slate-500">{entry.notes || "No pricing note"}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-lg"
                                    onClick={() => {
                                      setEditingPrice(entry);
                                      setPricingSearch(entry.productName);
                                      setPricingOpen(true);
                                    }}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-lg text-rose-600 hover:text-rose-700"
                                    onClick={() => {
                                      if (!window.confirm(`Remove custom pricing for ${entry.productName}?`)) return;
                                      deletePricingMutation.mutate(entry.productId);
                                    }}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {pricingPageEntries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                              No custom-priced SKUs match the current search or category filter.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
              {pricingTotalPages > 1 ? (
                <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Page {pricingPage} of {pricingTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => setPricingPage((current) => Math.max(1, current - 1))}
                      disabled={pricingPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => setPricingPage((current) => Math.min(pricingTotalPages, current + 1))}
                      disabled={pricingPage === pricingTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-10 text-sm text-slate-500">
            No account-specific pricing yet. Add a custom price and it will automatically flow into new orders for this customer.
          </div>
        )}

        <CustomerPricingDialog
          open={pricingOpen}
          onOpenChange={(open) => {
            setPricingOpen(open);
            if (!open) {
              setEditingPrice(null);
              setPricingSearch("");
            }
          }}
          products={pricingProducts}
          search={pricingSearch}
          onSearchChange={setPricingSearch}
          editingPrice={editingPrice}
          onSubmit={(payload) => upsertPricingMutation.mutate(payload)}
          saving={upsertPricingMutation.isPending}
        />
      </div>
    </AppLayout>
  );
}
