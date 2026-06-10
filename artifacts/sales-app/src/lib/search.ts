export type GlobalSearchResultType =
  | "customer"
  | "contact"
  | "product"
  | "order"
  | "invoice"
  | "purchase_order"
  | "shipment"
  | "vendor"
  | "receipt"
  | "vendor_bill"
  | "workspace_document";

export interface GlobalSearchResult {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  subtitle: string | null;
  href: string;
  keywords: string[];
}

export interface GlobalSearchResponse {
  query: string;
  results: GlobalSearchResult[];
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Search failed" }));
    throw new Error(payload.error ?? "Search failed");
  }

  return response.json() as Promise<T>;
}

export async function searchEverything(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: "", results: [] } satisfies GlobalSearchResponse;
  }

  return fetchJson<GlobalSearchResponse>(`/api/search?q=${encodeURIComponent(trimmed)}`);
}
