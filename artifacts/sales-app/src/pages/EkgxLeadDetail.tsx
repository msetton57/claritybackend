import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Flag, Mail, Phone, UserPlus2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getEkgxLeadById, updateEkgxLead, type EkgxLead } from "@/lib/beta-persistence";
import { createCustomerRecord } from "@/lib/operations";

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
      toast({ title: "Converted to customer", description: "The EKGX lead is now a prospect record." });
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
      { label: "Submitted", value: formatDateTime(lead.submittedAt) },
      { label: "Last Contact", value: formatDateTime(lead.lastContactAt) },
      { label: "Email", value: lead.email ?? "No email" },
      { label: "Phone", value: lead.phone ?? "No phone" },
    ];
  }, [lead]);

  if (!lead) {
    return (
      <AppLayout fluid>
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 pb-8">
          <Link href="/customers">
            <Button variant="ghost" className="w-fit text-slate-700">
              <ArrowLeft className="mr-2 size-4" />
              Back to Customers
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
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 pb-8">
        <Link href="/customers">
          <Button variant="ghost" className="w-fit text-slate-700">
            <ArrowLeft className="mr-2 size-4" />
            Back to Customers
          </Button>
        </Link>

        <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] px-6 py-6 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] md:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">EKGX Lead</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{lead.businessName}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Review the Facebook lead, keep notes current, log outreach, and convert the relationship into a customer record when it is qualified.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className={getLeadStatusBadgeClass(lead.status)}>
                  {lead.status === "contacted" ? "Contacted" : "Not contacted"}
                </Badge>
                {lead.flagged ? (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Flagged</Badge>
                ) : null}
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">{lead.source}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="bg-white"
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
                {lead.flagged ? "Unflag" : "Flag"}
              </Button>
              <Button onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
                <UserPlus2 className="mr-2 size-4" />
                {convertMutation.isPending ? "Converting..." : "Convert to Customer"}
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-[28px] border border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
            <CardHeader>
              <CardTitle>Lead Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {details.map((detail) => (
                <div key={detail.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{detail.label}</p>
                  <p className="mt-2 text-sm text-slate-900">{detail.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
            <CardHeader>
              <CardTitle>Quick Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Mail className="size-4 text-slate-500" />
                  {lead.email ?? "No email on this lead"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Phone className="size-4 text-slate-500" />
                  {lead.phone ?? "No phone on this lead"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <CalendarClock className="size-4 text-slate-500" />
                  Last contact: {formatDateTime(lead.lastContactAt)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-[28px] border border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-40"
                placeholder="Capture context, objections, urgency, or anything else helpful for follow-up."
              />
              <Button
                onClick={() => {
                  updateLeadMutation.mutate({ notes });
                }}
              >
                Save Notes
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
            <CardHeader>
              <CardTitle>Log Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={contactSummary}
                onChange={(event) => setContactSummary(event.target.value)}
                placeholder="What happened in the last outreach?"
              />
              <div className="flex flex-wrap gap-3">
                <Button
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
                  className="bg-white"
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
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Last Contact Note</p>
                <p className="mt-2 text-sm text-slate-900">{lead.lastContactSummary || "No outreach logged yet."}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
