import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  FileText,
  LoaderCircle,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  Truck,
  UserRound,
  Users,
  FolderSearch,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchEverything, type GlobalSearchResult, type GlobalSearchResultType } from "@/lib/search";
import { cn } from "@/lib/utils";

const GROUP_LABELS: Record<GlobalSearchResultType, string> = {
  customer: "Customers",
  contact: "Contacts",
  product: "Products",
  order: "Orders",
  invoice: "Invoices",
  purchase_order: "Purchase Orders",
  shipment: "Shipments",
  vendor: "Vendors",
  receipt: "Receipts",
  vendor_bill: "Vendor Bills",
  workspace_document: "Shared Files",
};

const TYPE_ICONS: Record<GlobalSearchResultType, React.ComponentType<{ className?: string }>> = {
  customer: Users,
  contact: UserRound,
  product: Package,
  order: ShoppingCart,
  invoice: Receipt,
  purchase_order: FileText,
  shipment: Truck,
  vendor: Boxes,
  receipt: Receipt,
  vendor_bill: FileText,
  workspace_document: FolderSearch,
};

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debounced;
}

function useGroupedResults(results: GlobalSearchResult[]) {
  return useMemo(() => {
    const groups = new Map<string, GlobalSearchResult[]>();

    for (const result of results) {
      const label = GROUP_LABELS[result.type];
      groups.set(label, [...(groups.get(label) ?? []), result]);
    }

    return Array.from(groups.entries());
  }, [results]);
}

export function GlobalSearch() {
  const [, navigate] = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 140);

  const searchQuery = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: () => searchEverything(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    placeholderData: (previousData) => previousData,
  });

  const groupedResults = useGroupedResults(searchQuery.data?.results ?? []);
  const hasQuery = query.trim().length > 0;
  const hasResults = groupedResults.length > 0;
  const showPanel = open && (hasQuery || searchQuery.isFetching || searchQuery.isError);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }

      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative z-[1300] w-full sm:max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder="Search customers, SKUs, invoices, shared files, and more"
          className="h-11 rounded-2xl border-slate-200 bg-white pl-10 pr-20 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-slate-300"
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {searchQuery.isFetching && hasQuery ? (
            <LoaderCircle className="size-4 animate-spin text-slate-400" />
          ) : null}
          <span className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline-block">
            {navigator.platform.toLowerCase().includes("mac") ? "⌘K" : "Ctrl K"}
          </span>
        </div>
      </div>

      <div
        className={cn(
          "absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[1400] origin-top overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_-24px_rgba(15,23,42,0.28)] transition-all duration-180",
          showPanel ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
        )}
      >
        {hasQuery ? (
          <div className="max-h-[28rem] overflow-y-auto py-2">
            {searchQuery.isError ? (
              <div className="px-4 py-6 text-sm text-rose-600">{(searchQuery.error as Error).message}</div>
            ) : null}

            {!searchQuery.isError && !hasResults && !searchQuery.isFetching ? (
              <div className="px-4 py-8 text-sm text-slate-500">No matches found.</div>
            ) : null}

            {groupedResults.map(([label, results]) => (
              <div key={label} className="py-1">
                <div className="px-4 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {label}
                </div>
                <div className="space-y-1 px-2">
                  {results.map((result) => {
                    const Icon = TYPE_ICONS[result.type];
                    return (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          navigate(result.href);
                        }}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-50"
                      >
                        <span className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-500">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-950">{result.title}</span>
                          {result.subtitle ? (
                            <span className="block truncate text-xs text-slate-500">{result.subtitle}</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-5 text-sm text-slate-500">
            Search across customers, contact names, emails, products, orders, invoices, purchase orders, shipments, vendors, receipts, bills, and shared-drive files.
          </div>
        )}
      </div>
    </div>
  );
}
