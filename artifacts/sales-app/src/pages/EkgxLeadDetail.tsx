import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Flag, Mail, Phone, UserPlus2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getEkgxLeadById, updateEkgxLead, type EkgxLead } from "@/lib/beta-persistence";
import { createCustomerRecord } from "@/lib/operations";
import { cn } from "@/lib/utils";

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

function getLeadStatusBadgeClass(status: EkgxLead["status"]) {
  return status === "contacted"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatOptional(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function LeadDetailSkeleton() {
  return (
    <AppLayout fluid>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-8">
        <Skeleton className="h-10 w-44" />
        <div className="rounded-[30px] border border-slate-200 bg-white p-8">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-4 h-10 w-80" />
          <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-[22px] border border-slate-200 bg-white p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-4 h-6 w-32" />
              <Skeleton className="mt-2 h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function DetailStat({
  label,
  value,
  description,
  tone = "default",
}: {
  label: string;
  value: string;
  description: string;
  tone?: "default" | "attention" | "success" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-[16px] border p-5 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.28)]",
        tone === "attention" && "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.98)_0%,rgba(255,247,214,0.92)_100%)]",
        tone === "success" && "border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.98)_0%,rgba(220,252,231,0.94)_100%)]",
        tone === "accent" && "border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,0.98)_0%,rgba(224,242,254,0.94)_100%)]",
        tone === "default" && "border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-3 text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
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
      toast({ title: "Converted to customer", description: "The EKGx lead is now a prospect record." });
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
        toast({ title: "Notes saved" });
      }
    },
    onError: (error: Error) =>
      toast({ title: "Unable to update lead", description: error.message, variant: "destructive" }),
  });

  const details = useMemo(() => {
    if (!lead) return [];
    return [
      { label: "Source", value: lead.source },
      { label: "Country", value: formatOptional(lead.country) },
      { label: "Job Title", value: formatOptional(lead.jobTitle) },
      { label: "Business Type", value: formatOptional(lead.businessType) },
      { label: "Purchase Timeline", value: formatOptional(lead.purchaseTimeline) },
      { label: "Locations", value: formatOptional(lead.locations) },
    ];
  }, [lead]);

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
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-6 px-4 pb-8">
        <Link href="/ekgx-leads">
          <Button variant="ghost" className="w-fit rounded-md px-3 text-slate-700 hover:bg-slate-100">
            <ArrowLeft className="mr-2 size-4" />
            Back to EKGx Leads
          </Button>
        </Link>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.22),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_18px_46px_-36px_rgba(15,23,42,0.28)]">
              <div className="border-b border-slate-200/80 px-6 py-5 md:px-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex max-w-4xl gap-4">
                    <div className="inline-flex size-16 shrink-0 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-lg font-semibold text-slate-700 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.2)]">
                      {lead.businessName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">EKGx Lead</p>
                      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.5rem]">{lead.businessName}</h1>
                      <p className="mt-2 text-lg font-medium text-slate-800">{lead.contactName}</p>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                        Review the submitted intake, capture follow-up context, and move this lead into the CRM once the opportunity is qualified.
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Badge variant="outline" className={getLeadStatusBadgeClass(lead.status)}>
                          {lead.status === "contacted" ? "Contacted" : "Not contacted"}
                        </Badge>
                        {lead.flagged ? (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Flagged</Badge>
                        ) : null}
                        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">{lead.source}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:w-[300px] lg:grid-cols-1">
                    <Button
                      variant="outline"
                      className="h-11 justify-center rounded-md border-slate-200 bg-white"
                      onClick={() => {
                        updateLeadMutation.mutate(
                          { flagged: !lead.flagged },
                          {
                            onSuccess: () => {
                              toast({ title: lead.flagged ? "Flag removed" : "Lead flagged" });
                            },
                          },
                        );
                      }}
                    >
                      <Flag className="mr-2 size-4" />
                      {lead.flagged ? "Remove Flag" : "Flag Lead"}
                    </Button>
                    <Button
                      className="h-11 justify-center rounded-md"
                      onClick={() => convertMutation.mutate()}
                      disabled={convertMutation.isPending}
                    >
                      <UserPlus2 className="mr-2 size-4" />
                      {convertMutation.isPending ? "Converting..." : "Convert to Customer"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4 md:px-8">
                <DetailStat
                  label="Submitted"
                  value={formatDate(lead.submittedAt)}
                  description={formatDateTime(lead.submittedAt)}
                  tone="default"
                />
                <DetailStat
                  label="Last Contact"
                  value={lead.lastContactAt ? formatDate(lead.lastContactAt) : "No outreach yet"}
                  description={lead.lastContactSummary || "Nothing has been logged for this lead yet."}
                  tone={lead.lastContactAt ? "success" : "attention"}
                />
                <DetailStat
                  label="Purchase Timeline"
                  value={formatOptional(lead.purchaseTimeline)}
                  description="Submitted by the lead during intake."
                  tone="accent"
                />
                <DetailStat
                  label="Callback Preference"
                  value={formatOptional(lead.callbackPreference)}
                  description="Best timing or callback note from the form."
                  tone="default"
                />
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <Card className="rounded-[16px] border border-slate-200 bg-white shadow-[0_14px_36px_-28px_rgba(15,23,42,0.22)]">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-xl text-slate-950">Intake Details</CardTitle>
                  <p className="text-sm text-slate-500">The original information submitted with the lead.</p>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {details.map((detail) => (
                    <div
                      key={detail.label}
                      className="rounded-[12px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-4"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{detail.label}</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{detail.value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-[16px] border border-slate-200 bg-white shadow-[0_14px_36px_-28px_rgba(15,23,42,0.22)]">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-xl text-slate-950">Contact Record</CardTitle>
                  <p className="text-sm text-slate-500">Direct ways to reach the lead and confirm submission context.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Email</p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                      <Mail className="size-4 text-slate-500" />
                      {lead.email ?? "No email on this lead"}
                    </div>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Phone</p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                      <Phone className="size-4 text-slate-500" />
                      {lead.phone ?? "No phone on this lead"}
                    </div>
                  </div>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Submission</p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                      <CalendarClock className="size-4 text-slate-500" />
                      {formatDateTime(lead.submittedAt)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <Card className="rounded-[16px] border border-slate-200 bg-white shadow-[0_14px_36px_-28px_rgba(15,23,42,0.22)]">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-xl text-slate-950">Notes</CardTitle>
                  <p className="text-sm text-slate-500">Capture pricing questions, objections, urgency, and any extra context for the next follow-up.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="min-h-52 rounded-[10px] border-slate-200 bg-slate-50"
                    placeholder="Capture context, objections, urgency, or anything else helpful for follow-up."
                  />
                  <Button
                    className="rounded-md"
                    onClick={() => {
                      updateLeadMutation.mutate({ notes });
                    }}
                  >
                    Save Notes
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-[16px] border border-slate-200 bg-white shadow-[0_14px_36px_-28px_rgba(15,23,42,0.22)]">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-xl text-slate-950">Outreach</CardTitle>
                  <p className="text-sm text-slate-500">Log the latest touchpoint and keep the lead status current.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Last Contact Note</p>
                    <p className="mt-2 text-sm text-slate-900">{lead.lastContactSummary || "No outreach logged yet."}</p>
                  </div>
                  <Input
                    value={contactSummary}
                    onChange={(event) => setContactSummary(event.target.value)}
                    placeholder="What happened in the last outreach?"
                    className="h-12 rounded-[10px] border-slate-200 bg-slate-50"
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      className="rounded-md"
                      onClick={() => {
                        const summary = contactSummary.trim();
                        if (!summary) {
                          toast({ title: "Add a short contact summary first", variant: "destructive" });
                          return;
                        }
                        updateLeadMutation.mutate(
                          {
                            status: "contacted",
                            lastContactAt: new Date().toISOString(),
                            lastContactSummary: summary,
                          },
                          {
                            onSuccess: () => {
                              setContactSummary("");
                              toast({ title: "Contact logged" });
                            },
                          },
                        );
                      }}
                    >
                      Mark Contacted
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-md bg-white"
                      onClick={() => {
                        updateLeadMutation.mutate(
                          {
                            status: "not_contacted",
                            lastContactAt: null,
                            lastContactSummary: null,
                          },
                          {
                            onSuccess: () => {
                              setContactSummary("");
                              toast({ title: "Lead reset to not contacted" });
                            },
                          },
                        );
                      }}
                    >
                      Mark Not Contacted
                    </Button>
                  </div>
                  <p className="text-sm text-slate-500">
                    Status, last contact time, and the latest summary are updated together when you log outreach here.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Card className="rounded-[16px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_14px_36px_-28px_rgba(15,23,42,0.22)]">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-xl text-slate-950">Lead Snapshot</CardTitle>
                <p className="text-sm text-slate-500">A quick read before you decide the next step.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[12px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Company</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{lead.businessName}</p>
                </div>
                <div className="rounded-[12px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Primary Contact</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{lead.contactName}</p>
                </div>
                <div className="rounded-[12px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current Status</p>
                  <div className="mt-2">
                    <Badge variant="outline" className={getLeadStatusBadgeClass(lead.status)}>
                      {lead.status === "contacted" ? "Contacted" : "Not contacted"}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-[12px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Submitted From</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{lead.source}</p>
                </div>
                <div className="rounded-[12px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Next Best Use</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {lead.lastContactAt
                      ? "Review the latest outreach note and decide whether this should convert into a prospect."
                      : "Use the intake details below to make first contact and capture the first outreach note."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
