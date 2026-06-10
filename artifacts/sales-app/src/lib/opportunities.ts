import { fetchJson } from "./http";

export interface SalesOpportunity {
  id: number;
  customerId: number;
  customerName: string;
  companyName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  title: string;
  status: string;
  source: "existing_customer" | "new_customer";
  createdAt: string;
  updatedAt: string;
  lifecycle: "open" | "won" | "lost";
  dueDate: string | null;
  notes: string | null;
  lastContactedAt: string | null;
  lastContactNote: string | null;
}

export interface CreateOpportunityPayload {
  customerId: number;
  title: string;
  status?: string;
  source?: "existing_customer" | "new_customer";
  dueDate?: string | null;
  notes?: string | null;
  lastContactedAt?: string | null;
  lastContactNote?: string | null;
}

export interface UpdateOpportunityPayload {
  customerId?: number;
  title?: string;
  status?: string;
  source?: "existing_customer" | "new_customer";
  lifecycle?: "open" | "won" | "lost";
  dueDate?: string | null;
  notes?: string | null;
  lastContactedAt?: string | null;
  lastContactNote?: string | null;
}

export function formatOpportunityStatus(status: string) {
  return status?.trim() || "New lead";
}

export function listOpportunities() {
  return fetchJson<SalesOpportunity[]>("/api/opportunities");
}

export function createOpportunity(payload: CreateOpportunityPayload) {
  return fetchJson<SalesOpportunity>("/api/opportunities", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateOpportunity(opportunityId: number, payload: UpdateOpportunityPayload) {
  return fetchJson<SalesOpportunity>(`/api/opportunities/${opportunityId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteOpportunity(opportunityId: number) {
  return fetchJson<void>(`/api/opportunities/${opportunityId}`, {
    method: "DELETE",
  });
}
