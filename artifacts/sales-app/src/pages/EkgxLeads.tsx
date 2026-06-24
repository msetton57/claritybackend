import React, { useDeferredValue, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CalendarClock, ChevronRight, Flag, PhoneCall, Search, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEkgxLeads, type EkgxLead, type EkgxLeadStatus, type EkgxLeadView } from "@/lib/beta-persistence";
import { cn } from "@/lib/utils";

function formatLeadStatus(status: EkgxLeadStatus) {
  return status === "contacted" ? "Contacted" : "Not contacted";
}

function getLeadStatusBadgeClass(status: EkgxLeadStatus) {
  return status === "contacted"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
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

function formatOptional(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function hasLocations(lead: EkgxLead) {
  return Boolean(lead.locations && lead.locations.trim().length > 0);
}

function isRecentLead(value: string) {
  const submittedAt = new Date(value).getTime();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return submittedAt >= sevenDaysAgo;
}

function LeadTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[22px] border border-slate-200 bg-white p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-9 w-20" />
            <Skeleton className="mt-3 h-4 w-full" />
          </div>
        ))}
      </div>
      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 p-4 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((__, cellIndex) => (
                <Skeleton key={cellIndex} className="h-10 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QueueMetric({
  label,
  value,
  description,
  tone = "default",
}: {
  label: string;
  value: number;
  description: string;
  tone?: "default" | "attention" | "success" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]",
        tone === "attention" && "border-amber-200 bg-amber-50/60",
        tone === "success" && "border-emerald-200 bg-emerald-50/60",
        tone === "accent" && "border-sky-200 bg-sky-50/70",
        tone === "default" && "border-slate-200",
      )}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}

function LeadCard({ lead, onOpen }: { lead: EkgxLead; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_22px_48px_-34px_rgba(15,23,42,0.55)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-slate-950">{lead.businessName}</p>
            {lead.flagged ? <Flag className="size-4 shrink-0 fill-amber-500 text-amber-500" /> : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">{formatOptional(lead.country, lead.source)}</p>
        </div>
        <Badge variant="outline" className={getLeadStatusBadgeClass(lead.status)}>
          {formatLeadStatus(lead.status)}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contact</p>
          <p className="mt-2 text-sm font-medium text-slate-900">{lead.contactName}</p>
          <p className="mt-1 text-sm text-slate-600">{lead.email || lead.phone || "No direct contact info"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Intake</p>
          <p className="mt-2 text-sm text-slate-900">{formatOptional(lead.businessType)}</p>
          <p className="mt-1 text-sm text-slate-600">
            {formatOptional(lead.jobTitle)} • {formatOptional(lead.purchaseTimeline)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-4 text-slate-400" />
          {formatLeadDate(lead.submittedAt)} at {formatLeadTime(lead.submittedAt)}
        </span>
        {hasLocations(lead) ? (
          <span className="inline-flex items-center gap-1.5">
            <PhoneCall className="size-4 text-slate-400" />
            {lead.locations} locations
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm text-slate-500">{lead.lastContactSummary || "No outreach logged yet"}</span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-900">
          Open lead
          <ChevronRight className="size-4" />
        </span>
      </div>
    </button>
  );
}

export default function EkgxLeads() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [leadView, setLeadView] = useState<EkgxLeadView>("all");
  const deferredSearch = useDeferredValue(search.trim());
  const ekgxLeadsQuery = useEkgxLeads();
  const ekgxLeads = ekgxLeadsQuery.data ?? [];

  const leadCounts = useMemo(
    () =>
      ekgxLeads.reduce(
        (acc, lead) => {
          acc.all += 1;
          acc[lead.status] += 1;
          if (hasLocations(lead)) {
            acc.locationCount += 1;
          }
          if (isRecentLead(lead.submittedAt)) {
            acc.recent += 1;
          }
          return acc;
        },
        { all: 0, contacted: 0, not_contacted: 0, locationCount: 0, recent: 0 },
      ),
    [ekgxLeads],
  );

  const visibleLeads = useMemo(() => {
    const normalizedSearch = deferredSearch.toLowerCase();
    return [...ekgxLeads]
      .filter((lead) => (leadView === "all" ? true : lead.status === leadView))
      .filter((lead) => {
        if (!normalizedSearch) return true;
        return [
          lead.businessName,
          lead.contactName,
          lead.email ?? "",
          lead.phone ?? "",
          lead.country ?? "",
          lead.jobTitle ?? "",
          lead.businessType ?? "",
          lead.locations ?? "",
          lead.state ?? "",
          lead.role ?? "",
          lead.intendedUse ?? "",
          lead.purchaseTimeline ?? "",
          lead.callbackPreference ?? "",
          lead.lastContactSummary ?? "",
          lead.source,
        ].some((value) => value.toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime());
  }, [deferredSearch, ekgxLeads, leadView]);

  return (
    <AppLayout fluid>
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 pb-8">
        <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] px-6 py-6 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] md:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">EKGx Leads</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Lead Intake Queue</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Review incoming EKGx inquiries, see who still needs outreach, and open a lead for the full intake details and follow-up notes.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Visible leads</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{visibleLeads.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Needs outreach</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{leadCounts.not_contacted}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contacted</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{leadCounts.contacted}</p>
              </div>
            </div>
          </div>
        </section>

        {ekgxLeadsQuery.isLoading ? (
          <LeadTableSkeleton />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <QueueMetric label="Total" value={leadCounts.all} description="All EKGx inquiries currently in the queue." />
              <QueueMetric
                label="Awaiting Contact"
                value={leadCounts.not_contacted}
                description="Leads that still need first outreach logged."
                tone="attention"
              />
              <QueueMetric
                label="Locations Provided"
                value={leadCounts.locationCount}
                description="Leads that specified how many locations they operate."
                tone="accent"
              />
              <QueueMetric
                label="Submitted This Week"
                value={leadCounts.recent}
                description="New EKGx leads received within the last 7 days."
                tone="success"
              />
            </div>

            <Card className="overflow-hidden rounded-[28px] border border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
              <CardHeader className="border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">Working Queue</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Search by company, person, location, role, use case, timeline, or contact note.
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 xl:max-w-4xl xl:flex-row xl:items-center xl:justify-end">
                    <div className="relative min-w-[280px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by company, contact, country, job title, business type, or timeline"
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-9"
                      />
                    </div>
                    <Tabs value={leadView} onValueChange={(value) => setLeadView(value as EkgxLeadView)}>
                      <TabsList className="h-12 rounded-xl bg-slate-100 p-1">
                        <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
                        <TabsTrigger value="not_contacted" className="rounded-lg">Not Contacted</TabsTrigger>
                        <TabsTrigger value="contacted" className="rounded-lg">Contacted</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="bg-slate-50 p-4 md:p-5">
                {visibleLeads.length > 0 ? (
                  <>
                    <div className="grid gap-4 lg:hidden">
                      {visibleLeads.map((lead) => (
                        <LeadCard key={lead.id} lead={lead} onOpen={() => navigate(`/ekgx-leads/${lead.id}`)} />
                      ))}
                    </div>

                    <div className="hidden overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)] lg:block">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="border-slate-200 hover:bg-slate-50">
                            <TableHead className="min-w-[240px] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Business</TableHead>
                            <TableHead className="min-w-[220px] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Contact</TableHead>
                            <TableHead className="min-w-[280px] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Intake</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Submitted</TableHead>
                            <TableHead className="min-w-[220px] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Last Contact</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleLeads.map((lead) => (
                            <TableRow
                              key={lead.id}
                              className="cursor-pointer border-slate-200 hover:bg-slate-50/80"
                              onClick={() => navigate(`/ekgx-leads/${lead.id}`)}
                            >
                              <TableCell className="px-4 py-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex min-w-0 items-start gap-3">
                                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
                                      {lead.businessName.slice(0, 2).toUpperCase()}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <div className="truncate text-sm font-semibold text-slate-950">{lead.businessName}</div>
                                        {lead.flagged ? <Flag className="size-3.5 shrink-0 fill-amber-500 text-amber-500" /> : null}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-500">{formatOptional(lead.country, lead.source)}</div>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <div className="text-sm font-medium text-slate-900">{lead.contactName}</div>
                                <div className="mt-1 text-xs text-slate-500">{lead.email || lead.phone || "No direct contact info"}</div>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <div className="text-sm text-slate-900">{formatOptional(lead.businessType)}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {formatOptional(lead.jobTitle)} • {formatOptional(lead.purchaseTimeline)}
                                </div>
                                {hasLocations(lead) ? (
                                  <div className="mt-2 text-xs text-slate-500">{lead.locations} locations</div>
                                ) : null}
                              </TableCell>
                              <TableCell className="px-4 py-4 text-sm text-slate-900">
                                <div>{formatLeadDate(lead.submittedAt)}</div>
                                <div className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                                  <CalendarClock className="size-3.5" />
                                  {formatLeadTime(lead.submittedAt)}
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <div className="text-sm text-slate-900">
                                  {lead.lastContactAt ? formatLeadDate(lead.lastContactAt) : "No outreach logged"}
                                </div>
                                <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                                  {lead.lastContactSummary || "Open the lead to log the first touchpoint."}
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <Badge variant="outline" className={getLeadStatusBadgeClass(lead.status)}>
                                  {formatLeadStatus(lead.status)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <Empty className="rounded-[24px] border border-slate-200 bg-white py-16">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Users className="size-5" />
                      </EmptyMedia>
                      <EmptyTitle>No EKGx leads in this view</EmptyTitle>
                      <EmptyDescription>
                        Try a different search or switch between contacted and not contacted leads.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
