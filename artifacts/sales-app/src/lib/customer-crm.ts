export type CustomerStatus = "active" | "prospect" | "on_hold" | "inactive";
export type CustomerActivityType = "note" | "call" | "email" | "meeting" | "task";

export interface CustomerListItem {
  id: number;
  name: string;
  companyName: string;
  primaryContact: string;
  email: string | null;
  phone: string | null;
  lastOrderDate: string | null;
  paymentTerms: string;
  currentArBalance: number;
  openOrders: number;
  lifetimeRevenue: number;
  status: CustomerStatus;
  repId: number | null;
  repName: string | null;
}

export interface CustomerActivityEntry {
  id: number;
  activityType: CustomerActivityType;
  subject: string;
  details: string | null;
  outcome: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  createdBy: string;
  createdAt: string;
}

export interface CustomerContactEntry {
  id: number;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface CustomerCustomPriceEntry {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  category: string;
  baseUnitPrice: number;
  customUnitPrice: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPricingImportResult {
  importedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  fileName: string;
  customerName: string;
}

export interface CustomerOrderStatusSummary {
  status: string;
  count: number;
}

export interface CustomerRecentOrder {
  id: number;
  orderNumber: string;
  status: string;
  orderDate: string;
  total: number;
}

export interface CustomerProductInsight {
  productId: number;
  name: string;
  category: string;
  totalQuantity: number;
  revenue: number;
}

export interface CustomerTimelineEntry {
  id: string;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
}

export interface CustomerAccountActionEntry {
  id: number;
  actionType: string;
  title: string;
  details: string | null;
  previousValue: string | null;
  nextValue: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CustomerCrmDetail {
  id: number;
  name: string;
  companyName: string;
  primaryContact: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  additionalContacts: CustomerContactEntry[];
  paymentTerms: string;
  creditLimit: number;
  currentArBalance: number;
  availableCredit: number;
  customPricing: boolean;
  assignedSalesRep: string;
  assignedSalesRepId: number | null;
  customerSinceDate: string | null;
  status: CustomerStatus;
  openOrders: number;
  orderStatuses: CustomerOrderStatusSummary[];
  recentOrders: CustomerRecentOrder[];
  totalRevenue: number;
  averageOrderValue: number;
  mostPurchasedProducts: CustomerProductInsight[];
  purchaseFrequency: string;
  lastPurchaseDate: string | null;
  productCategoriesPurchased: string[];
  accountActions: CustomerAccountActionEntry[];
  internalNotes: CustomerActivityEntry[];
  callLog: CustomerActivityEntry[];
  emailLog: CustomerActivityEntry[];
  meetingNotes: CustomerActivityEntry[];
  followUpTasks: CustomerActivityEntry[];
  customerTimeline: CustomerTimelineEntry[];
}

export interface SalesRepOption {
  id: number;
  name: string;
  email: string | null;
}

export interface UpdateCustomerPayload {
  name: string;
  companyName: string;
  primaryContactName: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  status: CustomerStatus;
  paymentTerms: string;
  creditLimit: number;
  customPricing: boolean;
  repId: number | null;
  customerSinceDate: string | null;
}

export interface CreateCustomerActivityPayload {
  activityType: Exclude<CustomerActivityType, "email"> | "email";
  subject: string;
  details: string | null;
  outcome?: string | null;
  dueDate?: string | null;
  createdBy?: string | null;
  isCompleted?: boolean;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data?.error === "string") {
        message = data.error;
      }
    } catch {
      // Ignore parse issues and fall back to the generic message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getCustomers(params: { q?: string; status?: CustomerStatus | "all" }) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.status && params.status !== "all") searchParams.set("status", params.status);
  const query = searchParams.toString();
  return fetchJson<CustomerListItem[]>(`/api/customers${query ? `?${query}` : ""}`);
}

export async function getCustomerCrm(customerId: number) {
  return fetchJson<CustomerCrmDetail>(`/api/customers/${customerId}/crm`);
}

export async function getSalesReps() {
  return fetchJson<SalesRepOption[]>("/api/reps");
}

export async function getCustomerCustomPricing(customerId: number) {
  return fetchJson<CustomerCustomPriceEntry[]>(`/api/customers/${customerId}/pricing`);
}

export async function upsertCustomerCustomPrice(customerId: number, payload: {
  productId: number;
  customUnitPrice: number;
  notes: string | null;
}) {
  return fetchJson<CustomerCustomPriceEntry>(`/api/customers/${customerId}/pricing`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCustomerCustomPrice(customerId: number, productId: number) {
  return fetchJson<void>(`/api/customers/${customerId}/pricing/${productId}`, {
    method: "DELETE",
  });
}

export async function downloadCustomerPricingCsv(customerId: number) {
  const response = await fetch(`/api/customers/${customerId}/pricing/export`);

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data?.error === "string") {
        message = data.error;
      }
    } catch {
      // Ignore parse issues and fall back to the generic message.
    }
    throw new Error(message);
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const fileNameMatch = disposition.match(/filename="([^"]+)"/i);

  return {
    blob: await response.blob(),
    fileName: fileNameMatch?.[1] ?? `customer-${customerId}-catalog-pricing.csv`,
  };
}

export async function importCustomerPricingCsv(customerId: number, file: File) {
  return fetchJson<CustomerPricingImportResult>(`/api/customers/${customerId}/pricing/import`, {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      csvText: await file.text(),
    }),
  });
}

export async function updateCustomer(customerId: number, payload: UpdateCustomerPayload) {
  return fetchJson<{ ok: true }>(`/api/customers/${customerId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createCustomerActivity(customerId: number, payload: CreateCustomerActivityPayload) {
  return fetchJson<CustomerActivityEntry>(`/api/customers/${customerId}/activities`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCustomerActivity(customerId: number, activityId: number, payload: CreateCustomerActivityPayload) {
  return fetchJson<CustomerActivityEntry>(`/api/customers/${customerId}/activities/${activityId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCustomerActivity(customerId: number, activityId: number) {
  return fetchJson<void>(`/api/customers/${customerId}/activities/${activityId}`, {
    method: "DELETE",
  });
}

export async function createCustomerContact(customerId: number, payload: {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}) {
  return fetchJson<CustomerContactEntry>(`/api/customers/${customerId}/contacts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCustomerContact(customerId: number, contactId: number, payload: {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}) {
  return fetchJson<CustomerContactEntry>(`/api/customers/${customerId}/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCustomerContact(customerId: number, contactId: number) {
  return fetchJson<void>(`/api/customers/${customerId}/contacts/${contactId}`, {
    method: "DELETE",
  });
}
