import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock3,
  EyeOff,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  clearCompletedWorkspaceActionPoints,
  createWorkspaceActionPoint,
  updateWorkspaceActionPoint,
  useWorkspaceActionPoints,
  type WorkspaceActionPoint,
} from "@/lib/beta-persistence";
import {
  createCollaborationTask,
  updateCollaborationTask,
  useCollaborationTasks,
  type CollaborativeTask,
} from "@/lib/collaboration";
import {
  createCustomerActivity,
  deleteCustomer,
  getCustomers,
  getSalesReps,
  type CustomerListItem,
  type SalesRepOption,
} from "@/lib/customer-crm";
import {
  listOpportunities,
  formatOpportunityStatus,
  type SalesOpportunity,
  updateOpportunity,
} from "@/lib/opportunities";
import { cn } from "@/lib/utils";
type TodoTask = CollaborativeTask;

type OpportunityActionType =
  | "call"
  | "email"
  | "meeting"
  | "follow_up"
  | "other";

type OpportunityContactMeta = {
  actionType: OpportunityActionType;
  actionLabel: string;
  salesRepId: number | null;
  salesRepName: string;
  details: string | null;
  createdAt: string;
  activityId: number | null;
  subject: string;
};

const CONTACT_LOG_NOTE_PREFIX = "contact-log:";
const DASHBOARD_SNOOZE_STORAGE_KEY = "sales-app.workspace-dashboard-snoozes";
const DASHBOARD_SNOOZE_UPDATED_EVENT = "sales-app:workspace-dashboard-snoozes-updated";
const OPPORTUNITY_ACTION_OPTIONS = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Schedule a Meeting" },
  { value: "follow_up", label: "Follow Up" },
  { value: "other", label: "Other" },
] as const;

type DashboardSnoozeMap = Record<string, string>;

type PipelineItem = {
  key: string;
  kind: "opportunity" | "prospect";
  customerId: number;
  title: string;
  subtitle: string;
  companyName: string;
  contactName: string;
  statusLabel: string;
  statusClassName: string;
  lastContactLabel: string;
  lastContactNote: string | null;
  lastContactMeta: OpportunityContactMeta | null;
  detail: string;
  snoozedUntil: string | null;
  opportunity?: SalesOpportunity;
};

type SnoozeTarget = Pick<PipelineItem, "key" | "kind" | "title" | "companyName">;

function getStageLabel(customer: CustomerListItem) {
  if (customer.email && customer.phone) {
    return "Interested";
  }

  if (customer.email || customer.phone) {
    return "Needs follow-up";
  }

  return "New lead";
}

function getOpportunityStatusClasses(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized.includes("likely") || normalized.includes("close")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized.includes("negotiat") || normalized.includes("interested")) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (normalized.includes("quote") || normalized.includes("new lead")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
}

function formatLastContacted(value: string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Never";
  }

  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatContactTimestamp(value: string | null) {
  if (!value) {
    return "No timestamp";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No timestamp";
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

function getActionLabel(actionType: OpportunityActionType) {
  return OPPORTUNITY_ACTION_OPTIONS.find((option) => option.value === actionType)?.label ?? "Other";
}

function serializeContactMeta(meta: OpportunityContactMeta) {
  return `${CONTACT_LOG_NOTE_PREFIX}${JSON.stringify(meta)}`;
}

function parseContactMeta(value: string | null) {
  if (!value || !value.startsWith(CONTACT_LOG_NOTE_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(value.slice(CONTACT_LOG_NOTE_PREFIX.length)) as OpportunityContactMeta;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.actionType !== "string" ||
      typeof parsed.actionLabel !== "string" ||
      typeof parsed.salesRepName !== "string" ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.subject !== "string"
    ) {
      return null;
    }

    return {
      actionType: parsed.actionType,
      actionLabel: parsed.actionLabel,
      salesRepId: typeof parsed.salesRepId === "number" ? parsed.salesRepId : null,
      salesRepName: parsed.salesRepName,
      details: typeof parsed.details === "string" ? parsed.details : null,
      createdAt: parsed.createdAt,
      activityId: typeof parsed.activityId === "number" ? parsed.activityId : null,
      subject: parsed.subject,
    } satisfies OpportunityContactMeta;
  } catch {
    return null;
  }
}

function getActivityTypeForAction(actionType: OpportunityActionType) {
  if (actionType === "call" || actionType === "email" || actionType === "meeting") {
    return actionType;
  }

  if (actionType === "follow_up") {
    return "task";
  }

  return "note";
}

function getOpportunitySubject(opportunity: SalesOpportunity, actionLabel: string) {
  return `${actionLabel} for ${opportunity.companyName}`;
}

function getDefaultSalesRepId(
  opportunity: SalesOpportunity | null,
  customers: CustomerListItem[],
  reps: SalesRepOption[],
) {
  if (opportunity) {
    const customer = customers.find((entry) => entry.id === opportunity.customerId);
    if (customer?.repId) {
      return String(customer.repId);
    }
  }

  return reps[0] ? String(reps[0].id) : "";
}

function getProspectOpportunity(customer: CustomerListItem) {
  if (customer.email && customer.phone) {
    return "Intro outreach and qualification";
  }

  if (customer.email || customer.phone) {
    return "Discovery follow-up";
  }

  return "New lead research";
}

function getLastContactLabel(customer: CustomerListItem) {
  if (customer.email && customer.phone) {
    return "This week";
  }

  if (customer.email || customer.phone) {
    return "Needs follow-up";
  }

  return "Never";
}

function getDueBadgeClasses(dueType: "today" | "tomorrow" | "upcoming" | "late") {
  if (dueType === "late") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (dueType === "today") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (dueType === "tomorrow") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-sky-200 bg-sky-50 text-sky-700";
}

function sortByCreatedAtDesc<T extends { createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function readDashboardSnoozes(): DashboardSnoozeMap {
  if (typeof window === "undefined") {
    return {};
  }

  const stored = window.localStorage.getItem(DASHBOARD_SNOOZE_STORAGE_KEY);
  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function saveDashboardSnoozes(snoozes: DashboardSnoozeMap) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DASHBOARD_SNOOZE_STORAGE_KEY, JSON.stringify(snoozes));
  window.dispatchEvent(new CustomEvent(DASHBOARD_SNOOZE_UPDATED_EVENT));
}

function formatActionDate(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getWorkspaceCustomerHref(customerId: number) {
  return `/customers/${customerId}?from=sales-hub`;
}

function getTodayDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function isSnoozedUntilFuture(dateValue: string | null, today: string) {
  return Boolean(dateValue && dateValue > today);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getDueMeta(dueDate: string | null) {
  const today = getTodayDateValue();
  if (!dueDate) {
    return { dueType: "upcoming" as const, dueLabel: "No due date" };
  }

  if (dueDate < today) {
    return { dueType: "late" as const, dueLabel: "Late" };
  }

  if (dueDate === today) {
    return { dueType: "today" as const, dueLabel: "Today" };
  }

  if (dueDate === addDays(today, 1)) {
    return { dueType: "tomorrow" as const, dueLabel: "Tomorrow" };
  }

  return { dueType: "upcoming" as const, dueLabel: "This week" };
}
function getLastContactSortValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export default function SalesWorkspace() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const customersQuery = useQuery({
    queryKey: ["customers-crm", "sales-workspace"],
    queryFn: () => getCustomers({}),
  });
  const salesRepsQuery = useQuery({
    queryKey: ["sales-reps"],
    queryFn: getSalesReps,
  });
  const opportunitiesQuery = useQuery({
    queryKey: ["opportunities"],
    queryFn: listOpportunities,
  });
  const tasksQuery = useCollaborationTasks();
  const actionPointsQuery = useWorkspaceActionPoints();
  const customers = customersQuery.data ?? [];
  const salesReps = salesRepsQuery.data ?? [];
  const opportunities = sortByCreatedAtDesc(opportunitiesQuery.data ?? []);
  const personalTasks = sortByCreatedAtDesc(tasksQuery.data ?? []);
  const actionPoints = sortByCreatedAtDesc(actionPointsQuery.data ?? []);
  const openOpportunities = useMemo(
    () =>
      opportunities
        .filter((opportunity) => opportunity.lifecycle === "open")
        .sort((left, right) => {
          const contactDelta = getLastContactSortValue(left.lastContactedAt) - getLastContactSortValue(right.lastContactedAt);
          if (contactDelta !== 0) {
            return contactDelta;
          }

          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        }),
    [opportunities],
  );
  const prospects = useMemo(
    () =>
      [...customers]
        .filter((customer) => customer.status === "prospect")
        .sort((left, right) => right.openOrders - left.openOrders),
    [customers],
  );
  const [actionPointView, setActionPointView] = useState<"open" | "completed">("open");
  const [taskView, setTaskView] = useState<"open" | "completed">("open");
  const [opportunityView, setOpportunityView] = useState<"open" | "snoozed">("open");
  const [prospectView, setProspectView] = useState<"open" | "snoozed">("open");
  const [actionPointOpen, setActionPointOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [contactLogOpen, setContactLogOpen] = useState(false);
  const [contactDetailOpen, setContactDetailOpen] = useState(false);
  const [dashboardSnoozes, setDashboardSnoozes] = useState<DashboardSnoozeMap>(() => readDashboardSnoozes());
  const [snoozeTarget, setSnoozeTarget] = useState<SnoozeTarget | null>(null);
  const [snoozeDate, setSnoozeDate] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState<SalesOpportunity | null>(null);
  const [selectedContactMeta, setSelectedContactMeta] = useState<{
    opportunity: SalesOpportunity;
    meta: OpportunityContactMeta;
  } | null>(null);
  const [newActionPoint, setNewActionPoint] = useState({
    title: "",
    details: "",
    customerId: "",
    dueDate: getTodayDateValue(),
  });
  const [newTask, setNewTask] = useState({
    title: "",
    notes: "",
    priority: "high" as TodoTask["priority"],
  });
  const [contactLogAction, setContactLogAction] = useState<OpportunityActionType>("call");
  const [contactLogSalesRepId, setContactLogSalesRepId] = useState("");
  const [contactLogDetails, setContactLogDetails] = useState("");
  const logOpportunityContactMutation = useMutation({
    mutationFn: async ({
      opportunity,
      actionType,
      salesRepId,
      details,
    }: {
      opportunity: SalesOpportunity;
      actionType: OpportunityActionType;
      salesRepId: string;
      details: string;
    }) => {
      const actionLabel = getActionLabel(actionType);
      const subject = getOpportunitySubject(opportunity, actionLabel);
      const salesRep = salesReps.find((rep) => String(rep.id) === salesRepId);
      if (!salesRep) {
        throw new Error("Select a sales rep before saving.");
      }

      const createdActivity = await createCustomerActivity(opportunity.customerId, {
        activityType: getActivityTypeForAction(actionType),
        subject,
        details: details.trim() || null,
        dueDate: null,
        outcome: null,
        createdBy: salesRep.name,
        isCompleted: false,
      });

      const meta: OpportunityContactMeta = {
        actionType,
        actionLabel,
        salesRepId: salesRep.id,
        salesRepName: salesRep.name,
        details: details.trim() || null,
        createdAt: createdActivity.createdAt,
        activityId: createdActivity.id,
        subject,
      };

      await updateOpportunity(opportunity.id, {
        status: actionLabel,
        lastContactedAt: createdActivity.createdAt,
        lastContactNote: serializeContactMeta(meta),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["customers-crm"] }),
      ]);
      setContactLogOpen(false);
      setSelectedOpportunity(null);
      setContactLogAction("call");
      setContactLogSalesRepId("");
      setContactLogDetails("");
      toast({ title: "Contact logged", description: "The activity, status, and last contacted fields were updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to log contact", description: error.message, variant: "destructive" });
    },
  });

  const toggleActionPointMutation = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      updateWorkspaceActionPoint(id, completed),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "action-points"] });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to update action point", description: error.message, variant: "destructive" }),
  });

  const clearCompletedActionPointsMutation = useMutation({
    mutationFn: clearCompletedWorkspaceActionPoints,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "action-points"] });
      toast({ title: "Completed action points cleared" });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to clear action points", description: error.message, variant: "destructive" }),
  });

  const createActionPointMutation = useMutation({
    mutationFn: createWorkspaceActionPoint,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "action-points"] });
      setNewActionPoint({
        title: "",
        details: "",
        customerId: "",
        dueDate: getTodayDateValue(),
      });
      setActionPointOpen(false);
      toast({ title: "Action point added" });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to add action point", description: error.message, variant: "destructive" }),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      updateCollaborationTask(id, completed),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collaboration", "tasks"] });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to update task", description: error.message, variant: "destructive" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: createCollaborationTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collaboration", "tasks"] });
      setNewTask({
        title: "",
        notes: "",
        priority: "high",
      });
      setTaskOpen(false);
      toast({ title: "Task added" });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to add task", description: error.message, variant: "destructive" }),
  });

  const deleteProspectMutation = useMutation({
    mutationFn: (customerId: number) => deleteCustomer(customerId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers-crm", "sales-workspace"] }),
        queryClient.invalidateQueries({ queryKey: ["customers-crm"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
      ]);
      toast({ title: "Prospect deleted" });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to delete prospect", description: error.message, variant: "destructive" }),
  });

  const openActionPoints = actionPoints.filter((item) => !item.completed);
  const completedActionPoints = actionPoints.filter((item) => item.completed);
  const openTasks = personalTasks.filter((task) => !task.completed);
  const completedTasks = personalTasks.filter((task) => task.completed);
  const todayDateValue = getTodayDateValue();
  const opportunityItems = useMemo<PipelineItem[]>(
    () =>
      openOpportunities.map((opportunity) => {
        const lastContactMeta = parseContactMeta(opportunity.lastContactNote);
        return {
          key: `opportunity:${opportunity.id}`,
          kind: "opportunity",
          customerId: opportunity.customerId,
          title: opportunity.customerName,
          subtitle: opportunity.title,
          companyName: opportunity.companyName,
          contactName: opportunity.contactName,
          statusLabel: formatOpportunityStatus(opportunity.status),
          statusClassName: getOpportunityStatusClasses(opportunity.status),
          lastContactLabel: lastContactMeta
            ? `${lastContactMeta.actionLabel} - ${getFirstName(lastContactMeta.salesRepName)}`
            : formatLastContacted(opportunity.lastContactedAt),
          lastContactNote: lastContactMeta
            ? formatContactTimestamp(lastContactMeta.createdAt)
            : null,
          lastContactMeta,
          detail: opportunity.notes ?? "",
          snoozedUntil: dashboardSnoozes[`opportunity:${opportunity.id}`] ?? null,
          opportunity,
        };
      }),
    [dashboardSnoozes, openOpportunities],
  );
  const prospectItems = useMemo<PipelineItem[]>(
    () =>
      prospects.map((customer) => {
        const label = getStageLabel(customer);
        return {
          key: `prospect:${customer.id}`,
          kind: "prospect",
          customerId: customer.id,
          title: customer.name,
          subtitle: getProspectOpportunity(customer),
          companyName: customer.companyName,
          contactName: customer.primaryContact,
          statusLabel: label,
          statusClassName: getOpportunityStatusClasses(label),
          lastContactLabel: getLastContactLabel(customer),
          lastContactNote:
            customer.email || customer.phone
              ? [customer.email, customer.phone].filter(Boolean).join(" • ")
              : "No contact details captured yet",
          lastContactMeta: null,
          detail: "",
          snoozedUntil: dashboardSnoozes[`prospect:${customer.id}`] ?? null,
        };
      }),
    [dashboardSnoozes, prospects],
  );
  const activeOpportunityItems = useMemo(
    () => opportunityItems.filter((item) => !isSnoozedUntilFuture(item.snoozedUntil, todayDateValue)),
    [opportunityItems, todayDateValue],
  );
  const snoozedOpportunityItems = useMemo(
    () =>
      opportunityItems
        .filter((item) => isSnoozedUntilFuture(item.snoozedUntil, todayDateValue))
        .sort((left, right) =>
          left.snoozedUntil && right.snoozedUntil ? left.snoozedUntil.localeCompare(right.snoozedUntil) : 0,
        ),
    [opportunityItems, todayDateValue],
  );
  const activeProspectItems = useMemo(
    () => prospectItems.filter((item) => !isSnoozedUntilFuture(item.snoozedUntil, todayDateValue)),
    [prospectItems, todayDateValue],
  );
  const snoozedProspectItems = useMemo(
    () =>
      prospectItems
        .filter((item) => isSnoozedUntilFuture(item.snoozedUntil, todayDateValue))
        .sort((left, right) =>
          left.snoozedUntil && right.snoozedUntil ? left.snoozedUntil.localeCompare(right.snoozedUntil) : 0,
        ),
    [prospectItems, todayDateValue],
  );
  const dashboardMetrics = {
    dueToday: openActionPoints.filter((item) => getDueMeta(item.dueDate).dueType === "today").length,
  };

  function handleToggleActionPoint(id: number) {
    const actionPoint = actionPoints.find((item) => item.id === id);
    if (!actionPoint) return;
    toggleActionPointMutation.mutate({ id, completed: !actionPoint.completed });
  }

  function handleClearCompletedActionPoints() {
    clearCompletedActionPointsMutation.mutate();
  }

  function handleToggleTask(id: number) {
    const task = personalTasks.find((entry) => entry.id === id);
    if (!task) return;
    toggleTaskMutation.mutate({ id, completed: !task.completed });
  }

  function handleCreateActionPoint() {
    const title = newActionPoint.title.trim();
    const customerId = Number(newActionPoint.customerId);
    if (!title || !customerId) {
      return;
    }

    const customer = customers.find((entry) => entry.id === customerId);
    if (!customer) {
      return;
    }

    createActionPointMutation.mutate({
      customerId,
      title,
      details: newActionPoint.details.trim(),
      dueDate: newActionPoint.dueDate || null,
    });
  }

  function handleCreateTask() {
    const title = newTask.title.trim();
    if (!title) {
      return;
    }

    createTaskMutation.mutate({
      title,
      notes: newTask.notes.trim() || null,
      priority: newTask.priority,
      category: "Follow-up",
    });
  }

  function handleChooseOpportunityAction(opportunity: SalesOpportunity, action: OpportunityActionType) {
    setSelectedOpportunity(opportunity);
    setContactLogAction(action);
    setContactLogSalesRepId(getDefaultSalesRepId(opportunity, customers, salesReps));
    setContactLogDetails("");
    setContactLogOpen(true);
  }

  function handleOpenSnoozeDialog(item: PipelineItem) {
    setSnoozeTarget({
      key: item.key,
      kind: item.kind,
      title: item.title,
      companyName: item.companyName,
    });
    setSnoozeDate(item.snoozedUntil ?? todayDateValue);
  }

  function handleSaveSnooze() {
    if (!snoozeTarget || !snoozeDate) {
      return;
    }

    const next = {
      ...dashboardSnoozes,
      [snoozeTarget.key]: snoozeDate,
    };
    setDashboardSnoozes(next);
    saveDashboardSnoozes(next);
    setSnoozeTarget(null);
    setSnoozeDate("");
  }

  function handleUnsnooze(itemKey: string) {
    const next = { ...dashboardSnoozes };
    delete next[itemKey];
    setDashboardSnoozes(next);
    saveDashboardSnoozes(next);
  }

  function handleLogContact() {
    if (!selectedOpportunity) {
      return;
    }

    if (!contactLogSalesRepId) {
      return;
    }

    logOpportunityContactMutation.mutate({
      opportunity: selectedOpportunity,
      actionType: contactLogAction,
      salesRepId: contactLogSalesRepId,
      details: contactLogDetails,
    });
  }

  function handleOpenContactDetail(opportunity: SalesOpportunity, meta: OpportunityContactMeta) {
    setSelectedContactMeta({ opportunity, meta });
    setContactDetailOpen(true);
  }

  function handleOpenCustomerFromWorkspace(customerId: number) {
    navigate(getWorkspaceCustomerHref(customerId));
  }

  function handleDeleteProspect(item: PipelineItem) {
    if (item.kind !== "prospect") {
      return;
    }

    const confirmed = window.confirm(`Delete prospect "${item.companyName}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    deleteProspectMutation.mutate(item.customerId);
  }

  return (
    <AppLayout
      fluid
      scrollContent={false}
      headerContent={(
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
              Sales Workspace
            </Badge>
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 md:text-xl">
              Daily Command Center
            </h1>
          </div>
          <p className="mt-1 hidden max-w-3xl text-sm text-slate-600 lg:block">
            Work the pipeline from one queue, snooze anything that should disappear until a future date, and jump straight into the account when it is time to move.
          </p>
        </div>
      )}
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-2">
          <Card className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Open Opportunities</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">
                    Opportunities created from the Customer Hub.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                    {activeOpportunityItems.length} open
                  </Badge>
                  <Tabs value={opportunityView} onValueChange={(value) => setOpportunityView(value as "open" | "snoozed")}>
                    <TabsList className="h-9 rounded-xl bg-slate-100 p-1">
                      <TabsTrigger value="open" className="rounded-lg">Open</TabsTrigger>
                      <TabsTrigger value="snoozed" className="rounded-lg">Snoozed</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 overflow-y-auto p-0">
              {opportunityView === "open" ? activeOpportunityItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[840px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Company</th>
                        <th className="px-5 py-3 font-semibold">Contact</th>
                        <th className="px-5 py-3 font-semibold">Opportunity</th>
                        <th className="px-5 py-3 font-semibold">Last Contacted</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-4 py-2.5 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeOpportunityItems.map((item) => (
                        <tr key={item.key} className="group border-t border-slate-200 transition hover:bg-slate-50/80">
                          <td className="px-4 py-3">
                            <button type="button" className="text-left" onClick={() => handleOpenCustomerFromWorkspace(item.customerId)}>
                              <div className="font-semibold text-slate-950 transition group-hover:text-sky-800">{item.companyName}</div>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{item.contactName}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="font-medium text-sky-700">{item.subtitle}</div>
                            {item.detail ? <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{item.detail}</div> : null}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="min-w-[170px]">
                              <div className="font-medium text-slate-800">{item.lastContactLabel}</div>
                              {item.lastContactNote ? (
                                <div className="mt-0.5 text-xs text-slate-500">
                                  {item.lastContactNote}
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {item.opportunity && item.lastContactMeta ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-7 rounded-lg px-2 text-xs text-sky-700 hover:text-sky-800"
                                onClick={() => handleOpenContactDetail(item.opportunity!, item.lastContactMeta!)}
                              >
                                View
                              </Button>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-[210px] flex-col gap-1.5">
                              <Select
                                key={`${item.key}-${item.statusLabel}`}
                                onValueChange={(value: OpportunityActionType) => {
                                  if (item.opportunity) {
                                    handleChooseOpportunityAction(item.opportunity, value);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 rounded-xl bg-white text-xs">
                                  <SelectValue placeholder="Set status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {OPPORTUNITY_ACTION_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                className="h-8 justify-start rounded-xl px-3 text-xs text-slate-600 hover:text-sky-700"
                                onClick={() => handleOpenSnoozeDialog(item)}
                              >
                                <EyeOff className="mr-2 size-4" />
                                Snooze
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="m-5 rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  No open opportunities need attention right now.
                </div>
              ) : snoozedOpportunityItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <tbody>
                      {snoozedOpportunityItems.map((item) => (
                        <tr key={item.key} className="border-t border-slate-200 first:border-t-0">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-slate-950">{item.companyName}</div>
                            <div className="text-slate-500">{item.subtitle}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
                                Snoozed until {formatActionDate(item.snoozedUntil ?? "")}
                              </Badge>
                              <Button variant="ghost" className="h-8 rounded-xl px-3 text-xs text-slate-600 hover:text-sky-700" onClick={() => handleUnsnooze(item.key)}>
                                <RotateCcw className="mr-2 size-4" />
                                Unsnooze
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="m-5 rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  No snoozed opportunities right now.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Prospects</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">
                    Potential customers not yet converted into active accounts.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                    {activeProspectItems.length} prospects
                  </Badge>
                  <Tabs value={prospectView} onValueChange={(value) => setProspectView(value as "open" | "snoozed")}>
                    <TabsList className="h-9 rounded-xl bg-slate-100 p-1">
                      <TabsTrigger value="open" className="rounded-lg">Open</TabsTrigger>
                      <TabsTrigger value="snoozed" className="rounded-lg">Snoozed</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 overflow-y-auto p-0">
              {prospectView === "open" ? activeProspectItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Company</th>
                        <th className="px-4 py-2.5 font-semibold">Contact</th>
                        <th className="px-4 py-2.5 font-semibold">Opportunity</th>
                        <th className="px-4 py-2.5 font-semibold">Last Contact</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeProspectItems.map((item) => (
                        <tr key={item.key} className="group border-t border-slate-200 transition hover:bg-slate-50/80">
                          <td className="px-4 py-3">
                            <button type="button" className="text-left" onClick={() => handleOpenCustomerFromWorkspace(item.customerId)}>
                              <div className="font-semibold text-slate-950 transition group-hover:text-sky-800">{item.companyName}</div>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{item.contactName}</td>
                          <td className="px-4 py-3 text-slate-700">{item.subtitle}</td>
                          <td className="px-4 py-3 text-slate-700">{item.lastContactLabel}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn("border", item.statusClassName)}>
                              {item.statusLabel}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-[180px] gap-2">
                              <Button
                                variant="outline"
                                className="h-8 rounded-xl px-3 text-xs"
                                onClick={() => handleOpenCustomerFromWorkspace(item.customerId)}
                              >
                                Open
                              </Button>
                              <Button
                                variant="ghost"
                                className="h-8 rounded-xl px-3 text-xs text-rose-600 hover:text-rose-700"
                                onClick={() => handleDeleteProspect(item)}
                                disabled={deleteProspectMutation.isPending}
                              >
                                Delete
                              </Button>
                              <Button
                                variant="ghost"
                                className="h-8 rounded-xl px-3 text-xs text-slate-600 hover:text-sky-700"
                                onClick={() => handleOpenSnoozeDialog(item)}
                              >
                                <EyeOff className="mr-2 size-4" />
                                Snooze
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="m-5 rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  No prospects need attention right now.
                </div>
              ) : snoozedProspectItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <tbody>
                      {snoozedProspectItems.map((item) => (
                        <tr key={item.key} className="border-t border-slate-200 first:border-t-0">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-slate-950">{item.companyName}</div>
                            <div className="text-slate-500">{item.subtitle}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
                                Snoozed until {formatActionDate(item.snoozedUntil ?? "")}
                              </Badge>
                              <Button variant="ghost" className="h-8 rounded-xl px-3 text-xs text-slate-600 hover:text-sky-700" onClick={() => handleUnsnooze(item.key)}>
                                <RotateCcw className="mr-2 size-4" />
                                Unsnooze
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="m-5 rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  No snoozed prospects right now.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col rounded-[1.6rem] border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200 bg-slate-50/70">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Action Points</CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      {dashboardMetrics.dueToday} due today
                    </Badge>
                    <Tabs value={actionPointView} onValueChange={(value) => setActionPointView(value as "open" | "completed")}>
                      <TabsList className="h-9 rounded-xl bg-slate-100 p-1">
                        <TabsTrigger value="open" className="rounded-lg">Open</TabsTrigger>
                        <TabsTrigger value="completed" className="rounded-lg">Completed</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button className="rounded-xl bg-sky-600 hover:bg-sky-700" onClick={() => setActionPointOpen(true)}>
                      <Plus className="mr-2 size-4" />
                      Add action point
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 space-y-2 overflow-y-auto p-4">
                {actionPointView === "open" ? (
                  openActionPoints.length > 0 ? (
                    openActionPoints.map((item) => {
                      const dueMeta = getDueMeta(item.dueDate);
                      return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-[1.15rem] border p-3 transition",
                          item.completed
                            ? "border-slate-200 bg-slate-50/80"
                            : "border-slate-200 bg-white hover:border-sky-200",
                        )}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                className="mt-0.5 text-slate-400 hover:text-sky-600"
                                onClick={() => handleToggleActionPoint(item.id)}
                                aria-label={item.completed ? `Reopen ${item.title}` : `Mark ${item.title} done`}
                              >
                                {item.completed ? (
                                  <CheckCircle2 className="size-5 text-emerald-600" />
                                ) : (
                                  <Circle className="size-5" />
                                )}
                              </button>
                              <div className="min-w-0">
                                <div
                                  className={cn(
                                    "font-semibold text-slate-950",
                                    item.completed && "text-slate-500 line-through",
                                  )}
                                >
                                  {item.title}
                                </div>
                                <div className="mt-1 text-sm text-slate-500">
                                  Related customer:{" "}
                                  <button
                                    type="button"
                                    className="cursor-pointer font-medium text-sky-700 transition hover:-translate-y-0.5 hover:text-sky-800"
                                    onClick={() => handleOpenCustomerFromWorkspace(item.customerId)}
                                  >
                                    {item.customerName}
                                  </button>
                                </div>
                                {item.details ? <p className="mt-2 text-xs leading-5 text-slate-600">{item.details}</p> : null}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Badge variant="outline" className={getDueBadgeClasses(dueMeta.dueType)}>
                              <Clock3 className="mr-1 size-3.5" />
                              {dueMeta.dueLabel}
                            </Badge>
                            <Button
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => handleOpenCustomerFromWorkspace(item.customerId)}
                            >
                              Open customer
                              <ArrowUpRight className="ml-2 size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                      No open action points right now. Use the add action point button to create one tied to a customer.
                    </div>
                  )
                ) : completedActionPoints.length > 0 ? (
                  <>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 rounded-xl text-xs text-slate-600 hover:text-rose-700"
                        onClick={handleClearCompletedActionPoints}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Clear completed
                      </Button>
                    </div>
                    {completedActionPoints.map((item) => {
                      const dueMeta = getDueMeta(item.dueDate);
                      return (
                      <div key={item.id} className="rounded-[1.15rem] border border-slate-200 bg-white p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                className="mt-0.5 text-slate-400 hover:text-sky-600"
                                onClick={() => handleToggleActionPoint(item.id)}
                                aria-label={`Reopen ${item.title}`}
                              >
                                <CheckCircle2 className="size-5 text-emerald-600" />
                              </button>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-500 line-through">{item.title}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                  Related customer:{" "}
                                  <button
                                    type="button"
                                    className="cursor-pointer font-medium text-sky-700 transition hover:-translate-y-0.5 hover:text-sky-800"
                                    onClick={() => handleOpenCustomerFromWorkspace(item.customerId)}
                                  >
                                    {item.customerName}
                                  </button>
                                </div>
                                {item.details ? <p className="mt-2 text-xs leading-5 text-slate-600">{item.details}</p> : null}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Badge variant="outline" className={getDueBadgeClasses(dueMeta.dueType)}>
                              <Clock3 className="mr-1 size-3.5" />
                              {dueMeta.dueLabel}
                            </Badge>
                            <Button
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => handleOpenCustomerFromWorkspace(item.customerId)}
                            >
                              Open customer
                              <ArrowUpRight className="ml-2 size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    No completed action points yet.
                  </div>
                )}
              </CardContent>
            </Card>

          <Card className="flex min-h-0 flex-col rounded-[1.6rem] border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Tasks</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">
                    General to-dos that do not need to be attached to a customer.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    {openTasks.length} open
                  </Badge>
                  <Tabs value={taskView} onValueChange={(value) => setTaskView(value as "open" | "completed")}>
                    <TabsList className="h-9 rounded-xl bg-slate-100 p-1">
                      <TabsTrigger value="open" className="rounded-lg">Open</TabsTrigger>
                      <TabsTrigger value="completed" className="rounded-lg">Completed</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button variant="outline" className="rounded-xl" onClick={() => setTaskOpen(true)}>
                    <Plus className="mr-2 size-4" />
                    Add task
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 space-y-2 overflow-y-auto p-4">
              {(taskView === "open" ? openTasks : completedTasks).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => handleToggleTask(task.id)}
                  className="flex w-full items-start gap-3 rounded-[1.15rem] border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-200"
                >
                  <span className="mt-0.5">
                    {task.completed ? (
                      <CheckCircle2 className="size-5 text-emerald-600" />
                    ) : (
                      <Circle className="size-5 text-slate-400" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "font-semibold text-slate-950",
                        task.completed && "text-slate-500 line-through",
                      )}
                    >
                      {task.title}
                    </div>
                    {task.notes ? (
                      <p className="mt-1 text-xs leading-5 text-slate-600">{task.notes}</p>
                    ) : null}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0",
                      task.priority === "high"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : task.priority === "low"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700",
                    )}
                  >
                    {task.completed ? "Done" : "Mark as done"}
                  </Badge>
                </button>
              ))}
              {(taskView === "open" ? openTasks : completedTasks).length === 0 ? (
                <div className="rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  {taskView === "open" ? "No open tasks right now." : "No completed tasks yet."}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Dialog open={actionPointOpen} onOpenChange={setActionPointOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add action point</DialogTitle>
              <DialogDescription>
                Create a follow-up tied to a customer so the rep can jump straight into the account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Title</label>
                <Input
                  value={newActionPoint.title}
                  onChange={(event) => setNewActionPoint((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Call customer about quote approval"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Related customer</label>
                <Select
                  value={newActionPoint.customerId}
                  onValueChange={(value) => setNewActionPoint((current) => ({ ...current, customerId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Due date</label>
                <Input
                  type="date"
                  value={newActionPoint.dueDate}
                  onChange={(event) => setNewActionPoint((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Details</label>
                <Textarea
                  value={newActionPoint.details}
                  onChange={(event) => setNewActionPoint((current) => ({ ...current, details: event.target.value }))}
                  placeholder="Capture the exact follow-up so it is easy to finish and mark done."
                  className="min-h-24"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionPointOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateActionPoint}>Add action point</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add task</DialogTitle>
              <DialogDescription>
                Add a personal workspace task that can be marked done directly from the card.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Task title</label>
                <Input
                  value={newTask.title}
                  onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Upload the updated EKGx sell sheet"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Notes</label>
                <Textarea
                  value={newTask.notes}
                  onChange={(event) => setNewTask((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Optional context for the task."
                  className="min-h-24"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Priority</label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value: TodoTask["priority"]) =>
                    setNewTask((current) => ({ ...current, priority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTaskOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTask}>Add task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={contactLogOpen} onOpenChange={setContactLogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log contact</DialogTitle>
              <DialogDescription>
                Save one of the five contact actions, select the sales rep, and capture any details from the touchpoint.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-950">{selectedOpportunity?.customerName}</div>
                <div className="mt-1 text-sm text-slate-600">{selectedOpportunity?.title}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Action</label>
                <Select
                  value={contactLogAction}
                  onValueChange={(value: OpportunityActionType) => setContactLogAction(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_ACTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Sales rep</label>
                <Select value={contactLogSalesRepId} onValueChange={setContactLogSalesRepId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sales rep" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesReps.map((rep) => (
                      <SelectItem key={rep.id} value={String(rep.id)}>
                        {rep.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Details</label>
                <Textarea
                  value={contactLogDetails}
                  onChange={(event) => setContactLogDetails(event.target.value)}
                  placeholder="Use this like a notepad for what happened, what was said, and what needs to happen next."
                  className="min-h-28"
                />
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Last Contacted will update to {getActionLabel(contactLogAction)} • {formatContactTimestamp(new Date().toISOString())} •{" "}
                {salesReps.find((rep) => String(rep.id) === contactLogSalesRepId)?.name ?? "Selected rep"}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setContactLogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleLogContact} disabled={!contactLogSalesRepId || logOpportunityContactMutation.isPending}>
                Save contact
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={contactDetailOpen}
          onOpenChange={(open) => {
            setContactDetailOpen(open);
            if (!open) {
              setSelectedContactMeta(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Contact details</DialogTitle>
              <DialogDescription>
                Full details for the latest logged call, email, meeting, follow-up, or other activity.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-950">{selectedContactMeta?.opportunity.customerName}</div>
                <div className="mt-1 text-sm text-slate-600">{selectedContactMeta?.opportunity.title}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Method</div>
                  <div className="mt-1 font-medium text-slate-950">{selectedContactMeta?.meta.actionLabel ?? "N/A"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Sales rep</div>
                  <div className="mt-1 font-medium text-slate-950">{selectedContactMeta?.meta.salesRepName ?? "N/A"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Timestamp</div>
                  <div className="mt-1 font-medium text-slate-950">
                    {formatContactTimestamp(selectedContactMeta?.meta.createdAt ?? null)}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Notes</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedContactMeta?.meta.details ?? "No additional notes were captured for this activity."}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setContactDetailOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(snoozeTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setSnoozeTarget(null);
              setSnoozeDate("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Snooze dashboard item</DialogTitle>
              <DialogDescription>
                Hide this {snoozeTarget?.kind ?? "pipeline"} item from the Daily Command Center until the selected date. It will automatically reappear on that day.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-950">{snoozeTarget?.title}</div>
                <div className="mt-1 text-sm text-slate-600">{snoozeTarget?.companyName}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Show it again on</label>
                <Input type="date" value={snoozeDate} min={todayDateValue} onChange={(event) => setSnoozeDate(event.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSnoozeTarget(null);
                  setSnoozeDate("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveSnooze} disabled={!snoozeDate}>
                Save snooze
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
