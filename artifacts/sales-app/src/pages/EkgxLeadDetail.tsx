import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Flag,
  Mail,
  Phone,
  Sparkles,
  User,
  UserPlus2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createEkgxLeadActivity, getEkgxLeadById, getEkgxLeadMailto, updateEkgxLead, type EkgxLead } from "@/lib/beta-persistence";
import { createCustomerRecord } from "@/lib/operations";
import { cn } from "@/lib/utils";

type TimelineTone = "emerald" | "blue" | "amber" | "slate";

type TimelineEvent = {
  id: string;
  title: string;
  actor: string;
  channel: string;
  description: string;
  timestamp: string;
  badge?: string;
  tone: TimelineTone;
};

const CONTACT_METHOD_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "linkedin", label: "LinkedIn" },
] as const;

const CONTACT_RESULT_OPTIONS = [
  { value: "sent", label: "Sent" },
  { value: "spoke", label: "Spoke" },
  { value: "left_voicemail", label: "Left voicemail" },
  { value: "no_response", label: "No response" },
] as const;

function formatDateTime(value: string | null) {
  if (!value) return "No contact logged yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatOptional(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function getLeadStatusBadgeClass(status: EkgxLead["status"]) {
  return status === "contacted"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-700";
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "EK";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function toTitleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTimelineTone(status: EkgxLead["status"]): TimelineTone {
  return status === "contacted" ? "emerald" : "blue";
}

function getTimelineBadgeClass(tone: TimelineTone) {
  if (tone === "emerald") return "bg-emerald-100 text-emerald-700";
  if (tone === "amber") return "bg-amber-100 text-amber-700";
  if (tone === "blue") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function getTimelineDotClass(tone: TimelineTone) {
  if (tone === "emerald") return "bg-emerald-500 text-white";
  if (tone === "amber") return "bg-amber-500 text-white";
  if (tone === "blue") return "bg-blue-600 text-white";
  return "bg-slate-500 text-white";
}

function LeadDetailSkeleton() {
  return (
    <AppLayout fluid>
      <div className="mx-auto flex w-full max-w-[1420px] flex-col gap-6 px-4 pb-8 pt-4">
        <Skeleton className="h-10 w-44" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Skeleton className="h-[220px] rounded-[28px]" />
          <Skeleton className="h-[220px] rounded-[28px]" />
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Skeleton className="h-[520px] rounded-[28px]" />
          <div className="grid gap-5">
            <Skeleton className="h-[180px] rounded-[28px]" />
            <Skeleton className="h-[180px] rounded-[28px]" />
            <Skeleton className="h-[180px] rounded-[28px]" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function EkgxLeadDetail() {
  const params = useParams<{ leadId: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const leadId = Number(params.leadId);
  const leadQuery = useQuery({
    queryKey: ["crm", "ekgx-leads", leadId],
    queryFn: () => getEkgxLeadById(leadId),
    enabled: Number.isInteger(leadId) && leadId > 0,
  });
  const lead = leadQuery.data ?? null;
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactMethod, setContactMethod] = useState<(typeof CONTACT_METHOD_OPTIONS)[number]["value"]>("email");
  const [contactResult, setContactResult] = useState<(typeof CONTACT_RESULT_OPTIONS)[number]["value"]>("sent");
  const [contactSummary, setContactSummary] = useState("");

  useEffect(() => {
    setNotes(lead?.notes ?? "");
  }, [lead?.notes]);

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!lead) {
        throw new Error("Lead not found.");
      }

      return createCustomerRecord({
        name: lead.contactName,
        companyName: lead.businessName,
        primaryContactName: lead.contactName,
        email: lead.email,
        phone: lead.phone,
        billingAddress: null,
        shippingAddress: null,
        status: "prospect",
        paymentTerms: "Net 30",
        creditLimit: 10000,
        customPricing: false,
        repId: null,
        customerSinceDate: null,
      });
    },
    onSuccess: (createdCustomer) => {
      toast({ title: "Converted to prospect", description: "The EKGx lead is now a CRM prospect record." });
      navigate(`/customers/${createdCustomer.id}`);
    },
    onError: (error: Error) =>
      toast({ title: "Unable to convert lead", description: error.message, variant: "destructive" }),
  });

  const updateLeadMutation = useMutation({
    mutationFn: (updates: Partial<Pick<EkgxLead, "notes" | "lastContactAt" | "lastContactSummary" | "status" | "flagged">>) =>
      updateEkgxLead(leadId, updates),
    onSuccess: async (updatedLead, variables) => {
      queryClient.setQueryData(["crm", "ekgx-leads", leadId], updatedLead);
      await queryClient.invalidateQueries({ queryKey: ["crm", "ekgx-leads"] });
      if ("notes" in variables) {
        toast({ title: "Lead notes saved" });
      }
    },
    onError: (error: Error) =>
      toast({ title: "Unable to update lead", description: error.message, variant: "destructive" }),
  });

  const emailHref = lead ? getEkgxLeadMailto(lead) : null;
  const latestActivity = lead?.activities?.[0] ?? null;

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    if (!lead) return [];

    const events: TimelineEvent[] = [
      {
        id: `created-${lead.id}`,
        title: "Lead created",
        actor: "System",
        channel: "Facebook lead capture",
        description: `${lead.businessName} entered the EKGx queue from ${lead.source}.`,
        timestamp: lead.submittedAt,
        badge: "New lead",
        tone: "slate",
      },
    ];

    for (const activity of lead.activities ?? []) {
      events.unshift({
        id: `activity-${activity.id}`,
        title: toTitleCase(activity.result),
        actor: activity.createdBy,
        channel: toTitleCase(activity.contactMethod),
        description: activity.summary,
        timestamp: activity.createdAt,
        badge: toTitleCase(activity.result),
        tone: getTimelineTone(lead.status),
      });
    }

    return events.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  }, [lead]);

  const intakeDetails = useMemo(() => {
    if (!lead) return [];

    return [
      { label: "Business Type", value: formatOptional(lead.businessType) },
      { label: "Country", value: formatOptional(lead.country) },
      { label: "State", value: formatOptional(lead.state) },
      { label: "Job Title", value: formatOptional(lead.jobTitle) },
      { label: "Role", value: formatOptional(lead.role) },
      { label: "Locations", value: formatOptional(lead.locations) },
      { label: "Intended Use", value: formatOptional(lead.intendedUse) },
      { label: "Purchase Timeline", value: formatOptional(lead.purchaseTimeline) },
    ];
  }, [lead]);
  const primaryIntakeDetails = intakeDetails.slice(0, 6);
  const secondaryIntakeDetails = intakeDetails.slice(6);

  function openContactDialog(defaultMethod: (typeof CONTACT_METHOD_OPTIONS)[number]["value"]) {
    setContactMethod(defaultMethod);
    setContactResult(defaultMethod === "call" ? "spoke" : "sent");
    setContactSummary("");
    setContactDialogOpen(true);
  }

  function submitContactLog() {
    const trimmedSummary = contactSummary.trim();
    if (!trimmedSummary) {
      toast({ title: "Add a short contact summary", variant: "destructive" });
      return;
    }

    createEkgxLeadActivity(leadId, {
      contactMethod,
      result: contactResult,
      summary: trimmedSummary,
    })
      .then(async ({ lead: updatedLead }) => {
        queryClient.setQueryData(["crm", "ekgx-leads", leadId], updatedLead);
        await queryClient.invalidateQueries({ queryKey: ["crm", "ekgx-leads", leadId] });
        await queryClient.invalidateQueries({ queryKey: ["crm", "ekgx-leads"] });
        setContactDialogOpen(false);
        setContactSummary("");
        toast({ title: "Contact logged" });
      })
      .catch((error: Error) => {
        toast({ title: "Unable to log contact", description: error.message, variant: "destructive" });
      });
  }

  if (leadQuery.isLoading) {
    return <LeadDetailSkeleton />;
  }

  if (!lead) {
    return (
      <AppLayout fluid>
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 pb-8">
          <Link href="/ekgx-leads">
            <Button variant="ghost" className="w-fit text-slate-700">
              <ArrowLeft className="mr-2 size-4" />
              Back to EKGx Leads
            </Button>
          </Link>
          <Card className="rounded-[28px] border border-slate-200">
            <CardContent className="py-16 text-center text-slate-600">Lead not found.</CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout fluid>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.08),transparent_34%),linear-gradient(180deg,#f7f9fd_0%,#eef3fa_100%)]">
        <div className="mx-auto flex w-full max-w-[1460px] flex-col gap-5 px-4 pb-8 pt-4">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 px-1 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/ekgx-leads">
              <Button variant="ghost" className="w-fit rounded-xl px-3 text-slate-700 hover:bg-white/80">
                <ArrowLeft className="mr-2 size-4" />
                Back to Leads
              </Button>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              {emailHref ? (
                <Button variant="outline" className="rounded-xl border-slate-200 bg-white px-5" asChild>
                  <a href={emailHref}>
                    <Mail className="mr-2 size-4" />
                    Send Email
                  </a>
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="rounded-xl border-slate-200 bg-white px-5"
                onClick={() => {
                  updateLeadMutation.mutate(
                    { flagged: !lead.flagged },
                    {
                      onSuccess: () => {
                        toast({ title: lead.flagged ? "Lead unflagged" : "Lead flagged for follow-up" });
                      },
                    },
                  );
                }}
              >
                <Flag className="mr-2 size-4" />
                {lead.flagged ? "Unflag Lead" : "Flag Lead"}
              </Button>
              <Button
                className="rounded-xl border border-blue-600 bg-blue-600 px-5 text-white shadow-[0_16px_40px_-20px_rgba(37,99,235,0.72)] hover:bg-blue-700"
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
              >
                <UserPlus2 className="mr-2 size-4" />
                {convertMutation.isPending ? "Converting..." : "Convert to Prospect"}
              </Button>
            </div>
          </div>

          <div className="grid gap-5">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_22px_55px_-38px_rgba(15,23,42,0.25)]">
              <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                <div className="flex gap-5">
                  <div className="inline-flex size-24 shrink-0 items-center justify-center rounded-[22px] bg-[linear-gradient(180deg,#f4f1ff_0%,#ecefff_100%)] text-4xl font-semibold tracking-tight text-blue-600">
                    {getInitials(lead.businessName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.45rem]">{lead.businessName}</h1>
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-sm font-semibold", getLeadStatusBadgeClass(lead.status))}>
                        {lead.status === "contacted" ? "Contacted" : "New"}
                      </Badge>
                      {lead.flagged ? (
                        <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                          Flagged
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-3 text-[15px] text-slate-700">
                      <div className="flex items-center gap-3">
                        <User className="size-4 text-slate-400" />
                        <span>{lead.contactName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="size-4 text-slate-400" />
                        <span>{lead.email ?? "No email on file"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="size-4 text-slate-400" />
                        <span>{lead.phone ?? "No phone on file"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-l border-slate-200 pl-0 xl:pl-8">
                  <div className="grid gap-5">
                    <div className="grid gap-2 sm:grid-cols-[110px_1fr] xl:grid-cols-[110px_1fr]">
                      <p className="text-sm font-semibold text-slate-500">Status</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-sm font-semibold", getLeadStatusBadgeClass(lead.status))}>
                          {lead.status === "contacted" ? "Contacted" : "Not contacted"}
                        </Badge>
                        {lead.flagged ? (
                          <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                            Flagged
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[110px_1fr] xl:grid-cols-[110px_1fr]">
                      <p className="text-sm font-semibold text-slate-500">Source</p>
                      <p className="text-sm font-semibold text-slate-900">{lead.source}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[110px_1fr] xl:grid-cols-[110px_1fr]">
                      <p className="text-sm font-semibold text-slate-500">Submitted</p>
                      <p className="text-sm font-semibold text-slate-900">{formatDateTime(lead.submittedAt)}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[110px_1fr] xl:grid-cols-[110px_1fr]">
                      <p className="text-sm font-semibold text-slate-500">Last Updated</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {lead.lastContactAt ? formatDateTime(lead.lastContactAt) : formatDateTime(lead.submittedAt)}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[110px_1fr] xl:grid-cols-[110px_1fr]">
                      <p className="text-sm font-semibold text-slate-500">Callback Pref.</p>
                      <p className="text-sm font-semibold text-slate-900">{formatOptional(lead.callbackPreference)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-slate-200 pt-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Lead Intake</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Submitted details</h2>
                  </div>
                  <p className="text-sm text-slate-500">Key intake answers are visible here first so you can triage the lead without scrolling.</p>
                </div>

                <div className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                  {primaryIntakeDetails.map((detail) => (
                    <div key={detail.label} className="border-b border-slate-100 pb-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{detail.label}</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{detail.value}</p>
                    </div>
                  ))}
                </div>

                {secondaryIntakeDetails.length > 0 ? (
                  <div className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
                    {secondaryIntakeDetails.map((detail) => (
                      <div key={detail.label} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{detail.label}</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{detail.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-[28px] border border-slate-200 bg-white shadow-[0_22px_55px_-38px_rgba(15,23,42,0.25)]">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Contact History</h2>
                  <p className="mt-1 text-sm text-slate-500">A cleaner view of submitted activity, outreach, and follow-up context.</p>
                </div>
                <Button
                  className="rounded-xl border border-blue-600 bg-blue-600 px-5 text-white shadow-[0_16px_40px_-20px_rgba(37,99,235,0.72)] hover:bg-blue-700"
                  onClick={() => openContactDialog("call")}
                >
                  <CheckCircle2 className="mr-2 size-4" />
                  Add Contact Attempt
                </Button>
              </div>

              <div className="px-6 py-3">
                <div className="relative">
                  <div className="absolute bottom-10 left-[1.05rem] top-10 w-px bg-slate-200" />
                  {timelineEvents.map((event) => (
                    <div
                      key={event.id}
                      className="grid gap-5 border-b border-slate-100 py-6 lg:grid-cols-[48px_108px_140px_120px_minmax(0,1fr)_160px_24px]"
                    >
                      <div className="relative">
                        <div className={cn("relative z-10 flex size-9 items-center justify-center rounded-full shadow-[0_0_0_4px_white]", getTimelineDotClass(event.tone))}>
                          {event.channel.toLowerCase().includes("email") ? (
                            <Mail className="size-4" />
                          ) : event.channel.toLowerCase().includes("call") ? (
                            <Phone className="size-4" />
                          ) : (
                            <Sparkles className="size-4" />
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        <div>{formatDate(event.timestamp)}</div>
                        <div className="mt-1 font-medium text-slate-500">{formatTime(event.timestamp)}</div>
                      </div>
                      <div className="text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">{event.actor}</div>
                        <div className="mt-1 text-slate-500">{event.channel}</div>
                      </div>
                      <div>
                        {event.badge ? (
                          <span className={cn("inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold", getTimelineBadgeClass(event.tone))}>{event.badge}</span>
                        ) : null}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{event.title}</div>
                        <p className="mt-2 text-sm leading-7 text-slate-500">{event.description}</p>
                      </div>
                      <div className="border-l border-slate-200 pl-4 text-sm text-slate-500">
                        <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Recorded</p>
                        <p className="mt-2 font-semibold text-slate-900">{formatDateTime(event.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="grid gap-5">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_22px_55px_-38px_rgba(15,23,42,0.25)]">
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">Lead Notes</h3>
                <p className="mt-2 text-sm text-slate-500">Capture objections, pricing requests, urgency, or anything the next follow-up should know.</p>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-5 min-h-[120px] rounded-2xl border-slate-200 bg-slate-50/70"
                  placeholder="Add any additional context about this lead..."
                />
                <Button className="mt-4 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => updateLeadMutation.mutate({ notes })}>
                  Save Lead Notes
                </Button>
                {latestActivity ? (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Latest Contact</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {toTitleCase(latestActivity.contactMethod)} · {toTitleCase(latestActivity.result)}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-500">{latestActivity.summary}</p>
                  </div>
                ) : null}
              </section>
            </aside>
          </div>
        </div>
      </div>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl border-slate-200 bg-white p-0 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.4)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">Log Contact Attempt</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-500">
                Capture how you reached out and what happened so the lead record stays accurate.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-5 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Method of contact</label>
                <Select value={contactMethod} onValueChange={(value) => setContactMethod(value as (typeof CONTACT_METHOD_OPTIONS)[number]["value"])}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_METHOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Result</label>
                <Select value={contactResult} onValueChange={(value) => setContactResult(value as (typeof CONTACT_RESULT_OPTIONS)[number]["value"])}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_RESULT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Summary</label>
              <Textarea
                value={contactSummary}
                onChange={(event) => setContactSummary(event.target.value)}
                className="min-h-[140px] rounded-2xl border-slate-200 bg-slate-50"
                placeholder="What happened in the conversation or outreach?"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => setContactDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl border border-blue-600 bg-blue-600 text-white hover:bg-blue-700" onClick={submitContactLog}>
              Save Contact Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
