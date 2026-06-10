import React, { useDeferredValue, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  Eye,
  Flag,
  Package,
  Pencil,
  PlusCircle,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { setCustomerFlag, useCustomerFlags, useEkgxLeads, type EkgxLeadStatus, type EkgxLeadView } from "@/lib/beta-persistence";
import { getCustomers, type CustomerListItem, type CustomerStatus } from "@/lib/customer-crm";
import {
  createOpportunity,
  deleteOpportunity,
  formatOpportunityStatus,
  listOpportunities,
  updateOpportunity,
  type SalesOpportunity,
} from "@/lib/opportunities";
import { cn } from "@/lib/utils";
import { createCustomerRecord } from "@/lib/operations";

type CustomerCohort =
  | "all"
  | "flagged"
  | "active"
  | "prospect"
  | "parked"
  | "ekgx_leads"
  | "opportunities";
type OpportunityView = "open" | "won" | "lost" | "all";

const STATUS_OPTIONS: Array<{ value: CustomerStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "on_hold", label: "On Hold" },
  { value: "inactive", label: "Inactive" },
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
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "prospect":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "on_hold":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "inactive":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarClass(customer: CustomerListItem) {
  if (customer.status === "prospect") return "bg-sky-100 text-sky-700";
  if (customer.status === "on_hold") return "bg-amber-100 text-amber-700";
  if (customer.status === "inactive") return "bg-slate-200 text-slate-700";
  return "bg-indigo-100 text-indigo-700";
}

function getDefaultCreateForm() {
  return {
    name: "",
    companyName: "",
    primaryContactName: "",
    email: "",
    phone: "",
    billingAddress: "",
    shippingAddress: "",
    status: "prospect" as CustomerStatus,
    paymentTerms: "Net 30",
    creditLimit: "10000",
    customPricing: false,
    repId: null as number | null,
    customerSinceDate: "",
  };
}

function getDefaultOpportunityForm() {
  return {
    mode: "existing" as "existing" | "new",
    customerId: "",
    opportunity: "",
    status: "New lead",
    dueDate: "",
    notes: "",
    name: "",
    companyName: "",
    primaryContactName: "",
    email: "",
    phone: "",
  };
}

function formatOpportunityDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatLeadStatus(status: EkgxLeadStatus) {
  return status === "contacted" ? "Contacted" : "Not contacted";
}

function getLeadStatusBadgeClass(status: EkgxLeadStatus) {
  return status === "contacted"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function getOpportunityLifecycleClass(lifecycle: SalesOpportunity["lifecycle"]) {
  if (lifecycle === "won") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (lifecycle === "lost") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function sortOpportunitiesByUpdatedAt(opportunities: SalesOpportunity[]) {
  return [...opportunities].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function matchesCohort(customer: CustomerListItem, cohort: CustomerCohort, flaggedIds: number[]) {
  switch (cohort) {
    case "flagged":
      return flaggedIds.includes(customer.id);
    case "active":
      return customer.status === "active";
    case "prospect":
      return customer.status === "prospect";
    case "parked":
      return customer.status === "on_hold" || customer.status === "inactive";
    case "all":
    default:
      return true;
  }
}

function SummaryStat({
  icon: Icon,
  iconClassName,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
      <div className="flex items-start gap-4">
        <div className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-full", iconClassName)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function CustomersTableSkeleton() {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[1.5fr_repeat(6,minmax(0,1fr))_120px] gap-3 rounded-2xl border border-slate-100 p-4">
            {Array.from({ length: 8 }).map((__, cellIndex) => <Skeleton key={cellIndex} className="h-10 w-full" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Customers() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [cohort, setCohort] = useState<CustomerCohort>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [opportunityEditOpen, setOpportunityEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState(() => getDefaultCreateForm());
  const [opportunityForm, setOpportunityForm] = useState(() => getDefaultOpportunityForm());
  const [editingOpportunityId, setEditingOpportunityId] = useState<number | null>(null);
  const [opportunityView, setOpportunityView] = useState<OpportunityView>("open");
  const [ekgxLeadView, setEkgxLeadView] = useState<EkgxLeadView>("all");
  const deferredSearch = useDeferredValue(search.trim());
  const isProspectDraft = createForm.status === "prospect";
  const isNewOpportunityCustomer = opportunityForm.mode === "new";

  const customersQuery = useQuery({
    queryKey: ["customers-crm", deferredSearch],
    queryFn: () => getCustomers({ q: deferredSearch || undefined }),
  });
  const customerFlagsQuery = useCustomerFlags();
  const ekgxLeadsQuery = useEkgxLeads();
  const opportunitiesQuery = useQuery({
    queryKey: ["opportunities"],
    queryFn: listOpportunities,
  });

  const customers = customersQuery.data ?? [];
  const flaggedIds = customerFlagsQuery.data ?? [];
  const ekgxLeads = ekgxLeadsQuery.data ?? [];
  const opportunities = useMemo(
    () => sortOpportunitiesByUpdatedAt(opportunitiesQuery.data ?? []),
    [opportunitiesQuery.data],
  );
  const opportunityCounts = useMemo(
    () =>
      opportunities.reduce(
        (acc, opportunity) => {
          acc.all += 1;
          acc[opportunity.lifecycle] += 1;
          return acc;
        },
        { all: 0, open: 0, won: 0, lost: 0 },
      ),
    [opportunities],
  );
  const visibleOpportunities = useMemo(
    () =>
      opportunities.filter((opportunity) =>
        opportunityView === "all" ? true : opportunity.lifecycle === opportunityView,
      ),
    [opportunities, opportunityView],
  );
  const ekgxLeadCounts = useMemo(
    () =>
      ekgxLeads.reduce(
        (acc, lead) => {
          acc.all += 1;
          acc[lead.status] += 1;
          return acc;
        },
        { all: 0, contacted: 0, not_contacted: 0 },
      ),
    [ekgxLeads],
  );
  const visibleEkgxLeads = useMemo(() => {
    const normalizedSearch = deferredSearch.toLowerCase();
    return [...ekgxLeads]
      .filter((lead) => (ekgxLeadView === "all" ? true : lead.status === ekgxLeadView))
      .filter((lead) => {
        if (!normalizedSearch) return true;
        return [
          lead.businessName,
          lead.contactName,
          lead.email ?? "",
          lead.phone ?? "",
          lead.source,
        ].some((value) => value.toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime());
  }, [deferredSearch, ekgxLeadView, ekgxLeads]);

  const metrics = useMemo(() => {
    return customers.reduce(
      (acc, customer) => {
        acc.total += 1;
        if (customer.status === "active") acc.active += 1;
        if (customer.status === "prospect") acc.prospects += 1;
        if (customer.status === "on_hold" || customer.status === "inactive") acc.parked += 1;
        if (flaggedIds.includes(customer.id)) acc.flagged += 1;
        return acc;
      },
      { total: 0, active: 0, prospects: 0, parked: 0, flagged: 0 },
    );
  }, [customers, flaggedIds]);

  const visibleCustomers = useMemo(() => {
    return [...customers]
      .filter((customer) => matchesCohort(customer, cohort, flaggedIds))
      .sort((left, right) => {
        const flaggedDelta = Number(flaggedIds.includes(right.id)) - Number(flaggedIds.includes(left.id));
        if (flaggedDelta !== 0) return flaggedDelta;
        return right.lifetimeRevenue - left.lifetimeRevenue;
      });
  }, [cohort, customers, flaggedIds]);

  const cohortTabs = [
    { value: "all" as const, label: "All Customers", count: metrics.total },
    { value: "active" as const, label: "Active Customers", count: metrics.active },
    { value: "prospect" as const, label: "Prospects", count: metrics.prospects },
    { value: "parked" as const, label: "Inactive", count: metrics.parked },
    { value: "flagged" as const, label: "Flagged", count: metrics.flagged },
    { value: "ekgx_leads" as const, label: "EKGX Leads", count: ekgxLeadCounts.all },
    { value: "opportunities" as const, label: "Opportunities", count: opportunityCounts.open },
  ];

  const toggleFlagMutation = useMutation({
    mutationFn: async (customerId: number) => {
      const isFlagged = flaggedIds.includes(customerId);
      await setCustomerFlag(customerId, !isFlagged);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "customer-flags"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to update flag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleFlagged = (customerId: number) => {
    toggleFlagMutation.mutate(customerId);
  };

  function formatLastOrderDate(value: string | null) {
    if (!value) return "No orders yet";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  }

  function formatLeadDate(value: string) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  }

  function formatLeadTime(value: string) {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  }

  const createMutation = useMutation({
    mutationFn: () => createCustomerRecord({
      ...createForm,
      primaryContactName: (createForm.primaryContactName || createForm.name || createForm.companyName).trim(),
      email: createForm.email || null,
      phone: createForm.phone || null,
      billingAddress: isProspectDraft ? null : createForm.billingAddress || null,
      shippingAddress: isProspectDraft ? null : createForm.shippingAddress || null,
      paymentTerms: isProspectDraft ? "Net 30" : createForm.paymentTerms,
      creditLimit: Number(isProspectDraft ? "10000" : createForm.creditLimit || "0"),
      customerSinceDate: createForm.customerSinceDate || null,
    }),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["customers-crm"] });
      setCreateOpen(false);
      setCreateForm(getDefaultCreateForm());
      toast({ title: "Customer created" });
      navigate(`/customers/${payload.id}`);
    },
    onError: (error: Error) => toast({ title: "Unable to create customer", description: error.message, variant: "destructive" }),
  });

  const createOpportunityMutation = useMutation({
    mutationFn: async () => {
      const opportunityTitle = opportunityForm.opportunity.trim();
      if (!opportunityTitle) {
        throw new Error("Opportunity details are required.");
      }

      if (opportunityForm.mode === "existing") {
        const selectedCustomer = customers.find((customer) => customer.id === Number(opportunityForm.customerId));
        if (!selectedCustomer) {
          throw new Error("Select an existing customer first.");
        }

        await createOpportunity({
          customerId: selectedCustomer.id,
          title: opportunityTitle,
          status: opportunityForm.status,
          source: "existing_customer",
          dueDate: opportunityForm.dueDate || null,
          notes: opportunityForm.notes.trim() || null,
        });
        return { customerId: selectedCustomer.id, createdCustomer: false };
      }

      const customerName = opportunityForm.name.trim();
      const companyName = opportunityForm.companyName.trim();
      if (!customerName || !companyName) {
        throw new Error("New customer opportunities need a customer and company name.");
      }

      const createdCustomer = await createCustomerRecord({
        name: customerName,
        companyName,
        primaryContactName:
          (opportunityForm.primaryContactName || customerName || companyName).trim(),
        email: opportunityForm.email.trim() || null,
        phone: opportunityForm.phone.trim() || null,
        billingAddress: null,
        shippingAddress: null,
        status: "prospect",
        paymentTerms: "Net 30",
        creditLimit: 10000,
        customPricing: false,
        repId: null,
        customerSinceDate: null,
      });

      await createOpportunity({
        customerId: createdCustomer.id,
        title: opportunityTitle,
        status: opportunityForm.status,
        source: "new_customer",
        dueDate: opportunityForm.dueDate || null,
        notes: opportunityForm.notes.trim() || null,
      });
      return { customerId: createdCustomer.id, createdCustomer: true };
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers-crm"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
      ]);
      setOpportunityOpen(false);
      setOpportunityForm(getDefaultOpportunityForm());
      toast({
        title: "Opportunity created",
        description: "It will now appear on the Daily Command Center.",
      });
      navigate(`/customers/${result.customerId}`);
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to create opportunity",
        description: error.message,
        variant: "destructive",
      }),
  });

  function handleEditOpportunity(opportunity: SalesOpportunity) {
    setEditingOpportunityId(opportunity.id);
    setOpportunityForm({
      mode: opportunity.source === "existing_customer" ? "existing" : "new",
      customerId: String(opportunity.customerId),
      opportunity: opportunity.title,
      status: opportunity.status,
      dueDate: opportunity.dueDate ?? "",
      notes: opportunity.notes ?? "",
      name: opportunity.customerName,
      companyName: opportunity.companyName,
      primaryContactName: opportunity.contactName,
      email: opportunity.contactEmail ?? "",
      phone: opportunity.contactPhone ?? "",
    });
    setOpportunityEditOpen(true);
  }

  const updateOpportunityMutation = useMutation({
    mutationFn: async ({
      opportunityId,
      lifecycle,
      lastContactedAt,
      lastContactNote,
      deleteRecord,
    }: {
      opportunityId: number;
      lifecycle?: SalesOpportunity["lifecycle"];
      lastContactedAt?: string | null;
      lastContactNote?: string | null;
      deleteRecord?: boolean;
    }) => {
      if (deleteRecord) {
        await deleteOpportunity(opportunityId);
        return null;
      }

      if (editingOpportunityId === opportunityId) {
        const existingCustomer = customers.find(
          (customer) => customer.id === Number(opportunityForm.customerId),
        );

        return updateOpportunity(opportunityId, {
          customerId:
            opportunityForm.mode === "existing" && existingCustomer
              ? existingCustomer.id
              : undefined,
          title: opportunityForm.opportunity.trim() || undefined,
          status: opportunityForm.status.trim() || undefined,
          dueDate: opportunityForm.dueDate || null,
          notes: opportunityForm.notes.trim() || null,
          source: opportunityForm.mode === "existing" ? "existing_customer" : "new_customer",
        });
      }

      return updateOpportunity(opportunityId, {
        lifecycle,
        lastContactedAt,
        lastContactNote,
      });
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });

      if (variables.deleteRecord) {
        toast({ title: "Opportunity deleted" });
        return;
      }

      if (editingOpportunityId === variables.opportunityId) {
        setOpportunityEditOpen(false);
        setEditingOpportunityId(null);
        setOpportunityForm(getDefaultOpportunityForm());
        toast({ title: "Opportunity updated" });
        return;
      }

      if (variables.lifecycle) {
        toast({
          title:
            variables.lifecycle === "won"
              ? "Opportunity marked won"
              : variables.lifecycle === "lost"
                ? "Opportunity marked lost"
                : "Opportunity reopened",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to update opportunity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function handleSaveOpportunityEdits() {
    if (!editingOpportunityId) {
      return;
    }
    updateOpportunityMutation.mutate({ opportunityId: editingOpportunityId });
  }

  function handleSetOpportunityLifecycle(
    opportunityId: number,
    lifecycle: SalesOpportunity["lifecycle"],
  ) {
    updateOpportunityMutation.mutate({ opportunityId, lifecycle });
  }

  function handleDeleteOpportunity(opportunityId: number) {
    updateOpportunityMutation.mutate({ opportunityId, deleteRecord: true });
  }

  return (
    <AppLayout fluid>
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-2 pb-8">
        <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#f2f6fc_100%)] px-6 py-6 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] md:px-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Customers</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Manage prospects, customers, and flagged accounts</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Scan relationship health, revenue, order activity, and priority accounts from one clean CRM list without losing prospect visibility.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" className="bg-white">
                  Export
                </Button>
                <Button onClick={() => setCreateOpen(true)}>
                  <PlusCircle className="mr-2 size-4" />
                  Create customer
                </Button>
                <Button variant="outline" className="bg-white" onClick={() => setOpportunityOpen(true)}>
                  <Target className="mr-2 size-4" />
                  New opportunity
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <SummaryStat icon={Users} iconClassName="bg-sky-100 text-sky-700" label="Customers" value={String(metrics.total)} detail="All customer accounts" />
              <SummaryStat icon={Eye} iconClassName="bg-emerald-100 text-emerald-700" label="Prospects" value={String(metrics.prospects)} detail="Potential new customers" />
              <SummaryStat icon={Flag} iconClassName="bg-amber-100 text-amber-700" label="Flagged" value={String(metrics.flagged)} detail="User-flagged for closer follow-up" />
              <SummaryStat icon={ShieldCheck} iconClassName="bg-violet-100 text-violet-700" label="Active" value={String(metrics.active)} detail="Customer accounts in good standing" />
              <SummaryStat icon={Package} iconClassName="bg-cyan-100 text-cyan-700" label="Inactive" value={String(metrics.parked)} detail="Parked or inactive accounts" />
            </div>
          </div>
        </section>

        <Card className="overflow-hidden rounded-[28px] border border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
          <CardHeader className="gap-5 border-b border-slate-200 bg-white px-6 pb-5 pt-6">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
              {cohortTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setCohort(tab.value)}
                  className={cn(
                    "relative flex h-12 items-center gap-2 whitespace-nowrap border-b-2 px-1 text-sm font-semibold transition",
                    cohort === tab.value
                      ? "border-sky-600 text-sky-700"
                      : "border-transparent text-slate-500 hover:text-slate-900",
                  )}
                >
                  <span>{tab.label}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", cohort === tab.value ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500")}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="w-full max-w-[430px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customers, contacts, companies, or leads..."
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-9"
                  />
                </div>
                {cohort === "opportunities" ? (
                  <Tabs value={opportunityView} onValueChange={(value) => setOpportunityView(value as OpportunityView)}>
                    <TabsList className="h-12 rounded-xl bg-slate-100 p-1">
                      <TabsTrigger value="open" className="rounded-lg">Open</TabsTrigger>
                      <TabsTrigger value="won" className="rounded-lg">Won</TabsTrigger>
                      <TabsTrigger value="lost" className="rounded-lg">Lost</TabsTrigger>
                      <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
                    </TabsList>
                  </Tabs>
                ) : cohort === "ekgx_leads" ? (
                  <Tabs value={ekgxLeadView} onValueChange={(value) => setEkgxLeadView(value as EkgxLeadView)}>
                    <TabsList className="h-12 rounded-xl bg-slate-100 p-1">
                      <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
                      <TabsTrigger value="not_contacted" className="rounded-lg">Not Contacted</TabsTrigger>
                      <TabsTrigger value="contacted" className="rounded-lg">Contacted</TabsTrigger>
                    </TabsList>
                  </Tabs>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {cohort === "opportunities" ? (
                  <Button onClick={() => setOpportunityOpen(true)}>
                    <PlusCircle className="mr-2 size-4" />
                    Add opportunity
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="bg-slate-50 p-4 md:p-5">
            {cohort === "opportunities" ? (
              visibleOpportunities.length > 0 ? (
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="border-slate-200 hover:bg-slate-50">
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Customer</TableHead>
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Opportunity</TableHead>
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Status</TableHead>
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Due</TableHead>
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Last Contact</TableHead>
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Lifecycle</TableHead>
                        <TableHead className="w-[250px] px-4 text-right text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleOpportunities.map((opportunity) => (
                        <TableRow key={opportunity.id} className="border-slate-200 hover:bg-slate-50/80">
                          <TableCell className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => navigate(`/customers/${opportunity.customerId}`)}
                              className="text-left"
                            >
                              <div className="text-sm font-semibold text-slate-950">{opportunity.customerName}</div>
                              <div className="text-xs text-slate-500">{opportunity.companyName}</div>
                            </button>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="text-sm font-medium text-slate-900">{opportunity.title}</div>
                            {opportunity.notes ? (
                              <div className="mt-1 line-clamp-2 text-xs text-slate-500">{opportunity.notes}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                              {formatOpportunityStatus(opportunity.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-sm text-slate-700">
                            <div className="inline-flex items-center gap-2">
                              <CalendarClock className="size-4 text-slate-400" />
                              {formatOpportunityDate(opportunity.dueDate)}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-sm text-slate-700">
                            {opportunity.lastContactedAt
                              ? new Intl.DateTimeFormat("en-US", {
                                  month: "short",
                                  day: "numeric",
                                }).format(new Date(opportunity.lastContactedAt))
                              : "No contact yet"}
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <Badge variant="outline" className={getOpportunityLifecycleClass(opportunity.lifecycle)}>
                              {opportunity.lifecycle.charAt(0).toUpperCase() + opportunity.lifecycle.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEditOpportunity(opportunity)}>
                                <Pencil className="mr-2 size-3.5" />
                                Edit
                              </Button>
                              {opportunity.lifecycle !== "won" ? (
                                <Button variant="outline" size="sm" className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => handleSetOpportunityLifecycle(opportunity.id, "won")}>
                                  Won
                                </Button>
                              ) : null}
                              {opportunity.lifecycle !== "lost" ? (
                                <Button variant="outline" size="sm" className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" onClick={() => handleSetOpportunityLifecycle(opportunity.id, "lost")}>
                                  Lost
                                </Button>
                              ) : null}
                              {opportunity.lifecycle !== "open" ? (
                                <Button variant="outline" size="sm" onClick={() => handleSetOpportunityLifecycle(opportunity.id, "open")}>
                                  Reopen
                                </Button>
                              ) : null}
                              <Button variant="ghost" size="sm" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => handleDeleteOpportunity(opportunity.id)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Empty className="rounded-[24px] border border-slate-200 bg-white py-16">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Target className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>No opportunities in this view</EmptyTitle>
                    <EmptyDescription>
                      Create a new opportunity or switch lifecycle tabs to review won, lost, and active pipeline items.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )
            ) : cohort === "ekgx_leads" ? (
              visibleEkgxLeads.length > 0 ? (
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="border-slate-200 hover:bg-slate-50">
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Lead</TableHead>
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Contact Name</TableHead>
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Contact Info</TableHead>
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Date</TableHead>
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Time</TableHead>
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Status</TableHead>
                        <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleEkgxLeads.map((lead) => (
                        <TableRow
                          key={lead.id}
                          className="cursor-pointer border-slate-200 hover:bg-slate-50/80"
                          onClick={() => navigate(`/customers/ekgx-leads/${lead.id}`)}
                        >
                          <TableCell className="px-4 py-4">
                            <div className="text-sm font-semibold text-slate-950">{lead.businessName}</div>
                            <div className="text-xs text-slate-500">{lead.flagged ? "Flagged EKGX Facebook lead" : "EKGX Facebook lead"}</div>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="text-sm font-medium text-slate-900">{lead.contactName}</div>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="text-sm text-slate-900">{lead.email || lead.phone || "No contact info"}</div>
                            <div className="text-xs text-slate-500">
                              {lead.email && lead.phone ? lead.phone : lead.email ? "Email" : lead.phone ? "Phone" : "Needs follow-up"}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-sm text-slate-900">{formatLeadDate(lead.submittedAt)}</TableCell>
                          <TableCell className="px-4 py-4 text-sm text-slate-900">{formatLeadTime(lead.submittedAt)}</TableCell>
                          <TableCell className="px-4 py-4">
                            <Badge variant="outline" className={getLeadStatusBadgeClass(lead.status)}>
                              {formatLeadStatus(lead.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                              {lead.source}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Empty className="rounded-[24px] border border-slate-200 bg-white py-16">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Users className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>No EKGX leads in this view</EmptyTitle>
                    <EmptyDescription>
                      Try a different search or switch between contacted and not contacted Facebook leads.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )
            ) : customersQuery.isLoading ? (
              <CustomersTableSkeleton />
            ) : visibleCustomers.length > 0 ? (
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200 hover:bg-slate-50">
                      <TableHead className="min-w-[300px] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Customer</TableHead>
                      <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Contact Name</TableHead>
                      <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Contact Info</TableHead>
                      <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Last Order Date</TableHead>
                      <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Status</TableHead>
                      <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Owner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleCustomers.map((customer) => {
                      const isFlagged = flaggedIds.includes(customer.id);
                      return (
                        <TableRow
                          key={customer.id}
                          className="cursor-pointer border-slate-200 hover:bg-slate-50/80"
                          onClick={() => navigate(`/customers/${customer.id}`)}
                        >
                          <TableCell className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFlagged(customer.id);
                                }}
                                className={cn(
                                  "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border transition",
                                  isFlagged
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-slate-200 bg-white text-slate-400 hover:text-amber-700",
                                )}
                                aria-label={isFlagged ? `Remove flag from ${customer.name}` : `Flag ${customer.name}`}
                              >
                                <Flag className={cn("size-4", isFlagged && "fill-current")} />
                              </button>
                              <div className="flex min-w-0 items-start gap-3 text-left">
                                <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold", getAvatarClass(customer))}>
                                  {getInitials(customer.name)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-slate-950">{customer.name}</span>
                                  <span className="mt-1 block truncate text-sm text-slate-500">{customer.companyName}</span>
                                  <span className="mt-2 flex flex-wrap gap-2">
                                    {isFlagged ? (
                                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Flagged</Badge>
                                    ) : null}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4">
                            <div className="text-sm font-medium text-slate-900">{customer.primaryContact}</div>
                            <div className="text-xs text-slate-500">{customer.companyName}</div>
                          </TableCell>
                          <TableCell className="px-4">
                            <div className="text-sm text-slate-900">{customer.email || customer.phone || "No direct contact"}</div>
                            <div className="text-xs text-slate-500">{customer.email && customer.phone ? customer.phone : customer.email ? "Email" : customer.phone ? "Phone" : "Update record"}</div>
                          </TableCell>
                          <TableCell className="px-4">
                            <div className="text-sm font-medium text-slate-900">{formatLastOrderDate(customer.lastOrderDate)}</div>
                            <div className="text-xs text-slate-500">{customer.lastOrderDate ? "Most recent order" : "No order history"}</div>
                          </TableCell>
                          <TableCell className="px-4">
                            <Badge variant="outline" className={getStatusBadgeClass(customer.status)}>
                              {formatStatusLabel(customer.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4">
                            <div className="text-sm font-medium text-slate-900">{customer.repName || "Unassigned"}</div>
                            <div className="text-xs text-slate-500">{customer.repName ? "Account owner" : "Needs assignment"}</div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Empty className="rounded-[24px] border border-slate-200 bg-white py-16">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Building2 className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No accounts match this view</EmptyTitle>
                  <EmptyDescription>
                    Clear the search, change the status filter, or switch tabs to bring more customers back into the list.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create customer</DialogTitle>
              <DialogDescription>Start with the basics, then add account setup only when it actually exists.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-900">What are you creating?</p>
                <p className="mt-1 text-sm text-slate-500">Prospects stay lightweight. Customer setup appears when you need it.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, status: "prospect" })}
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition",
                      createForm.status === "prospect"
                        ? "border-sky-300 bg-sky-50 shadow-[0_12px_30px_-24px_rgba(14,116,144,0.8)]"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <p className="font-semibold text-slate-950">Prospect</p>
                    <p className="mt-1 text-sm text-slate-500">Capture the relationship first. Terms, limits, and addresses can wait.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, status: "active" })}
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition",
                      createForm.status !== "prospect"
                        ? "border-emerald-300 bg-emerald-50 shadow-[0_12px_30px_-24px_rgba(22,101,52,0.7)]"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <p className="font-semibold text-slate-950">Customer account</p>
                    <p className="mt-1 text-sm text-slate-500">Set up the commercial details now so ordering can start immediately.</p>
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Core details</p>
                    <p className="mt-1 text-sm text-slate-500">These are the only details you really need to get the record created.</p>
                  </div>
                  <Badge variant="outline" className={cn("capitalize", getStatusBadgeClass(createForm.status))}>
                    {formatStatusLabel(createForm.status)}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Input placeholder="Customer name" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} />
                  <Input placeholder="Company name" value={createForm.companyName} onChange={(event) => setCreateForm({ ...createForm, companyName: event.target.value })} />
                  <Input
                    placeholder={isProspectDraft ? "Lead or contact name (optional)" : "Primary contact"}
                    value={createForm.primaryContactName}
                    onChange={(event) => setCreateForm({ ...createForm, primaryContactName: event.target.value })}
                  />
                  <Input placeholder="Email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} />
                  <Input placeholder="Phone" value={createForm.phone} onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value })} />
                  <Input type="date" value={createForm.customerSinceDate} onChange={(event) => setCreateForm({ ...createForm, customerSinceDate: event.target.value })} />
                </div>
              </div>

              {!isProspectDraft ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">Account setup</p>
                  <p className="mt-1 text-sm text-slate-500">Only needed when you are creating a full customer account.</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Input placeholder="Payment terms" value={createForm.paymentTerms} onChange={(event) => setCreateForm({ ...createForm, paymentTerms: event.target.value })} />
                    <Input placeholder="Credit limit" type="number" min="0" step="0.01" value={createForm.creditLimit} onChange={(event) => setCreateForm({ ...createForm, creditLimit: event.target.value })} />
                    <Select value={createForm.status} onValueChange={(value) => setCreateForm({ ...createForm, status: value as CustomerStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.filter((option) => option.value !== "all" && option.value !== "prospect").map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Rep assignment can be added from the account once the record exists.</div>
                    <Textarea className="md:col-span-2 min-h-24" placeholder="Billing address" value={createForm.billingAddress} onChange={(event) => setCreateForm({ ...createForm, billingAddress: event.target.value })} />
                    <Textarea className="md:col-span-2 min-h-24" placeholder="Shipping address" value={createForm.shippingAddress} onChange={(event) => setCreateForm({ ...createForm, shippingAddress: event.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="rounded-[20px] border border-dashed border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-sky-900">
                  Prospect records will use default terms and credit settings until the account is qualified and filled out later.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button disabled={createMutation.isPending || !createForm.name.trim() || !createForm.companyName.trim()} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? "Creating..." : isProspectDraft ? "Create prospect" : "Create customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={opportunityOpen} onOpenChange={setOpportunityOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create opportunity</DialogTitle>
              <DialogDescription>
                Choose whether this is for an existing customer or a new customer, then describe the opportunity and status.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Who is this opportunity for?</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setOpportunityForm((current) => ({ ...current, mode: "existing" }))}
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition",
                      opportunityForm.mode === "existing"
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <p className="font-semibold text-slate-950">Existing customer</p>
                    <p className="mt-1 text-sm text-slate-500">Attach the opportunity to a current CRM record.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpportunityForm((current) => ({ ...current, mode: "new" }))}
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition",
                      opportunityForm.mode === "new"
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <p className="font-semibold text-slate-950">New customer</p>
                    <p className="mt-1 text-sm text-slate-500">Create a new prospect record and add the opportunity in one step.</p>
                  </button>
                </div>
              </div>

              {isNewOpportunityCustomer ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">New customer details</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Input
                      placeholder="Customer name"
                      value={opportunityForm.name}
                      onChange={(event) => setOpportunityForm((current) => ({ ...current, name: event.target.value }))}
                    />
                    <Input
                      placeholder="Company name"
                      value={opportunityForm.companyName}
                      onChange={(event) => setOpportunityForm((current) => ({ ...current, companyName: event.target.value }))}
                    />
                    <Input
                      placeholder="Primary contact"
                      value={opportunityForm.primaryContactName}
                      onChange={(event) => setOpportunityForm((current) => ({ ...current, primaryContactName: event.target.value }))}
                    />
                    <Input
                      placeholder="Email"
                      value={opportunityForm.email}
                      onChange={(event) => setOpportunityForm((current) => ({ ...current, email: event.target.value }))}
                    />
                    <Input
                      placeholder="Phone"
                      value={opportunityForm.phone}
                      onChange={(event) => setOpportunityForm((current) => ({ ...current, phone: event.target.value }))}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">Select customer</p>
                  <div className="mt-4">
                    <Select
                      value={opportunityForm.customerId}
                      onValueChange={(value) => setOpportunityForm((current) => ({ ...current, customerId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an existing customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={String(customer.id)}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">Opportunity details</p>
                <div className="mt-4 grid gap-4">
                  <Textarea
                    className="min-h-24"
                    placeholder="Example: Expand ABC Urgent Care to our new flu test."
                    value={opportunityForm.opportunity}
                    onChange={(event) => setOpportunityForm((current) => ({ ...current, opportunity: event.target.value }))}
                  />
                  <Input
                    placeholder="Status, for example: Quote sent"
                    value={opportunityForm.status}
                    onChange={(event) =>
                      setOpportunityForm((current) => ({ ...current, status: event.target.value }))
                    }
                  />
                  <Input
                    type="date"
                    value={opportunityForm.dueDate}
                    onChange={(event) =>
                      setOpportunityForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                  />
                  <Textarea
                    className="min-h-24"
                    placeholder="Notes, next steps, objections, or anything else the team should know."
                    value={opportunityForm.notes}
                    onChange={(event) =>
                      setOpportunityForm((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpportunityOpen(false)}>Cancel</Button>
              <Button
                disabled={
                  createOpportunityMutation.isPending ||
                  !opportunityForm.opportunity.trim() ||
                  (isNewOpportunityCustomer
                    ? !opportunityForm.name.trim() || !opportunityForm.companyName.trim()
                    : !opportunityForm.customerId)
                }
                onClick={() => createOpportunityMutation.mutate()}
              >
                {createOpportunityMutation.isPending ? "Creating..." : "Create opportunity"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={opportunityEditOpen} onOpenChange={setOpportunityEditOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit opportunity</DialogTitle>
              <DialogDescription>
                Update the opportunity, due date, contact information, notes, and current status.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              {opportunityForm.mode === "new" ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">Customer details</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Input value={opportunityForm.name} onChange={(event) => setOpportunityForm((current) => ({ ...current, name: event.target.value }))} placeholder="Customer name" />
                    <Input value={opportunityForm.companyName} onChange={(event) => setOpportunityForm((current) => ({ ...current, companyName: event.target.value }))} placeholder="Company name" />
                    <Input value={opportunityForm.primaryContactName} onChange={(event) => setOpportunityForm((current) => ({ ...current, primaryContactName: event.target.value }))} placeholder="Primary contact" />
                    <Input value={opportunityForm.email} onChange={(event) => setOpportunityForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
                    <Input value={opportunityForm.phone} onChange={(event) => setOpportunityForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" />
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">Attached customer</p>
                  <Select value={opportunityForm.customerId} onValueChange={(value) => setOpportunityForm((current) => ({ ...current, customerId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an existing customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={String(customer.id)}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">Opportunity details</p>
                <div className="mt-4 grid gap-4">
                  <Textarea className="min-h-24" value={opportunityForm.opportunity} onChange={(event) => setOpportunityForm((current) => ({ ...current, opportunity: event.target.value }))} placeholder="Opportunity description" />
                  <Input value={opportunityForm.status} onChange={(event) => setOpportunityForm((current) => ({ ...current, status: event.target.value }))} placeholder="Current status" />
                  <Input type="date" value={opportunityForm.dueDate} onChange={(event) => setOpportunityForm((current) => ({ ...current, dueDate: event.target.value }))} />
                  <Textarea className="min-h-24" value={opportunityForm.notes} onChange={(event) => setOpportunityForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes and next steps" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpportunityEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveOpportunityEdits}>Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
