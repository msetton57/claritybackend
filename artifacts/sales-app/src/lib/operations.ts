import { fetchJson } from "./http";

export type InvoiceWorkflowSummary = {
  id: number;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  balanceDue: number;
  invoiceDate: string;
  dueDate: string;
  isPaid: boolean;
  paymentStatus: string;
  collectionsStatus: string;
  lastPaymentDate: string | null;
  promisedPaymentDate: string | null;
  promiseNote: string | null;
  disputeReason: string | null;
  writeOffReason: string | null;
  externalRef: string | null;
  syncStatus: string;
  syncError: string | null;
  lastSyncedAt: string | null;
  notes: string | null;
  orderId: number | null;
};

export type InvoicePaymentEntry = {
  id: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
};

export type WorkflowActivity = {
  id: number;
  activityType: string;
  title: string;
  details: string | null;
  previousValue: string | null;
  nextValue: string | null;
  createdBy: string;
  createdAt: string;
};

export type InvoiceWorkflowDetail = InvoiceWorkflowSummary & {
  customer: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    billingAddress: string | null;
    shippingAddress: string | null;
    paymentTerms: string;
    repName: string | null;
  };
  company: {
    name: string;
    email: string;
    phone: string;
  };
  order: {
    id: number;
    orderNumber: string;
    orderDate: string;
    shippingMethod: string | null;
    trackingNumber: string | null;
    subtotal: number;
    discountTotal: number;
    shippingCost: number;
    total: number;
    customTerms: string | null;
    effectiveTerms: string;
  } | null;
  lineItems: Array<{
    productId: number;
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    lineTotal: number;
    promotionName: string | null;
  }>;
  payments: InvoicePaymentEntry[];
  activities: WorkflowActivity[];
};

export type OrderWorkflowItem = {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  repId: number | null;
  repName: string | null;
  orderDate: string;
  status: string;
  total: number;
  shippingPolicyId: number | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  shippingMethod: string | null;
  fulfillmentStatus: string;
  fulfillmentProgress: number;
  invoiceStatus: string;
  riskLevel: string;
  lastActionAt: string | null;
};

export type OrderWorkflowDetail = OrderWorkflowItem & {
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  customTerms: string | null;
  effectiveTerms: string;
  invoice: InvoiceWorkflowSummary | null;
  activities: WorkflowActivity[];
  lineItems: Array<{
    productId: number;
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    lineTotal: number;
    promotionName: string | null;
  }>;
};

export type ShippingPolicyRecord = {
  id: number;
  name: string;
  description: string | null;
  carrier: string | null;
  shippingMethod: string;
  shippingCost: number;
  createdAt: string;
  updatedAt: string;
};

export function recordInvoicePayment(invoiceId: number, body: {
  amount: number;
  paymentDate: string;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
}) {
  return fetchJson<InvoiceWorkflowSummary>(`/api/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateInvoiceCollectionsStatus(invoiceId: number, body: {
  collectionsStatus: string;
  promisedPaymentDate?: string | null;
  promiseNote?: string | null;
  disputeReason?: string | null;
  notes?: string | null;
}) {
  return fetchJson<InvoiceWorkflowSummary>(`/api/invoices/${invoiceId}/collections-status`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateInvoiceWorkflow(invoiceId: number, body: {
  dueDate?: string;
  notes?: string | null;
  externalRef?: string | null;
}) {
  return fetchJson<InvoiceWorkflowSummary>(`/api/invoices/${invoiceId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function writeOffInvoice(invoiceId: number, body: { reason: string; notes?: string | null }) {
  return fetchJson<InvoiceWorkflowSummary>(`/api/invoices/${invoiceId}/write-off`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listOrders(params?: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return fetchJson<OrderWorkflowItem[]>(`/api/orders${searchParams.toString() ? `?${searchParams.toString()}` : ""}`);
}

export function getOrderWorkflow(orderId: number) {
  return fetchJson<OrderWorkflowDetail>(`/api/orders/${orderId}`);
}

export function updateOrderWorkflow(orderId: number, body: {
  lineItems?: Array<{
    productId: number;
    quantity: number;
    excludePromotion?: boolean;
  }>;
  shippingPolicyId?: number | null;
  shippingCarrier?: string | null;
  shippingMethod?: string | null;
  shippingCost?: number | null;
  customTerms?: string | null;
  status?: "open" | "in_transit" | "fulfilled" | "cancelled";
  trackingNumber?: string | null;
}) {
  return fetchJson<OrderWorkflowItem>(`/api/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function updateOrderStatusAction(orderId: number, body: { status: "open" | "in_transit" | "fulfilled" | "cancelled"; note?: string | null }) {
  return fetchJson<OrderWorkflowItem>(`/api/orders/${orderId}/actions/status`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateOrderShipment(orderId: number, body: {
  status: "in_transit";
  note?: string | null;
  trackingNumber: string;
  shippingCarrier: string;
  shippingMethod: string;
}) {
  return fetchJson<OrderWorkflowItem>(`/api/orders/${orderId}/actions/status`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createOrderNote(orderId: number, body: { title: string; details?: string | null }) {
  return fetchJson<{ ok: true }>(`/api/orders/${orderId}/notes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createInvoiceForOrder(orderId: number) {
  return fetchJson<InvoiceWorkflowSummary>(`/api/orders/${orderId}/create-invoice`, {
    method: "POST",
  });
}

export function listShippingPolicies() {
  return fetchJson<ShippingPolicyRecord[]>("/api/shipping-policies");
}

export function createShippingPolicy(body: {
  name: string;
  description?: string | null;
  carrier?: string | null;
  shippingMethod: string;
  shippingCost: number;
}) {
  return fetchJson<ShippingPolicyRecord>("/api/shipping-policies", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateShippingPolicy(policyId: number, body: {
  name: string;
  description?: string | null;
  carrier?: string | null;
  shippingMethod: string;
  shippingCost: number;
}) {
  return fetchJson<ShippingPolicyRecord>(`/api/shipping-policies/${policyId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function createCustomerRecord(body: Record<string, unknown>) {
  return fetchJson<{ id: number }>("/api/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function runBulkCustomerAction(body: Record<string, unknown>) {
  return fetchJson<{ ok: true; count: number }>("/api/customers/bulk-actions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createCustomerContact(customerId: number, body: Record<string, unknown>) {
  return fetchJson(`/api/customers/${customerId}/contacts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCustomerContact(customerId: number, contactId: number, body: Record<string, unknown>) {
  return fetchJson(`/api/customers/${customerId}/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteCustomerContact(customerId: number, contactId: number) {
  return fetchJson(`/api/customers/${customerId}/contacts/${contactId}`, {
    method: "DELETE",
  });
}

export function createProductRecord(body: Record<string, unknown>) {
  return fetchJson("/api/products", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
