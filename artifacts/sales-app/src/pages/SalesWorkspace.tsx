import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock3,
  Pencil,
  Plus,
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
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  clearCompletedCollaborationTasks,
  createCollaborationTask,
  updateCollaborationTask,
  useCollaborationTasks,
  type CollaborativeTask,
} from "@/lib/collaboration";
import {
  createCustomerActivity,
  getCustomers,
  getSalesReps,
  type CustomerListItem,
  type SalesRepOption,
} from "@/lib/customer-crm";
import { useCurrentUser } from "@/lib/users";
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
const PROSPECT_CONTACT_LOG_STORAGE_KEY = "sales-app.workspace-prospect-contact-log";
const OPPORTUNITY_ACTION_OPTIONS = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Schedule a Meeting" },
  { value: "follow_up", label: "Follow Up" },
  { value: "other", label: "Other" },
] as const;

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
  opportunity?: SalesOpportunity;
};

type UnifiedPipelineItem = PipelineItem;

type UnifiedWorkItem = {
  key: string;
  source: "action_point" | "task";
  id: number;
  title: string;
  details: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  relatedCustomerId: number | null;
  relatedCustomerName: string | null;
  relatedCustomerStatus: CustomerListItem["status"] | WorkspaceActionPoint["customerStatus"] | null;
  dueDate: string | null;
  priority: TodoTask["priority"] | null;
  createdByUserId: number | null;
};

type ContactLogTarget = {
  customerId: number;
  customerName: string;
  title: string;
  opportunity: SalesOpportunity | null;
  prospectKey?: string;
};

type ContactDetailTarget = {
  customerName: string;
  title: string;
  meta: OpportunityContactMeta;
};

type TaskDialogMode = "create" | "edit-task";

type TaskFormState = {
  title: string;
  notes: string;
  priority: TodoTask["priority"];
  customerId: string;
  dueDate: string;
};

function createEmptyTaskForm(): TaskFormState {
  return {
    title: "",
    notes: "",
    priority: "high",
    customerId: "",
    dueDate: "",
  };
}

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

function getPriorityBadgeClasses(priority: TodoTask["priority"] | null) {
  if (priority === "high") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (priority === "low") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getWorkSourceBadgeClasses(source: UnifiedWorkItem["source"]) {
  return source === "action_point"
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-violet-200 bg-violet-50 text-violet-700";
}

function getWorkSourceLabel(source: UnifiedWorkItem["source"]) {
  return source === "action_point" ? "Action point" : "Task";
}

function getActionPointAccountTypeLabel(status: CustomerListItem["status"] | WorkspaceActionPoint["customerStatus"]) {
  return status === "prospect" ? "Prospect" : "Customer";
}

function getActionPointAccountTypeBadgeClasses(status: CustomerListItem["status"] | WorkspaceActionPoint["customerStatus"]) {
  return status === "prospect"
    ? "border-violet-200 bg-violet-50 text-violet-700"
    : "border-sky-200 bg-sky-50 text-sky-700";
}

function sortByCreatedAtDesc<T extends { createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function readProspectContactLogMap(): Record<string, OpportunityContactMeta> {
  if (typeof window === "undefined") {
    return {};
  }

  const stored = window.localStorage.getItem(PROSPECT_CONTACT_LOG_STORAGE_KEY);
  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => {
          if (!value || typeof value !== "object") {
            return [key, null] as const;
          }

          return [key, parseContactMeta(serializeContactMeta(value as OpportunityContactMeta))] as const;
        })
        .filter((entry): entry is [string, OpportunityContactMeta] => Boolean(entry[1])),
    );
  } catch {
    return {};
  }
}

function saveProspectContactLogMap(contactLogMap: Record<string, OpportunityContactMeta>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PROSPECT_CONTACT_LOG_STORAGE_KEY, JSON.stringify(contactLogMap));
}

function getWorkspaceCustomerHref(customerId: number) {
  return `/customers/${customerId}?from=sales-hub`;
}

function getTodayDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
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
  const { data: currentUser } = useCurrentUser();
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
  const tasksQuery = useCollaborationTasks({ scope: "all" });
  const actionPointsQuery = useWorkspaceActionPoints({ scope: "all" });
  const customers = customersQuery.data ?? [];
  const salesReps = salesRepsQuery.data ?? [];
  const opportunities = sortByCreatedAtDesc(opportunitiesQuery.data ?? []);
  const visibleTasks = sortByCreatedAtDesc(tasksQuery.data ?? []);
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
  const [pipelineView, setPipelineView] = useState<"all" | "prospect" | "opportunity">("all");
  const [workView, setWorkView] = useState<"open" | "completed">("open");
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<TaskDialogMode>("create");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskTargetOpen, setTaskTargetOpen] = useState(false);
  const [contactLogOpen, setContactLogOpen] = useState(false);
  const [contactDetailOpen, setContactDetailOpen] = useState(false);
  const [prospectContactLogMap, setProspectContactLogMap] = useState<Record<string, OpportunityContactMeta>>(
    () => readProspectContactLogMap(),
  );
  const [contactLogTarget, setContactLogTarget] = useState<ContactLogTarget | null>(null);
  const [selectedContactDetail, setSelectedContactDetail] = useState<ContactDetailTarget | null>(null);
  const [newTask, setNewTask] = useState<TaskFormState>(() => createEmptyTaskForm());
  const [contactLogAction, setContactLogAction] = useState<OpportunityActionType>("call");
  const [contactLogSalesRepId, setContactLogSalesRepId] = useState("");
  const [contactLogDetails, setContactLogDetails] = useState("");
  const logOpportunityContactMutation = useMutation({
    mutationFn: async ({
      target,
      actionType,
      salesRepId,
      details,
    }: {
      target: ContactLogTarget;
      actionType: OpportunityActionType;
      salesRepId: string;
      details: string;
    }) => {
      const actionLabel = getActionLabel(actionType);
      const subject = target.opportunity
        ? getOpportunitySubject(target.opportunity, actionLabel)
        : `${actionLabel} for ${target.customerName}`;
      const salesRep = salesReps.find((rep) => String(rep.id) === salesRepId);
      if (!salesRep) {
        throw new Error("Select a sales rep before saving.");
      }

      const createdActivity = await createCustomerActivity(target.customerId, {
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

      if (target.opportunity) {
        await updateOpportunity(target.opportunity.id, {
          status: actionLabel,
          lastContactedAt: createdActivity.createdAt,
          lastContactNote: serializeContactMeta(meta),
        });
      } else if (target.prospectKey) {
        const next = {
          ...prospectContactLogMap,
          [target.prospectKey]: meta,
        };
        setProspectContactLogMap(next);
        saveProspectContactLogMap(next);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["customers-crm"] }),
      ]);
      setContactLogOpen(false);
      setContactLogTarget(null);
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

  const clearCompletedWorkItemsMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([clearCompletedWorkspaceActionPoints(), clearCompletedCollaborationTasks()]);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm", "action-points"] }),
        queryClient.invalidateQueries({ queryKey: ["collaboration", "tasks"] }),
      ]);
      toast({ title: "Completed work items cleared" });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to clear completed work", description: error.message, variant: "destructive" }),
  });

  function resetTaskComposer() {
    setNewTask(createEmptyTaskForm());
    setEditingTaskId(null);
    setTaskDialogMode("create");
    setTaskOpen(false);
    setTaskTargetOpen(false);
  }

  const createActionPointMutation = useMutation({
    mutationFn: createWorkspaceActionPoint,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "action-points"] });
      resetTaskComposer();
      toast({ title: "Action point added" });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to add action point", description: error.message, variant: "destructive" }),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      updateCollaborationTask(id, { completed }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collaboration", "tasks"] });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to update task", description: error.message, variant: "destructive" }),
  });

  const updateTaskDetailsMutation = useMutation({
    mutationFn: ({
      id,
      title,
      notes,
      priority,
      category,
    }: {
      id: number;
      title: string;
      notes: string | null;
      priority: TodoTask["priority"];
      category: TodoTask["category"];
    }) =>
      updateCollaborationTask(id, {
        title,
        notes,
        priority,
        category,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collaboration", "tasks"] });
      resetTaskComposer();
      toast({ title: "Task updated" });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to update task", description: error.message, variant: "destructive" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: createCollaborationTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collaboration", "tasks"] });
      resetTaskComposer();
      toast({ title: "Task added" });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to add task", description: error.message, variant: "destructive" }),
  });

  const actionPointTargets = useMemo(
    () =>
      [...customers].sort((left, right) => {
        if (left.status === "prospect" && right.status !== "prospect") return -1;
        if (left.status !== "prospect" && right.status === "prospect") return 1;
        return (left.companyName || left.name).localeCompare(right.companyName || right.name);
      }),
    [customers],
  );
  const selectedTaskTarget = actionPointTargets.find((entry) => String(entry.id) === newTask.customerId) ?? null;
  const openOpportunityCustomerIds = useMemo(
    () => new Set(openOpportunities.map((opportunity) => opportunity.customerId)),
    [openOpportunities],
  );
  const opportunityItems = useMemo<UnifiedPipelineItem[]>(
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
          opportunity,
        };
      }),
    [openOpportunities],
  );
  const prospectItems = useMemo<UnifiedPipelineItem[]>(
    () =>
      prospects
        .filter((customer) => !openOpportunityCustomerIds.has(customer.id))
        .map((customer) => {
        const lastContactMeta = prospectContactLogMap[`prospect:${customer.id}`] ?? null;
        const label = lastContactMeta ? lastContactMeta.actionLabel : getStageLabel(customer);
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
          lastContactLabel: lastContactMeta
            ? `${lastContactMeta.actionLabel} - ${getFirstName(lastContactMeta.salesRepName)}`
            : getLastContactLabel(customer),
          lastContactNote: lastContactMeta
            ? formatContactTimestamp(lastContactMeta.createdAt)
            : customer.email || customer.phone
              ? [customer.email, customer.phone].filter(Boolean).join(" • ")
              : "No contact details captured yet",
          lastContactMeta,
          detail: "",
        };
      }),
    [openOpportunityCustomerIds, prospectContactLogMap, prospects],
  );
  const pipelineItems = useMemo<UnifiedPipelineItem[]>(
    () =>
      [...opportunityItems, ...prospectItems].sort((left, right) => {
        const leftContact = getLastContactSortValue(left.lastContactMeta?.createdAt ?? left.opportunity?.lastContactedAt ?? null);
        const rightContact = getLastContactSortValue(right.lastContactMeta?.createdAt ?? right.opportunity?.lastContactedAt ?? null);
        if (leftContact !== rightContact) {
          return leftContact - rightContact;
        }

        return left.companyName.localeCompare(right.companyName);
      }),
    [opportunityItems, prospectItems],
  );
  const visiblePipelineItems = useMemo(
    () =>
      pipelineItems.filter((item) => {
        if (pipelineView === "all") return true;
        return item.kind === pipelineView;
      }),
    [pipelineItems, pipelineView],
  );
  const workItems = useMemo<UnifiedWorkItem[]>(
    () =>
      [...actionPoints.map((item) => ({
        key: `action-point:${item.id}`,
        source: "action_point" as const,
        id: item.id,
        title: item.title,
        details: item.details || null,
        completed: item.completed,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        relatedCustomerId: item.customerId,
        relatedCustomerName: item.customerName,
        relatedCustomerStatus: item.customerStatus,
        dueDate: item.dueDate,
        priority: null,
        createdByUserId: null,
      })), ...visibleTasks.map((task) => ({
        key: `task:${task.id}`,
        source: "task" as const,
        id: task.id,
        title: task.title,
        details: task.notes,
        completed: task.completed,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        relatedCustomerId: null,
        relatedCustomerName: null,
        relatedCustomerStatus: null,
        dueDate: null,
        priority: task.priority,
        createdByUserId: task.createdBy.id,
      }))].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [actionPoints, visibleTasks],
  );
  const filteredWorkItems = useMemo(
    () =>
      workItems.filter((item) => {
        if (item.completed !== (workView === "completed")) {
          return false;
        }

        return true;
      }),
    [workItems, workView],
  );
  const completedWorkItemCount = workItems.filter((item) => item.completed).length;
  const dashboardMetrics = {
    dueToday: workItems.filter((item) => !item.completed && item.dueDate && getDueMeta(item.dueDate).dueType === "today").length,
  };

  function handleToggleActionPoint(id: number) {
    const actionPoint = actionPoints.find((item) => item.id === id);
    if (!actionPoint) return;
    toggleActionPointMutation.mutate({ id, completed: !actionPoint.completed });
  }

  function handleOpenCreateTask() {
    setTaskDialogMode("create");
    setEditingTaskId(null);
    setNewTask(createEmptyTaskForm());
    setTaskTargetOpen(false);
    setTaskOpen(true);
  }

  function handleOpenEditTask(id: number) {
    const task = visibleTasks.find((entry) => entry.id === id);
    if (!task) return;

    setTaskDialogMode("edit-task");
    setEditingTaskId(task.id);
    setNewTask({
      title: task.title,
      notes: task.notes ?? "",
      priority: task.priority,
      customerId: "",
      dueDate: "",
    });
    setTaskTargetOpen(false);
    setTaskOpen(true);
  }

  function handleTaskDialogOpenChange(open: boolean) {
    setTaskOpen(open);
    if (!open) {
      resetTaskComposer();
    }
  }

  function handleClearCompletedWorkItems() {
    clearCompletedWorkItemsMutation.mutate();
  }

  function handleToggleTask(id: number) {
    const task = visibleTasks.find((entry) => entry.id === id);
    if (!task) return;
    toggleTaskMutation.mutate({ id, completed: !task.completed });
  }

  function handleCreateTask() {
    const title = newTask.title.trim();
    if (!title) {
      return;
    }

    if (taskDialogMode === "edit-task") {
      if (!editingTaskId) {
        return;
      }

      const task = visibleTasks.find((entry) => entry.id === editingTaskId);
      if (!task) {
        return;
      }

      updateTaskDetailsMutation.mutate({
        id: editingTaskId,
        title,
        notes: newTask.notes.trim() || null,
        priority: newTask.priority,
        category: task.category,
      });
      return;
    }

    const customerId = Number(newTask.customerId);
    if (customerId) {
      const customer = customers.find((entry) => entry.id === customerId);
      if (!customer) {
        return;
      }

      createActionPointMutation.mutate({
        customerId,
        title,
        details: newTask.notes.trim(),
        dueDate: newTask.dueDate || null,
      });
      return;
    }

    createTaskMutation.mutate({
      title,
      notes: newTask.notes.trim() || null,
      priority: newTask.priority,
      category: "Follow-up",
    });
  }

  function handleChoosePipelineAction(item: PipelineItem, action: OpportunityActionType) {
    setContactLogTarget({
      customerId: item.customerId,
      customerName: item.companyName,
      title: item.subtitle,
      opportunity: item.opportunity ?? null,
      prospectKey: item.kind === "prospect" ? item.key : undefined,
    });
    setContactLogAction(action);
    setContactLogSalesRepId(getDefaultSalesRepId(item.opportunity ?? null, customers, salesReps));
    setContactLogDetails("");
    setContactLogOpen(true);
  }

  function handleLogContact() {
    if (!contactLogTarget) {
      return;
    }

    if (!contactLogSalesRepId) {
      return;
    }

    logOpportunityContactMutation.mutate({
      target: contactLogTarget,
      actionType: contactLogAction,
      salesRepId: contactLogSalesRepId,
      details: contactLogDetails,
    });
  }

  function handleOpenContactDetail(item: PipelineItem) {
    if (!item.lastContactMeta) {
      return;
    }

    setSelectedContactDetail({
      customerName: item.companyName,
      title: item.subtitle,
      meta: item.lastContactMeta,
    });
    setContactDetailOpen(true);
  }

  function handleOpenCustomerFromWorkspace(customerId: number) {
    navigate(getWorkspaceCustomerHref(customerId));
  }

  return (
    <AppLayout
      fluid
      scrollContent={false}
      headerContent={(
        <div className="flex min-h-[44px] items-center pl-2 md:pl-4">
          <img
            src="https://claritydiagnostics.com/wp-content/uploads/2022/07/Asset-1@4x.png"
            alt="Clarity Diagnostics"
            className="h-8 w-auto object-contain md:h-9"
          />
        </div>
      )}
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-2">
            <Card className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Pipeline</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">
                    Prospects and open opportunities in one queue, with duplicate prospect rows suppressed when an open opportunity already exists.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                    {visiblePipelineItems.length} visible
                  </Badge>
                  <Tabs value={pipelineView} onValueChange={(value) => setPipelineView(value as "all" | "prospect" | "opportunity")}>
                    <TabsList className="h-9 rounded-xl bg-slate-100 p-1">
                      <TabsTrigger value="prospect" className="rounded-lg">Prospect</TabsTrigger>
                      <TabsTrigger value="opportunity" className="rounded-lg">Opportunity</TabsTrigger>
                      <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 overflow-y-auto p-0">
              {visiblePipelineItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Company</th>
                        <th className="px-5 py-3 font-semibold">Contact</th>
                        <th className="px-5 py-3 font-semibold">Pipeline Item</th>
                        <th className="px-5 py-3 font-semibold">Last Contacted</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-4 py-2.5 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePipelineItems.map((item) => (
                        <tr key={item.key} className="group border-t border-slate-200 transition hover:bg-slate-50/80">
                          <td className="px-4 py-3">
                            <button type="button" className="text-left" onClick={() => handleOpenCustomerFromWorkspace(item.customerId)}>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                                    item.kind === "prospect"
                                      ? "bg-violet-100 text-violet-700"
                                      : "bg-sky-100 text-sky-700",
                                  )}
                                >
                                  {item.kind === "prospect" ? "P" : "O"}
                                </span>
                                <span className="font-semibold text-slate-950 transition group-hover:text-sky-800">
                                  {item.companyName}
                                </span>
                              </div>
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
                            {item.lastContactMeta ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-7 rounded-lg px-2 text-xs text-sky-700 hover:text-sky-800"
                                onClick={() => handleOpenContactDetail(item)}
                              >
                                View
                              </Button>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Select
                                key={`${item.key}-${item.statusLabel}`}
                                onValueChange={(value: OpportunityActionType) => {
                                  handleChoosePipelineAction(item, value);
                                }}
                              >
                                <SelectTrigger className="h-7 w-auto min-w-0 rounded-lg bg-white px-2.5 text-[11px]">
                                  <SelectValue placeholder="Update" />
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="m-5 rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  No pipeline items match this view right now.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col rounded-[1.6rem] border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200 bg-slate-50/70">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Work</CardTitle>
                    <p className="mt-1 text-sm text-slate-600">
                      Action points and tasks in one shared queue. Everything remains visible to everyone.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      {dashboardMetrics.dueToday} due today
                    </Badge>
                    <Tabs value={workView} onValueChange={(value) => setWorkView(value as "open" | "completed")}>
                      <TabsList className="h-9 rounded-xl bg-slate-100 p-1">
                        <TabsTrigger value="open" className="rounded-lg">Open</TabsTrigger>
                        <TabsTrigger value="completed" className="rounded-lg">Completed</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button className="rounded-xl bg-sky-600 hover:bg-sky-700" onClick={handleOpenCreateTask}>
                      <Plus className="mr-2 size-4" />
                      New task
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 space-y-2 overflow-y-auto p-4">
                {filteredWorkItems.length > 0 ? (
                    filteredWorkItems.map((item) => {
                      const dueMeta = getDueMeta(item.dueDate);
                      const canEditTask =
                        item.source === "task" &&
                        !item.completed &&
                        !!currentUser &&
                        (currentUser.role === "admin" || currentUser.id === item.createdByUserId);
                      return (
                      <div
                        key={item.key}
                        className={cn(
                          "rounded-[1.15rem] border p-3 transition",
                          item.completed
                            ? "border-slate-200 bg-slate-50/80"
                            : item.source === "action_point"
                              ? "border-slate-200 bg-white hover:border-sky-200"
                              : "border-slate-200 bg-white hover:border-violet-200",
                        )}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                className="mt-0.5 text-slate-400 hover:text-sky-600"
                                onClick={() => {
                                  if (item.source === "action_point") {
                                    handleToggleActionPoint(item.id);
                                  } else {
                                    handleToggleTask(item.id);
                                  }
                                }}
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
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                                  <Badge
                                    variant="outline"
                                    className={cn("text-[11px]", getWorkSourceBadgeClasses(item.source))}
                                  >
                                    {getWorkSourceLabel(item.source)}
                                  </Badge>
                                  {item.priority ? (
                                    <Badge variant="outline" className={cn("text-[11px]", getPriorityBadgeClasses(item.priority))}>
                                      {item.priority}
                                    </Badge>
                                  ) : null}
                                  {item.relatedCustomerStatus ? (
                                  <Badge
                                    variant="outline"
                                    className={cn("text-[11px]", getActionPointAccountTypeBadgeClasses(item.relatedCustomerStatus))}
                                  >
                                    {getActionPointAccountTypeLabel(item.relatedCustomerStatus)}
                                  </Badge>
                                  ) : null}
                                  {item.relatedCustomerId && item.relatedCustomerName ? (
                                  <span>
                                    Related {getActionPointAccountTypeLabel(item.relatedCustomerStatus ?? "active").toLowerCase()}:{" "}
                                    <button
                                      type="button"
                                      className="cursor-pointer font-medium text-sky-700 transition hover:-translate-y-0.5 hover:text-sky-800"
                                      onClick={() => handleOpenCustomerFromWorkspace(item.relatedCustomerId!)}
                                    >
                                      {item.relatedCustomerName}
                                    </button>
                                  </span>
                                  ) : (
                                    <span>General shared task</span>
                                  )}
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
                            {canEditTask ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => handleOpenEditTask(item.id)}
                              >
                                <Pencil className="mr-2 size-4" />
                                Edit
                              </Button>
                            ) : null}
                            {item.relatedCustomerId && item.relatedCustomerStatus ? (
                              <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => handleOpenCustomerFromWorkspace(item.relatedCustomerId!)}
                              >
                                Open {getActionPointAccountTypeLabel(item.relatedCustomerStatus).toLowerCase()}
                                <ArrowUpRight className="ml-2 size-4" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      );
                    })
                ) : (
                  <div className="rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    {workView === "open"
                      ? "No open work items match right now. Add an action point or task to keep the queue moving."
                      : "No completed work items match right now."}
                  </div>
                )}
                {workView === "completed" && completedWorkItemCount > 0 ? (
                  <>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 rounded-xl text-xs text-slate-600 hover:text-rose-700"
                        onClick={handleClearCompletedWorkItems}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Clear completed work items
                      </Button>
                    </div>
                  </>
                ) : null}
              </CardContent>
          </Card>
        </div>

        <Dialog open={taskOpen} onOpenChange={handleTaskDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{taskDialogMode === "edit-task" ? "Edit task" : "New task"}</DialogTitle>
              <DialogDescription>
                {taskDialogMode === "edit-task"
                  ? "Update the shared task details and save your changes."
                  : "Create a shared task, or optionally attach it to a customer/prospect to save it as an action point."}
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
              {taskDialogMode === "create" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Customer or prospect (optional)</label>
                  <Popover open={taskTargetOpen} onOpenChange={setTaskTargetOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" role="combobox" className="w-full justify-between overflow-hidden">
                        <span className="truncate">
                          {selectedTaskTarget
                            ? `${selectedTaskTarget.companyName || selectedTaskTarget.name} · ${getActionPointAccountTypeLabel(selectedTaskTarget.status)}`
                            : "No customer linked"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(32rem,var(--radix-popover-trigger-width))] p-0">
                      <Command>
                        <CommandInput placeholder="Search customers or prospects..." />
                        <CommandList className="max-h-72">
                          <CommandEmpty>No matching customers or prospects.</CommandEmpty>
                          <CommandItem
                            value="no customer linked clear"
                            onSelect={() => {
                              setNewTask((current) => ({ ...current, customerId: "" }));
                              setTaskTargetOpen(false);
                            }}
                          >
                            <div className="font-medium text-slate-900">No customer linked</div>
                          </CommandItem>
                          {actionPointTargets.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={[
                                customer.companyName,
                                customer.name,
                                customer.primaryContact,
                                customer.email ?? "",
                                getActionPointAccountTypeLabel(customer.status),
                              ].join(" ")}
                              onSelect={() => {
                                setNewTask((current) => ({ ...current, customerId: String(customer.id) }));
                                setTaskTargetOpen(false);
                              }}
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium text-slate-900">
                                  {customer.companyName || customer.name}
                                </div>
                                <div className="truncate text-xs text-slate-500">
                                  {[customer.name, customer.primaryContact, getActionPointAccountTypeLabel(customer.status)]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Notes</label>
                <Textarea
                  value={newTask.notes}
                  onChange={(event) => setNewTask((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Optional context for the task."
                  className="min-h-24"
                />
              </div>
              {newTask.customerId ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Due date</label>
                  <Input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(event) => setNewTask((current) => ({ ...current, dueDate: event.target.value }))}
                  />
                </div>
              ) : null}
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
              <Button variant="outline" onClick={() => handleTaskDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTask}>
                {taskDialogMode === "edit-task"
                  ? "Save changes"
                  : newTask.customerId
                    ? "Create action point"
                    : "Create task"}
              </Button>
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
                <div className="font-semibold text-slate-950">{contactLogTarget?.customerName}</div>
                <div className="mt-1 text-sm text-slate-600">{contactLogTarget?.title}</div>
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
              setSelectedContactDetail(null);
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
                <div className="font-semibold text-slate-950">{selectedContactDetail?.customerName}</div>
                <div className="mt-1 text-sm text-slate-600">{selectedContactDetail?.title}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Method</div>
                  <div className="mt-1 font-medium text-slate-950">{selectedContactDetail?.meta.actionLabel ?? "N/A"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Sales rep</div>
                  <div className="mt-1 font-medium text-slate-950">{selectedContactDetail?.meta.salesRepName ?? "N/A"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Timestamp</div>
                  <div className="mt-1 font-medium text-slate-950">
                    {formatContactTimestamp(selectedContactDetail?.meta.createdAt ?? null)}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Notes</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedContactDetail?.meta.details ?? "No additional notes were captured for this activity."}
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

      </div>
    </AppLayout>
  );
}
