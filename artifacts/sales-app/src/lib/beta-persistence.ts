import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "./http";

export type EkgxLeadStatus = "contacted" | "not_contacted";
export type EkgxLeadView = "all" | EkgxLeadStatus;

export interface EkgxLeadActivity {
  id: number;
  contactMethod: string;
  result: string;
  summary: string;
  createdBy: string;
  createdAt: string;
}

export interface EkgxLead {
  id: number;
  businessName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  jobTitle: string | null;
  businessType: string | null;
  locations: string | null;
  state: string | null;
  role: string | null;
  intendedUse: string | null;
  purchaseTimeline: string | null;
  callbackPreference: string | null;
  submittedAt: string;
  status: EkgxLeadStatus;
  source: string;
  notes: string;
  lastContactAt: string | null;
  lastContactSummary: string | null;
  flagged: boolean;
  activities: EkgxLeadActivity[];
}

const EKGX_INQUIRY_SUBJECT = "Your EKGx Inquiry";

export function getEkgxLeadMailto(lead: Pick<EkgxLead, "email" | "contactName">) {
  if (!lead.email) return null;

  const trimmedName = lead.contactName.trim();
  const greetingName = trimmedName.length > 0 ? trimmedName : "there";
  const body = [
    `Hi ${greetingName},`,
    "",
    "Thank you for your interest in EKGx.",
    "",
    "I'd be happy to send over pricing, product information, or schedule a quick demonstration so you can see how it works in practice.",
    "",
    "Please let me know what would be most helpful, and I'll get it over to you right away.",
    "",
    "I look forward to speaking with you.",
    "",
    "Best,",
  ].join("\n");

  return `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(EKGX_INQUIRY_SUBJECT)}&body=${encodeURIComponent(body)}`;
}

export interface WorkspaceActionPoint {
  id: number;
  customerId: number;
  customerName: string;
  customerStatus: "active" | "prospect" | "on_hold" | "inactive";
  title: string;
  details: string;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActionPointInput {
  customerId: number;
  title: string;
  details: string;
  dueDate: string | null;
}

export interface WorkspaceActionPointQueryOptions {
  scope?: "mine" | "all";
}

export function getCustomerFlags() {
  return fetchJson<number[]>("/api/crm/customer-flags");
}

export function setCustomerFlag(customerId: number, flagged: boolean) {
  return fetchJson<void>(`/api/crm/customer-flags/${customerId}`, {
    method: "PUT",
    body: JSON.stringify({ flagged }),
  });
}

export function listEkgxLeads() {
  return fetchJson<EkgxLead[]>("/api/crm/ekgx-leads");
}

export function getEkgxLeadById(leadId: number) {
  return fetchJson<EkgxLead>(`/api/crm/ekgx-leads/${leadId}`);
}

export function updateEkgxLead(leadId: number, updates: Partial<Pick<EkgxLead, "notes" | "lastContactAt" | "lastContactSummary" | "status" | "flagged">>) {
  return fetchJson<EkgxLead>(`/api/crm/ekgx-leads/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function createEkgxLeadActivity(
  leadId: number,
  payload: Pick<EkgxLeadActivity, "contactMethod" | "result" | "summary">,
) {
  return fetchJson<{ lead: EkgxLead; activity: EkgxLeadActivity }>(`/api/crm/ekgx-leads/${leadId}/activities`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listWorkspaceActionPoints(options?: WorkspaceActionPointQueryOptions) {
  const params = new URLSearchParams();
  if (options?.scope === "all") {
    params.set("scope", "all");
  }

  const query = params.toString();
  return fetchJson<WorkspaceActionPoint[]>(`/api/crm/action-points${query ? `?${query}` : ""}`);
}

export function createWorkspaceActionPoint(input: CreateActionPointInput) {
  return fetchJson<WorkspaceActionPoint>("/api/crm/action-points", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateWorkspaceActionPoint(actionPointId: number, completed: boolean) {
  return fetchJson<WorkspaceActionPoint>(`/api/crm/action-points/${actionPointId}`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  });
}

export function clearCompletedWorkspaceActionPoints() {
  return fetchJson<void>("/api/crm/action-points/completed", {
    method: "DELETE",
  });
}

export function useEkgxLeads() {
  return useQuery({
    queryKey: ["crm", "ekgx-leads"],
    queryFn: listEkgxLeads,
  });
}

export function useCustomerFlags() {
  return useQuery({
    queryKey: ["crm", "customer-flags"],
    queryFn: getCustomerFlags,
  });
}

export function useWorkspaceActionPoints(options?: WorkspaceActionPointQueryOptions) {
  return useQuery({
    queryKey: ["crm", "action-points", options?.scope ?? "mine"],
    queryFn: () => listWorkspaceActionPoints(options),
  });
}
