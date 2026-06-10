import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Clock3, Copy, Download, Ellipsis, FilePlus2, Mail, Pencil, Phone, Search, ShieldCheck, Trash2, Upload } from "lucide-react";
import { getGetCustomerQueryKey, getGetProductsQueryKey, useGetCustomer, useGetProducts, type Product } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { createOpportunity } from "@/lib/opportunities";
import {
  createCustomerContact,
  createCustomerActivity,
  deleteCustomerCustomPrice,
  deleteCustomerActivity,
  deleteCustomerContact,
  downloadCustomerPricingCsv,
  getCustomerCustomPricing,
  getCustomerCrm,
  getSalesReps,
  importCustomerPricingCsv,
  type CreateCustomerActivityPayload,
  type CustomerActivityEntry,
  type CustomerContactEntry,
  type CustomerCustomPriceEntry,
  type CustomerActivityType,
  type CustomerCrmDetail,
  type CustomerStatus,
  type SalesRepOption,
  type UpdateCustomerPayload,
  upsertCustomerCustomPrice,
  updateCustomerActivity,
  updateCustomerContact,
  updateCustomer,
} from "@/lib/customer-crm";
import { formatCurrency, formatDate } from "@/lib/format";
import { Cell, Pie, PieChart } from "recharts";

const STATUS_OPTIONS: Array<{ value: CustomerStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "on_hold", label: "On Hold" },
  { value: "inactive", label: "Inactive" },
];

const ACTIVITY_ACTIONS: Array<{
  type: Exclude<CustomerActivityType, "email">;
  label: string;
  title: string;
  description: string;
}> = [
  { type: "note", label: "Add Note", title: "Add Internal Note", description: "Capture context or decisions directly on the customer record." },
  { type: "call", label: "Log Call", title: "Log Call", description: "Record the conversation and any follow-up from the call." },
  { type: "meeting", label: "Log Meeting", title: "Log Meeting", description: "Save meeting notes for the account team." },
  { type: "task", label: "Follow-Up Task", title: "Create Follow-Up Task", description: "Create a dated follow-up tied to this customer record." },
];

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "active":
    case "fulfilled":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "prospect":
    case "open":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "on_hold":
    case "in_transit":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "inactive":
    case "cancelled":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function asDateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function asDateTimeInputValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function dateTimeInputToIso(value: string) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getFirstName(value: string) {
  const [firstName] = value.trim().split(/\s+/);
  return firstName || value;
}

function formatActivityTypeLabel(type: CustomerActivityType) {
  if (type === "task") return "Follow Up";
  return formatStatusLabel(type);
}

function getActivityBadgeClass(type: CustomerActivityType) {
  switch (type) {
    case "call":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "email":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "meeting":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "task":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getDefaultOpportunityForm(customer: CustomerCrmDetail | null) {
  return {
    title: customer ? `New opportunity for ${customer.companyName}` : "",
    status: customer?.status === "prospect" ? "Prospect outreach" : "Account review",
    dueDate: "",
    notes: "",
    lastContactedAt: "",
    lastContactNote: "",
  };
}

function isInvoicePastDue(invoice: { isPaid: boolean; dueDate: string; balanceDue: number }) {
  if (invoice.isPaid || invoice.balanceDue <= 0) return false;
  return new Date(`${invoice.dueDate}T23:59:59`).getTime() < Date.now();
}

function getInvoiceStatus(invoice: { isPaid: boolean; dueDate: string; balanceDue: number }) {
  if (invoice.isPaid || invoice.balanceDue <= 0) return "paid";
  if (isInvoicePastDue(invoice)) return "past_due";
  return "open";
}

function getInvoiceStatusMeta(invoice: { isPaid: boolean; dueDate: string; balanceDue: number }) {
  const status = getInvoiceStatus(invoice);
  if (status === "paid") {
    return {
      label: "Paid",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "past_due") {
    return {
      label: "Past due",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  return {
    label: "Open",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  };
}

function buildActivityPayload(
  type: Exclude<CustomerActivityType, "email">,
  form: {
    subject: string;
    details: string;
    outcome: string;
    dueDate: string;
  },
): CreateCustomerActivityPayload {
  return {
    activityType: type,
    subject: form.subject.trim(),
    details: form.details.trim() || null,
    outcome: type === "call" || type === "meeting" ? form.outcome.trim() || null : null,
    dueDate: type === "task" ? form.dueDate || null : null,
    isCompleted: false,
  };
}

function CustomerEditDialog({
  customer,
  salesReps,
  open,
  onOpenChange,
  onSubmit,
  saving,
}: {
  customer: CustomerCrmDetail | null;
  salesReps: SalesRepOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: UpdateCustomerPayload) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<UpdateCustomerPayload | null>(null);

  useEffect(() => {
    if (!customer) {
      setForm(null);
      return;
    }

    setForm({
      name: customer.name,
      companyName: customer.companyName,
      primaryContactName: customer.primaryContact,
      email: customer.email,
      phone: customer.phone,
      billingAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress,
      status: customer.status,
      paymentTerms: customer.paymentTerms,
      creditLimit: customer.creditLimit,
      customPricing: customer.customPricing,
      repId: customer.assignedSalesRepId,
      customerSinceDate: asDateInputValue(customer.customerSinceDate),
    });
  }, [customer]);

  if (!customer || !form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Customer Information</DialogTitle>
          <DialogDescription>Update account profile and commercial settings for {customer.name}.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Customer name" />
          <Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} placeholder="Company" />
          <Input value={form.primaryContactName} onChange={(event) => setForm({ ...form, primaryContactName: event.target.value })} placeholder="Primary contact" />
          <Input value={form.email ?? ""} onChange={(event) => setForm({ ...form, email: event.target.value || null })} placeholder="Email" />
          <Input value={form.phone ?? ""} onChange={(event) => setForm({ ...form, phone: event.target.value || null })} placeholder="Phone" />
          <Input value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} placeholder="Payment terms" />
          <Input type="number" min="0" step="0.01" value={String(form.creditLimit)} onChange={(event) => setForm({ ...form, creditLimit: Number(event.target.value || "0") })} placeholder="Credit limit" />
          <Input type="date" value={form.customerSinceDate ?? ""} onChange={(event) => setForm({ ...form, customerSinceDate: event.target.value || null })} placeholder="Customer since" />
          <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as CustomerStatus })}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={form.repId ? String(form.repId) : "unassigned"} onValueChange={(value) => setForm({ ...form, repId: value === "unassigned" ? null : Number(value) })}>
            <SelectTrigger><SelectValue placeholder="Assigned sales rep" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {salesReps.map((rep) => (
                <SelectItem key={rep.id} value={String(rep.id)}>{rep.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea value={form.billingAddress ?? ""} onChange={(event) => setForm({ ...form, billingAddress: event.target.value || null })} placeholder="Billing address" className="min-h-24" />
          <Textarea value={form.shippingAddress ?? ""} onChange={(event) => setForm({ ...form, shippingAddress: event.target.value || null })} placeholder="Shipping address" className="min-h-24" />
        </div>

        <label className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
          <input type="checkbox" checked={form.customPricing} onChange={(event) => setForm({ ...form, customPricing: event.target.checked })} className="size-4" />
          Customer has custom pricing
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit(form)} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerActivityDialog({
  actionType,
  customer,
  open,
  onOpenChange,
  onSubmit,
  saving,
}: {
  actionType: Exclude<CustomerActivityType, "email"> | null;
  customer: CustomerCrmDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateCustomerActivityPayload) => void;
  saving: boolean;
}) {
  const config = ACTIVITY_ACTIONS.find((item) => item.type === actionType) ?? null;
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [outcome, setOutcome] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!config || !customer) return;
    setSubject(
      config.type === "note"
        ? `Note for ${customer.name}`
        : config.type === "task"
          ? `Follow up with ${customer.primaryContact}`
          : `${formatStatusLabel(config.type)} with ${customer.primaryContact}`,
    );
    setDetails("");
    setOutcome("");
    setDueDate("");
  }, [config, customer, open]);

  if (!config || !customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
          <Textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Details" className="min-h-32" />
          {config.type === "call" || config.type === "meeting" ? <Input value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="Outcome" /> : null}
          {config.type === "task" ? <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onSubmit(buildActivityPayload(config.type, { subject, details, outcome, dueDate }))}
            disabled={saving || !subject.trim()}
          >
            {saving ? "Saving..." : config.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProspectConversionDialog({
  customer,
  salesReps,
  open,
  onOpenChange,
  onSubmit,
  saving,
}: {
  customer: CustomerCrmDetail | null;
  salesReps: SalesRepOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: UpdateCustomerPayload) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<UpdateCustomerPayload | null>(null);

  useEffect(() => {
    if (!customer || customer.status !== "prospect") {
      setForm(null);
      return;
    }

    setForm({
      name: customer.name,
      companyName: customer.companyName,
      primaryContactName: customer.primaryContact,
      email: customer.email,
      phone: customer.phone,
      billingAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress,
      status: "active",
      paymentTerms: customer.paymentTerms || "Net 30",
      creditLimit: customer.creditLimit || 10000,
      customPricing: customer.customPricing,
      repId: customer.assignedSalesRepId,
      customerSinceDate: asDateInputValue(customer.customerSinceDate),
    });
  }, [customer, open]);

  if (!customer || customer.status !== "prospect" || !form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Convert Prospect to Customer</DialogTitle>
          <DialogDescription>Fill in the commercial details needed to turn {customer.name} into an active customer account.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
            This will promote the record to an active customer and unlock full account setup for ordering and servicing.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Customer name" />
            <Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} placeholder="Company" />
            <Input value={form.primaryContactName} onChange={(event) => setForm({ ...form, primaryContactName: event.target.value })} placeholder="Primary contact" />
            <Select value={form.repId ? String(form.repId) : "unassigned"} onValueChange={(value) => setForm({ ...form, repId: value === "unassigned" ? null : Number(value) })}>
              <SelectTrigger><SelectValue placeholder="Assigned sales rep" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {salesReps.map((rep) => (
                  <SelectItem key={rep.id} value={String(rep.id)}>{rep.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={form.email ?? ""} onChange={(event) => setForm({ ...form, email: event.target.value || null })} placeholder="Email" />
            <Input value={form.phone ?? ""} onChange={(event) => setForm({ ...form, phone: event.target.value || null })} placeholder="Phone" />
            <Input value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} placeholder="Payment terms" />
            <Input type="number" min="0" step="0.01" value={String(form.creditLimit)} onChange={(event) => setForm({ ...form, creditLimit: Number(event.target.value || "0") })} placeholder="Credit limit" />
            <Input type="date" value={form.customerSinceDate ?? ""} onChange={(event) => setForm({ ...form, customerSinceDate: event.target.value || null })} placeholder="Customer since" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Textarea value={form.billingAddress ?? ""} onChange={(event) => setForm({ ...form, billingAddress: event.target.value || null })} placeholder="Billing address" className="min-h-28" />
            <Textarea value={form.shippingAddress ?? ""} onChange={(event) => setForm({ ...form, shippingAddress: event.target.value || null })} placeholder="Shipping address" className="min-h-28" />
          </div>

          <label className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
            <input type="checkbox" checked={form.customPricing} onChange={(event) => setForm({ ...form, customPricing: event.target.checked })} className="size-4" />
            Customer has custom pricing
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onSubmit({ ...form, status: "active" })}
            disabled={
              saving ||
              !form.name.trim() ||
              !form.companyName.trim() ||
              !form.primaryContactName.trim() ||
              !form.paymentTerms.trim()
            }
          >
            {saving ? "Converting..." : "Convert to customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-[0_16px_40px_-36px_rgba(15,23,42,0.4)]">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function SectionShell({
  title,
  description,
  action,
  compact = false,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)]">
      <div className={`flex items-start justify-between gap-4 border-b border-slate-200 px-5 ${compact ? "py-3 sm:px-6" : "py-4 sm:px-6"}`}>
        <div>
          <h2 className={`font-semibold text-slate-950 ${compact ? "text-[15px]" : "text-base"}`}>{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className={`px-5 ${compact ? "py-4" : "py-5"} sm:px-6`}>{children}</div>
    </section>
  );
}

type FeaturedContact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

type PricingProduct = Product & {
  category?: string;
};

function NoteEditDialog({
  note,
  open,
  onOpenChange,
  onSubmit,
  saving,
}: {
  note: CustomerActivityEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateCustomerActivityPayload) => void;
  saving: boolean;
}) {
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!note) return;
    setSubject(note.subject);
    setDetails(note.details ?? "");
  }, [note]);

  if (!note) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit note</DialogTitle>
          <DialogDescription>Update the saved internal note for this account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
          <Textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Details" className="min-h-32" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={saving || !subject.trim()}
            onClick={() => onSubmit({
              activityType: note.activityType,
              subject: subject.trim(),
              details: details.trim() || null,
              outcome: note.outcome ?? null,
              dueDate: note.dueDate ?? null,
              createdBy: note.createdBy,
              isCompleted: note.isCompleted,
            })}
          >
            {saving ? "Saving..." : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

export default function CustomerCrmDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const id = Number(customerId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [createOpportunityOpen, setCreateOpportunityOpen] = useState(false);
  const [activityType, setActivityType] = useState<Exclude<CustomerActivityType, "email"> | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContactEntry | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", title: "", email: "", phone: "", isPrimary: false });
  const [editingNote, setEditingNote] = useState<CustomerActivityEntry | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string>("primary");
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [ordersInvoiceSearch, setOrdersInvoiceSearch] = useState("");
  const [categoryMixMetric, setCategoryMixMetric] = useState<"units" | "revenue">("units");
  const [pricingOpen, setPricingOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<CustomerCustomPriceEntry | null>(null);
  const [pricingSearch, setPricingSearch] = useState("");
  const [pricingListSearch, setPricingListSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [pricingCategoryFilter, setPricingCategoryFilter] = useState("all");
  const [pricingPage, setPricingPage] = useState(1);
  const pricingImportInputRef = useRef<HTMLInputElement | null>(null);
  const [opportunityForm, setOpportunityForm] = useState(() => getDefaultOpportunityForm(null));

  const detailQuery = useQuery({
    queryKey: ["customer-crm", id],
    queryFn: () => getCustomerCrm(id),
    enabled: Number.isFinite(id),
  });
  const customerDetailQuery = useGetCustomer(id, {
    query: { enabled: Number.isFinite(id), queryKey: getGetCustomerQueryKey(id) },
  });
  const salesRepsQuery = useQuery({
    queryKey: ["sales-reps"],
    queryFn: getSalesReps,
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

  const updateCustomerMutation = useMutation({
    mutationFn: (payload: UpdateCustomerPayload) => updateCustomer(id, payload),
    onSuccess: async () => {
      setEditOpen(false);
      setConvertOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers-crm"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-crm", id] }),
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${id}`] }),
      ]);
      toast({ title: "Customer updated", description: "The customer profile has been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to save customer", description: error.message, variant: "destructive" });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: (payload: CreateCustomerActivityPayload) => createCustomerActivity(id, payload),
    onSuccess: async () => {
      setActivityType(null);
      await queryClient.invalidateQueries({ queryKey: ["customer-crm", id] });
      toast({ title: "Activity logged", description: "The customer notes have been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to save activity", description: error.message, variant: "destructive" });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ activityId, payload }: { activityId: number; payload: CreateCustomerActivityPayload }) => updateCustomerActivity(id, activityId, payload),
    onSuccess: async () => {
      setEditingNote(null);
      await queryClient.invalidateQueries({ queryKey: ["customer-crm", id] });
      toast({ title: "Note updated", description: "The customer note has been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to update note", description: error.message, variant: "destructive" });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (activityId: number) => deleteCustomerActivity(id, activityId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-crm", id] });
      toast({ title: "Note deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to delete note", description: error.message, variant: "destructive" });
    },
  });

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

  const contactMutation = useMutation({
    mutationFn: () =>
      editingContact
        ? updateCustomerContact(id, editingContact.id, {
            name: contactForm.name,
            title: contactForm.title || null,
            email: contactForm.email || null,
            phone: contactForm.phone || null,
            isPrimary: contactForm.isPrimary,
          })
        : createCustomerContact(id, {
            name: contactForm.name,
            title: contactForm.title || null,
            email: contactForm.email || null,
            phone: contactForm.phone || null,
            isPrimary: contactForm.isPrimary,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-crm", id] });
      setContactOpen(false);
      setEditingContact(null);
      setContactForm({ name: "", title: "", email: "", phone: "", isPrimary: false });
      toast({ title: editingContact ? "Contact updated" : "Contact added" });
    },
    onError: (error: Error) => toast({ title: "Unable to save contact", description: error.message, variant: "destructive" }),
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: number) => deleteCustomerContact(id, contactId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-crm", id] });
      toast({ title: "Contact removed" });
    },
    onError: (error: Error) => toast({ title: "Unable to remove contact", description: error.message, variant: "destructive" }),
  });
  const createOpportunityMutation = useMutation({
    mutationFn: () => {
      if (!detail) {
        throw new Error("Customer details are still loading.");
      }

      const title = opportunityForm.title.trim();
      if (!title) {
        throw new Error("Opportunity details are required.");
      }

      return createOpportunity({
        customerId: detail.id,
        title,
        status: opportunityForm.status.trim() || "New lead",
        source: "existing_customer",
        dueDate: opportunityForm.dueDate || null,
        notes: opportunityForm.notes.trim() || null,
        lastContactedAt: dateTimeInputToIso(opportunityForm.lastContactedAt),
        lastContactNote: opportunityForm.lastContactNote.trim() || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      setCreateOpportunityOpen(false);
      setOpportunityForm(getDefaultOpportunityForm(detail));
      toast({
        title: "Opportunity created",
        description: "It will now appear on the Daily Command Center.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to create opportunity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const detail = detailQuery.data ?? null;
  const customerFinancials = customerDetailQuery.data;
  const customPricingEntries = pricingQuery.data ?? [];
  const pricingProducts: PricingProduct[] = (productsQuery.data ?? []) as PricingProduct[];
  const pricingCategories = useMemo(
    () => Array.from(new Set(customPricingEntries.map((entry) => entry.category).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [customPricingEntries]
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
  const healthState = useMemo(() => {
    if (!detail) return { label: "Loading", className: "border-slate-200 bg-slate-50 text-slate-700", icon: Clock3 };
    if (detail.status === "inactive" || detail.status === "on_hold") {
      return { label: "Needs attention", className: "border-amber-200 bg-amber-50 text-amber-700", icon: AlertCircle };
    }
    return { label: "Healthy account", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: ShieldCheck };
  }, [detail]);

  useEffect(() => {
    setSelectedContactId("primary");
  }, [detail?.id]);

  useEffect(() => {
    setShowAllProducts(false);
  }, [detail?.id]);

  useEffect(() => {
    setPricingPage(1);
  }, [pricingListSearch, pricingCategoryFilter]);

  useEffect(() => {
    if (!detail || createOpportunityOpen) {
      return;
    }

    setOpportunityForm(getDefaultOpportunityForm(detail));
  }, [detail, createOpportunityOpen]);

  const invoices = [...(customerFinancials?.invoices ?? [])].sort(
    (left, right) => new Date(right.invoiceDate).getTime() - new Date(left.invoiceDate).getTime(),
  );
  const combinedOrderInvoiceRows = useMemo(() => {
    const recentOrders = detail?.recentOrders ?? [];
    const invoiceByOrderId = new Map(
      invoices
        .filter((invoice) => invoice.orderId != null)
        .map((invoice) => [invoice.orderId as number, invoice]),
    );
    const linkedInvoiceIds = new Set<number>();

    const orderRows = recentOrders.map((order) => {
      const invoice = invoiceByOrderId.get(order.id) ?? null;
      if (invoice) linkedInvoiceIds.add(invoice.id);
      return {
        kind: "order" as const,
        sortDate: order.orderDate,
        order,
        invoice,
      };
    });

    const invoiceOnlyRows = invoices
      .filter((invoice) => !linkedInvoiceIds.has(invoice.id))
      .map((invoice) => ({
        kind: "invoice" as const,
        sortDate: String(invoice.invoiceDate),
        order: null,
        invoice,
      }));

    return [...orderRows, ...invoiceOnlyRows].sort(
      (left, right) => new Date(right.sortDate).getTime() - new Date(left.sortDate).getTime(),
    );
  }, [detail?.recentOrders, invoices]);
  const filteredCombinedOrderInvoiceRows = useMemo(() => {
    const normalizedSearch = ordersInvoiceSearch.trim().toLowerCase();
    if (!normalizedSearch) return combinedOrderInvoiceRows;

    return combinedOrderInvoiceRows.filter((row) => {
      const invoiceMeta = row.invoice ? getInvoiceStatusMeta(row.invoice) : null;
      const haystack = [
        row.order?.orderNumber,
        row.order ? formatStatusLabel(row.order.status) : null,
        row.invoice?.invoiceNumber,
        invoiceMeta?.label,
        row.invoice ? formatCurrency(row.invoice.balanceDue) : null,
        formatCurrency(row.order?.total ?? row.invoice?.amount ?? 0),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [combinedOrderInvoiceRows, ordersInvoiceSearch]);
  const statusTimeline = useMemo(() => {
    const entries = [
      ...(detail?.callLog ?? []),
      ...(detail?.emailLog ?? []),
      ...(detail?.meetingNotes ?? []),
      ...(detail?.followUpTasks ?? []),
      ...(detail?.internalNotes ?? []),
    ];

    return [...entries].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [detail?.callLog, detail?.emailLog, detail?.followUpTasks, detail?.internalNotes, detail?.meetingNotes]);
  const backToSalesHub =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "sales-hub";
  const backHref = backToSalesHub ? "/sales-workspace" : "/customers";
  const backLabel = backToSalesHub ? "Back to Sales Hub" : "Back to Customers";

  if (detailQuery.isLoading) {
    return (
      <AppLayout fluid>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="h-72 w-full rounded-3xl" />
        </div>
      </AppLayout>
    );
  }

  if (!detail) {
    return <AppLayout fluid><div /></AppLayout>;
  }

  const HealthIcon = healthState.icon;
  const primaryContactCard: FeaturedContact = {
    id: "primary",
    name: detail.primaryContact,
    title: "Primary contact",
    email: detail.email,
    phone: detail.phone,
    isPrimary: true,
  };
  const contactOptions: FeaturedContact[] = [
    primaryContactCard,
    ...detail.additionalContacts.map((contact) => ({
      id: `contact-${contact.id}`,
      name: contact.name,
      title: contact.title,
      email: contact.email,
      phone: contact.phone,
      isPrimary: contact.isPrimary,
    })),
  ];
  const totalUnitsPurchased = detail.mostPurchasedProducts.reduce((sum, product) => sum + product.totalQuantity, 0);
  const topProducts = detail.mostPurchasedProducts.slice(0, 3);
  const notes = detail.internalNotes.slice(0, 5);
  const inTransitOrders = detail.orderStatuses.find((entry) => entry.status === "in_transit")?.count ?? 0;
  const openTasks = detail.followUpTasks.filter((task) => !task.isCompleted).length;
  const avatarInitials = getInitials(detail.name || detail.companyName);
  const customerSinceLabel = detail.customerSinceDate ? formatDate(detail.customerSinceDate) : "Not yet recorded";
  const lastPurchaseLabel = detail.lastPurchaseDate ? formatDate(detail.lastPurchaseDate) : "No orders yet";
  const primaryAddress = detail.shippingAddress ?? detail.billingAddress ?? "Address not available";
  const selectedContact = contactOptions.find((contact) => contact.id === selectedContactId) ?? primaryContactCard;
  const selectedContactInitials = getInitials(selectedContact.name);
  const productCategoryCount = detail.productCategoriesPurchased.length;
  const categoryBreakdown = detail.mostPurchasedProducts.reduce<Array<{ category: string; units: number; revenue: number; fill: string }>>((acc, product, index) => {
    const existing = acc.find((entry) => entry.category === product.category);
    const palette = ["#2457d6", "#16a34a", "#d97706", "#db2777", "#0891b2", "#7c3aed"];
    if (existing) {
      existing.units += product.totalQuantity;
      existing.revenue += product.revenue;
      return acc;
    }
    acc.push({
      category: product.category,
      units: product.totalQuantity,
      revenue: product.revenue,
      fill: palette[index % palette.length]!,
    });
    return acc;
  }, []);
  const chartConfig = categoryBreakdown.reduce<ChartConfig>((config, entry) => {
    config[entry.category] = { label: entry.category, color: entry.fill };
    return config;
  }, {});
  const categoryBreakdownTotal = categoryBreakdown.reduce((sum, entry) => sum + (categoryMixMetric === "units" ? entry.units : entry.revenue), 0);

  async function copyContactDetail(label: "email" | "phone", value: string | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: `${label === "email" ? "Email" : "Phone number"} copied`,
        description: value,
      });
    } catch {
      toast({
        title: `Unable to copy ${label}`,
        description: "Clipboard access is not available right now.",
        variant: "destructive",
      });
    }
  }

  return (
    <AppLayout fluid>
      <div className="flex w-full flex-col gap-5 px-4 pb-4">
        <div className="flex items-center gap-4 px-1 text-sm text-slate-500">
          <Link href={backHref} className="flex items-center gap-2 transition hover:text-slate-950">
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.45)] md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex max-w-4xl items-start gap-4 sm:gap-5">
              <div className="flex size-15 shrink-0 items-center justify-center rounded-[20px] bg-blue-50 text-xl font-bold text-blue-700 shadow-inner sm:size-16">
                {avatarInitials}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`gap-1.5 border ${healthState.className}`}>
                    <HealthIcon className="size-3.5" />
                    {healthState.label}
                  </Badge>
                  <Badge variant="outline" className={getStatusBadgeClass(detail.status)}>
                    {formatStatusLabel(detail.status)}
                  </Badge>
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                    {detail.paymentTerms}
                  </Badge>
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-[2.15rem]">{detail.name}</h1>
                <p className="mt-1 text-base text-slate-600">{detail.companyName}</p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                  {primaryAddress}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                  <span>Sales rep: <span className="font-semibold text-slate-700">{detail.assignedSalesRep}</span></span>
                  <span>Customer since: <span className="font-semibold text-slate-700">{customerSinceLabel}</span></span>
                  <span>Last order: <span className="font-semibold text-slate-700">{lastPurchaseLabel}</span></span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
              {detail.status === "prospect" ? (
                <Button variant="default" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => setConvertOpen(true)}>
                  Convert to Customer
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setOpportunityForm(getDefaultOpportunityForm(detail));
                  setCreateOpportunityOpen(true);
                }}
              >
                Create Opportunity
              </Button>
              <Button className="gap-2 rounded-xl px-4" asChild>
                <Link href={`/orders/new?customerId=${detail.id}`}>
                  <FilePlus2 className="size-4" />
                  Create Order
                </Link>
              </Button>
              <Button variant="secondary" className="rounded-xl" onClick={() => setEditOpen(true)}>Edit Account</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setActivityType("note")}>Add Note</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => { setEditingContact(null); setContactForm({ name: "", title: "", email: "", phone: "", isPrimary: false }); setContactOpen(true); }}>Add Contact</Button>
            </div>
          </div>
        </section>

        <Dialog open={createOpportunityOpen} onOpenChange={setCreateOpportunityOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Opportunity</DialogTitle>
              <DialogDescription>
                Add the key pipeline details for {detail.companyName} before saving the opportunity.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">Opportunity details</p>
                <div className="mt-4 grid gap-4">
                  <Textarea
                    className="min-h-24"
                    placeholder="Describe the opportunity"
                    value={opportunityForm.title}
                    onChange={(event) => setOpportunityForm((current) => ({ ...current, title: event.target.value }))}
                  />
                  <Input
                    placeholder="Status, for example: Quote sent"
                    value={opportunityForm.status}
                    onChange={(event) => setOpportunityForm((current) => ({ ...current, status: event.target.value }))}
                  />
                  <Input
                    type="date"
                    value={opportunityForm.dueDate}
                    onChange={(event) => setOpportunityForm((current) => ({ ...current, dueDate: event.target.value }))}
                  />
                  <Textarea
                    className="min-h-24"
                    placeholder="Notes, blockers, or next steps"
                    value={opportunityForm.notes}
                    onChange={(event) => setOpportunityForm((current) => ({ ...current, notes: event.target.value }))}
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">Last contact</p>
                <div className="mt-4 grid gap-4">
                  <Input
                    type="datetime-local"
                    value={opportunityForm.lastContactedAt}
                    onChange={(event) => setOpportunityForm((current) => ({ ...current, lastContactedAt: event.target.value }))}
                  />
                  <Textarea
                    className="min-h-24"
                    placeholder="What happened in the latest touchpoint?"
                    value={opportunityForm.lastContactNote}
                    onChange={(event) => setOpportunityForm((current) => ({ ...current, lastContactNote: event.target.value }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpportunityOpen(false)}>Cancel</Button>
              <Button
                disabled={createOpportunityMutation.isPending || !opportunityForm.title.trim()}
                onClick={() => createOpportunityMutation.mutate()}
              >
                {createOpportunityMutation.isPending ? "Creating..." : "Create opportunity"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Open Orders"
            value={String(detail.openOrders)}
            note={inTransitOrders > 0 ? `${inTransitOrders} in transit right now` : "No orders currently in transit"}
          />
          <MetricCard
            label="Lifetime Revenue"
            value={formatCurrency(detail.totalRevenue)}
            note={`${formatCurrency(detail.averageOrderValue)} average order value`}
          />
          <MetricCard
            label="Product Categories"
            value={String(productCategoryCount)}
            note={productCategoryCount > 0 ? "Distinct categories purchased" : "No product history yet"}
          />
          <MetricCard
            label="Follow-Up Tasks"
            value={String(openTasks)}
            note={openTasks > 0 ? "Rep actions are still open" : "No open follow-up tasks"}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-5">
            <SectionShell
              title="Account Details"
              description="Contacts, terms, ownership, and account-level settings."
            >
              <div className="space-y-5">
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                  <div className="bg-[radial-gradient(circle_at_100%_0%,rgba(120,161,255,0.22),transparent_38%),linear-gradient(135deg,#0b2a6e_0%,#0b3b91_52%,#112b64_100%)] px-4 py-5 text-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/90 text-base font-black text-[#0b55d9]">
                          {selectedContactInitials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-blue-100/90">Primary contact</p>
                          <p className="mt-2 break-words text-[1.35rem] font-semibold leading-[1.05] tracking-[-0.04em] text-white">{selectedContact.name}</p>
                          <p className="mt-1 text-sm text-blue-100">{selectedContact.title || "Contact"}</p>
                          {selectedContact.isPrimary ? (
                            <Badge variant="outline" className="mt-3 border-white/20 bg-white/10 text-white">
                              Primary
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-xl border-white/20 bg-white/10 text-white"
                        onClick={() => setEditOpen(true)}
                        aria-label="Edit account details"
                      >
                        <Ellipsis className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4 px-4 py-5">
                    <div className="space-y-3">
                      <div className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-start gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                          <Mail className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-500">Email</p>
                          <div className="mt-1 text-sm font-medium text-slate-950">
                            {selectedContact.email ? <a href={`mailto:${selectedContact.email}`} className="break-all hover:text-primary">{selectedContact.email}</a> : "—"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="rounded-xl text-slate-500"
                          onClick={() => void copyContactDetail("email", selectedContact.email)}
                          disabled={!selectedContact.email}
                          aria-label="Copy email"
                        >
                          <Copy className="size-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-start gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                          <Phone className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-500">Phone</p>
                          <div className="mt-1 text-sm font-medium text-slate-950">
                            {selectedContact.phone ? <a href={`tel:${selectedContact.phone}`} className="hover:text-primary">{selectedContact.phone}</a> : "—"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="rounded-xl text-slate-500"
                          onClick={() => void copyContactDetail("phone", selectedContact.phone)}
                          disabled={!selectedContact.phone}
                          aria-label="Copy phone number"
                        >
                          <Copy className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Account Information</p>
                  <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Sales rep</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{detail.assignedSalesRep}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Terms</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{detail.paymentTerms}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Custom pricing</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">
                          {customPricingEntries.length > 0 ? `${customPricingEntries.length} account-specific SKU price${customPricingEntries.length === 1 ? "" : "s"}` : detail.customPricing ? "Enabled" : "Standard"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="min-h-11 w-full rounded-xl border-blue-200 text-blue-700" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" />
                  Edit Account Details
                </Button>
                <Button variant="outline" className="min-h-11 w-full rounded-xl border-blue-200 text-blue-700" asChild>
                  <Link href={`/customers/${detail.id}/pricing`}>
                    View Account Pricing
                  </Link>
                </Button>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Additional Contacts</p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto rounded-lg px-0 py-0 text-sm font-semibold text-blue-700"
                      onClick={() => {
                        setEditingContact(null);
                        setContactForm({ name: "", title: "", email: "", phone: "", isPrimary: false });
                        setContactOpen(true);
                      }}
                    >
                      Add Contact
                    </Button>
                  </div>
                  {contactOptions.length ? contactOptions.map((contact) => (
                    <div key={contact.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-4">
                      <button
                        type="button"
                        className={`flex size-11 items-center justify-center rounded-full text-sm font-black transition-colors ${contact.id === "primary" ? "bg-emerald-100 text-emerald-800" : "bg-[#f1ecff] text-violet-700"}`}
                        onClick={() => setSelectedContactId(contact.id)}
                        aria-label={`Select ${contact.name}`}
                      >
                        {getInitials(contact.name)}
                      </button>
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => setSelectedContactId(contact.id)}
                        >
                          <p className="font-semibold text-slate-950 hover:text-primary">{contact.name}</p>
                        </button>
                        <p className="mt-1 text-sm text-slate-500">
                          {contact.title || "No title"}{contact.isPrimary ? " · Primary" : ""}
                        </p>
                        <p className="mt-1 break-all text-sm text-slate-500">{contact.email || contact.phone || "No direct contact info"}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {contact.id === "primary" ? null : (
                          <>
                            <Button size="icon" variant="outline" className="rounded-xl" onClick={() => {
                              const savedContact = detail.additionalContacts.find((entry) => `contact-${entry.id}` === contact.id);
                              if (!savedContact) return;
                              setEditingContact(savedContact);
                              setContactForm({
                                name: savedContact.name,
                                title: savedContact.title ?? "",
                                email: savedContact.email ?? "",
                                phone: savedContact.phone ?? "",
                                isPrimary: savedContact.isPrimary,
                              });
                              setContactOpen(true);
                            }} aria-label={`Edit ${contact.name}`}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="rounded-xl text-rose-600" onClick={() => {
                              const savedContact = detail.additionalContacts.find((entry) => `contact-${entry.id}` === contact.id);
                              if (!savedContact) return;
                              deleteContactMutation.mutate(savedContact.id);
                            }} aria-label={`Remove ${contact.name}`}>
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )) : <p className="text-sm text-slate-500">No secondary contacts yet.</p>}
                </div>
              </div>
            </SectionShell>

          </div>

          <div className="space-y-5">
            <div className="space-y-5">
              <SectionShell
                title="Orders & Invoices"
                description="Combined order activity with linked invoice status so you can still track both together."
                compact
                action={<Button size="sm" variant="outline" className="rounded-lg" asChild><Link href="/orders">View all</Link></Button>}
              >
                <div className="mb-3 flex justify-end">
                  <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={ordersInvoiceSearch}
                      onChange={(event) => setOrdersInvoiceSearch(event.target.value)}
                      placeholder="Search orders or invoices"
                      className="h-10 rounded-xl pl-9"
                      aria-label="Search orders and invoices"
                    />
                  </div>
                </div>
                <div className="max-h-[28rem] overflow-auto rounded-2xl border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Order status</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Invoice status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCombinedOrderInvoiceRows.length > 0 ? filteredCombinedOrderInvoiceRows.map((row) => {
                          const invoiceMeta = row.invoice ? getInvoiceStatusMeta(row.invoice) : null;
                          return (
                          <TableRow key={`${row.kind}-${row.order?.id ?? row.invoice?.id}`}>
                            <TableCell className="font-medium text-slate-950">
                              {row.order ? (
                                <Link href={`/orders/${row.order.id}`} className="hover:text-primary hover:underline">
                                  {row.order.orderNumber}
                                </Link>
                              ) : (
                                <span className="text-slate-400">No linked order</span>
                              )}
                            </TableCell>
                            <TableCell>{formatDate(row.order?.orderDate ?? String(row.invoice?.invoiceDate ?? row.sortDate))}</TableCell>
                            <TableCell>
                              {row.order ? (
                                <Badge variant="outline" className={getStatusBadgeClass(row.order.status)}>
                                  {formatStatusLabel(row.order.status)}
                                </Badge>
                              ) : (
                                <span className="text-sm text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-slate-950">
                              {row.invoice ? (
                                <Link href={`/invoices/${row.invoice.id}`} className="hover:text-primary hover:underline">
                                  {row.invoice.invoiceNumber}
                                </Link>
                              ) : (
                                <span className="text-sm text-slate-400">Not invoiced</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {invoiceMeta ? (
                                <Badge variant="outline" className={invoiceMeta.className}>
                                  {invoiceMeta.label}
                                </Badge>
                              ) : (
                                <span className="text-sm text-slate-400">Pending</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium text-slate-950">
                              {formatCurrency(row.order?.total ?? row.invoice?.amount ?? 0)}
                            </TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                            {ordersInvoiceSearch.trim() ? "No matching orders or invoices found." : "No orders or invoices yet for this customer."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </SectionShell>
            </div>

            <SectionShell
              title="Products Purchased"
              description={showAllProducts ? "Full category mix and complete purchased-product history." : "Defaulted to the top 3 products for quicker scanning."}
              action={detail.mostPurchasedProducts.length > 3 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => setShowAllProducts((current) => !current)}
                >
                  {showAllProducts ? "Show top 3" : "View more details"}
                </Button>
              ) : undefined}
            >
              {detail.mostPurchasedProducts.length > 0 ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    {topProducts.map((product, index) => {
                      const share = totalUnitsPurchased > 0 ? (product.totalQuantity / totalUnitsPurchased) * 100 : 0;

                      return (
                        <div key={product.productId} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4">
                          <div className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{product.name}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {product.category} · {product.totalQuantity} units · {share.toFixed(0)}% of unit volume
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-slate-950">{formatCurrency(product.revenue)}</p>
                            <p className="mt-1 text-xs text-slate-500">{product.totalQuantity} units</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {showAllProducts ? (
                    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">Category mix</p>
                            <p className="mt-1 text-xs text-slate-500">Switch between unit volume and revenue share.</p>
                          </div>
                          <Tabs value={categoryMixMetric} onValueChange={(value) => setCategoryMixMetric(value as "units" | "revenue")}>
                            <TabsList className="h-auto rounded-xl bg-white p-1">
                              <TabsTrigger value="units" className="rounded-lg">Units</TabsTrigger>
                              <TabsTrigger value="revenue" className="rounded-lg">Dollars</TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>
                        <ChartContainer config={chartConfig} className="mx-auto mt-3 aspect-square h-[260px] max-w-[260px]">
                          <PieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="category" formatter={(value) => <span className="font-medium text-slate-950">{categoryMixMetric === "units" ? `${value} units` : formatCurrency(Number(value))}</span>} />} />
                            <Pie data={categoryBreakdown} dataKey={categoryMixMetric} nameKey="category" innerRadius={52} outerRadius={92} paddingAngle={2}>
                              {categoryBreakdown.map((entry) => (
                                <Cell key={entry.category} fill={entry.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>
                        <div className="mt-3 space-y-2">
                          {categoryBreakdown.map((entry) => (
                            <div key={entry.category} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 text-slate-600">
                                <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                                {entry.category}
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-slate-950">
                                  {categoryMixMetric === "units" ? `${entry.units} units` : formatCurrency(entry.revenue)}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {categoryBreakdownTotal > 0
                                    ? `${(((categoryMixMetric === "units" ? entry.units : entry.revenue) / categoryBreakdownTotal) * 100).toFixed(0)}%`
                                    : "0%"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Units</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.mostPurchasedProducts.map((product) => (
                              <TableRow key={product.productId}>
                                <TableCell className="font-medium text-slate-950">{product.name}</TableCell>
                                <TableCell>{product.category}</TableCell>
                                <TableCell className="text-right">{product.totalQuantity}</TableCell>
                                <TableCell className="text-right font-medium text-slate-950">{formatCurrency(product.revenue)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                  No product purchase history yet.
                </div>
              )}
            </SectionShell>

            <SectionShell
              title="Status Timeline"
              description="Chronological record of contact methods, status changes, and the full details captured by the rep."
            >
              <div className="space-y-3">
                {statusTimeline.length > 0 ? statusTimeline.map((entry) => (
                  <div key={`${entry.activityType}-${entry.id}`} className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={getActivityBadgeClass(entry.activityType)}>
                            {formatActivityTypeLabel(entry.activityType)} - {getFirstName(entry.createdBy)}
                          </Badge>
                          <span className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</span>
                        </div>
                        <p className="mt-2 font-medium text-slate-950">{entry.subject}</p>
                        {entry.details ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{entry.details}</p>
                        ) : (
                          <p className="mt-2 text-sm text-slate-400">No extra details were captured for this update.</p>
                        )}
                        {entry.outcome ? (
                          <p className="mt-2 text-sm text-slate-500">
                            Outcome: <span className="font-medium text-slate-700">{entry.outcome}</span>
                          </p>
                        ) : null}
                        {entry.dueDate ? (
                          <p className="mt-1 text-sm text-slate-500">
                            Due: <span className="font-medium text-slate-700">{formatDate(entry.dueDate)}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                    No status changes have been logged yet.
                  </div>
                )}
              </div>
            </SectionShell>

            <SectionShell
              title="Notes"
              description="Internal notes and account context."
              action={<Button size="sm" variant="outline" className="rounded-lg" onClick={() => setActivityType("note")}>Add note</Button>}
            >
              <div className="space-y-3">
                {notes.length > 0 ? notes.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="font-medium text-slate-950">{entry.subject}</p>
                          <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                          <span className="text-xs text-slate-400">{entry.createdBy}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{entry.details || "No additional note content."}</p>
                      </div>
                      <div className="mt-0.5 flex shrink-0 gap-1">
                          <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setEditingNote(entry)} aria-label={`Edit note ${entry.subject}`}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-lg text-rose-600 hover:text-rose-700"
                            aria-label={`Delete note ${entry.subject}`}
                            onClick={() => {
                              if (!window.confirm(`Delete note "${entry.subject}"?`)) return;
                              deleteActivityMutation.mutate(entry.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                    No notes saved yet.
                  </div>
                )}
              </div>
            </SectionShell>
          </div>
        </section>

        <CustomerEditDialog
          customer={detail}
          salesReps={salesRepsQuery.data ?? []}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSubmit={(payload) => updateCustomerMutation.mutate(payload)}
          saving={updateCustomerMutation.isPending}
        />

        <ProspectConversionDialog
          customer={detail}
          salesReps={salesRepsQuery.data ?? []}
          open={convertOpen}
          onOpenChange={setConvertOpen}
          onSubmit={(payload) => updateCustomerMutation.mutate(payload)}
          saving={updateCustomerMutation.isPending}
        />

        <CustomerActivityDialog
          customer={detail}
          actionType={activityType}
          open={activityType !== null}
          onOpenChange={(open) => {
            if (!open) setActivityType(null);
          }}
          onSubmit={(payload) => createActivityMutation.mutate(payload)}
          saving={createActivityMutation.isPending}
        />

        <NoteEditDialog
          note={editingNote}
          open={editingNote !== null}
          onOpenChange={(open) => {
            if (!open) setEditingNote(null);
          }}
          onSubmit={(payload) => {
            if (!editingNote) return;
            updateActivityMutation.mutate({ activityId: editingNote.id, payload });
          }}
          saving={updateActivityMutation.isPending}
        />

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

        <Dialog open={contactOpen} onOpenChange={setContactOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingContact ? "Edit contact" : "Add contact"}</DialogTitle>
              <DialogDescription>Maintain the contacts attached to this account.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Name" value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} />
              <Input placeholder="Title" value={contactForm.title} onChange={(event) => setContactForm({ ...contactForm, title: event.target.value })} />
              <Input placeholder="Email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} />
              <Input placeholder="Phone" value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} />
              <label className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
                <input type="checkbox" checked={contactForm.isPrimary} onChange={(event) => setContactForm({ ...contactForm, isPrimary: event.target.checked })} className="size-4" />
                Set as primary contact
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setContactOpen(false)}>Cancel</Button>
              <Button disabled={contactMutation.isPending || !contactForm.name.trim()} onClick={() => contactMutation.mutate()}>
                {contactMutation.isPending ? "Saving..." : editingContact ? "Save contact" : "Add contact"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
