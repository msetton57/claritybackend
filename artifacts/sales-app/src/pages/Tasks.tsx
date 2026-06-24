import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  Check,
  Circle,
  Clock3,
  ListFilter,
  MessageSquareShare,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  createCollaborationTask,
  deleteCollaborationTask,
  updateCollaborationTask,
  useCollaborationTasks,
  type CollaborativeTask,
} from "@/lib/collaboration";
import { useCurrentUser, useUsers } from "@/lib/users";

const PRIORITY_OPTIONS = [
  { value: "high", label: "High priority" },
  { value: "medium", label: "Medium priority" },
  { value: "low", label: "Low priority" },
] as const;

const CATEGORY_OPTIONS = ["Follow-up", "Accounts", "Forecast", "Internal"] as const;

type FilterValue = "all" | "active" | "completed";
type PriorityValue = (typeof PRIORITY_OPTIONS)[number]["value"];
type CategoryValue = (typeof CATEGORY_OPTIONS)[number];

function priorityClasses(priority: PriorityValue) {
  if (priority === "high") {
    return "bg-rose-500/10 text-rose-700 border-rose-200";
  }

  if (priority === "low") {
    return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
  }

  return "bg-amber-500/10 text-amber-700 border-amber-200";
}

function categoryClasses(category: CategoryValue) {
  if (category === "Accounts") {
    return "bg-sky-500/10 text-sky-700 border-sky-200";
  }

  if (category === "Forecast") {
    return "bg-violet-500/10 text-violet-700 border-violet-200";
  }

  if (category === "Internal") {
    return "bg-slate-500/10 text-slate-700 border-slate-200";
  }

  return "bg-orange-500/10 text-orange-700 border-orange-200";
}

function detectMentionedNames(
  text: string,
  users: Array<{ id: number; name: string }>,
) {
  const lowerText = text.toLowerCase();
  const firstNameCounts = new Map<string, number>();

  for (const user of users) {
    const firstName = user.name.split(/\s+/)[0]?.toLowerCase();
    if (!firstName) continue;
    firstNameCounts.set(firstName, (firstNameCounts.get(firstName) ?? 0) + 1);
  }

  return users.filter((user) => {
    if (lowerText.includes(`@${user.name.toLowerCase()}`)) {
      return true;
    }

    const firstName = user.name.split(/\s+/)[0]?.toLowerCase();
    return Boolean(
      firstName &&
        firstNameCounts.get(firstName) === 1 &&
        lowerText.includes(`@${firstName}`),
    );
  });
}

function TaskRow({
  task,
  canDelete,
  onToggle,
  onDelete,
}: {
  task: CollaborativeTask;
  canDelete: boolean;
  onToggle: (task: CollaborativeTask) => void;
  onDelete: (task: CollaborativeTask) => void;
}) {
  const priority = task.priority ?? "medium";
  const category = task.category ?? "Follow-up";

  return (
    <div className="group rounded-3xl border border-border/80 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          onClick={() => onToggle(task)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span
            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
              task.completed
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-slate-300 bg-white text-transparent group-hover:border-primary/60"
            }`}
          >
            {task.completed ? <Check className="size-4" /> : <Circle className="size-3 text-transparent" />}
          </span>
          <div className="min-w-0">
            <div
              className={`text-sm font-medium leading-6 ${
                task.completed ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              {task.title}
            </div>
            {task.notes ? (
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{task.notes}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Created by {task.createdBy.name}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {task.assignees.map((assignee) => (
                <Badge key={assignee.id} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                  <UserRound className="mr-1 size-3" />
                  {assignee.name}
                </Badge>
              ))}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 self-start">
          <Badge variant="outline" className={priorityClasses(priority)}>
            {PRIORITY_OPTIONS.find((option) => option.value === priority)?.label}
          </Badge>
          <Badge variant="outline" className={categoryClasses(category)}>
            {category}
          </Badge>
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-rose-600"
              onClick={() => onDelete(task)}
              aria-label={`Delete ${task.title}`}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Tasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const { data: tasks = [] } = useCollaborationTasks();
  const { data: users = [] } = useUsers();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskNotes, setNewTaskNotes] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityValue>("high");
  const [newTaskCategory, setNewTaskCategory] = useState<CategoryValue>("Follow-up");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const deferredSearch = useDeferredValue(search);

  const createMutation = useMutation({
    mutationFn: createCollaborationTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collaboration", "tasks"] });
      setNewTaskTitle("");
      setNewTaskNotes("");
      setNewTaskPriority("high");
      setNewTaskCategory("Follow-up");
      toast({
        title: "Task created",
        description: "Mentioned teammates will see it in their queue after they log in.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to create task",
        description: error instanceof Error ? error.message : "Please review the task details.",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: number; completed: boolean }) =>
      updateCollaborationTask(taskId, { completed }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collaboration", "tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCollaborationTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collaboration", "tasks"] });
    },
    onError: (error) => {
      toast({
        title: "Unable to delete task",
        description: error instanceof Error ? error.message : "Only creators can remove a task.",
        variant: "destructive",
      });
    },
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = newTaskTitle.trim();
    if (!title) {
      return;
    }

    await createMutation.mutateAsync({
      title,
      notes: newTaskNotes.trim() || null,
      priority: newTaskPriority,
      category: newTaskCategory,
    });
  }

  const completionRate = tasks.length
    ? Math.round((tasks.filter((task) => task.completed).length / tasks.length) * 100)
    : 0;
  const activeTasks = tasks.filter((task) => !task.completed);
  const highPriorityCount = activeTasks.filter((task) => task.priority === "high").length;
  const focusTask = activeTasks.find((task) => task.priority === "high") ?? activeTasks[0];
  const searchTerm = deferredSearch.trim().toLowerCase();
  const mentionPreview = detectMentionedNames(
    `${newTaskTitle}\n${newTaskNotes}`,
    users.map((user) => ({ id: user.id, name: user.name })),
  );

  const filteredTasks = tasks.filter((task) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && !task.completed) ||
      (filter === "completed" && task.completed);

    if (!matchesFilter) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    return [
      task.title,
      task.notes,
      task.category,
      task.priority,
      task.createdBy.name,
      ...task.assignees.map((assignee) => assignee.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(searchTerm);
  });

  const filteredFocus = filteredTasks.filter((task) => !task.completed && task.priority === "high");
  const filteredActive = filteredTasks.filter((task) => !task.completed && task.priority !== "high");
  const filteredCompleted = filteredTasks.filter((task) => task.completed);

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_28%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(241,245,249,0.92))] p-6 shadow-sm md:p-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
            <div className="space-y-4">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                Shared execution workspace
              </Badge>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  Collaborative tasks that follow the people you mention
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  Write `@Full Name` in the task title or notes and that teammate will see the task in their own queue after login.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Sparkles className="size-3.5 text-primary" />
                    Completion
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{completionRate}%</div>
                  <Progress value={completionRate} className="mt-3 h-2.5 bg-slate-200" />
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Target className="size-3.5 text-primary" />
                    Active
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{activeTasks.length}</div>
                  <p className="mt-2 text-sm text-muted-foreground">Visible work still in play.</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Clock3 className="size-3.5 text-primary" />
                    High priority
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{highPriorityCount}</div>
                  <p className="mt-2 text-sm text-muted-foreground">Urgent items across your queue.</p>
                </div>
              </div>
            </div>

            <Card className="border-slate-200/80 bg-slate-950 text-slate-50 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="size-4 text-sky-300" />
                  Focus now
                </CardTitle>
              </CardHeader>
              <CardContent>
                {focusTask ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">
                        {focusTask.category}
                      </div>
                      <div className="mt-2 text-2xl font-semibold leading-tight">{focusTask.title}</div>
                      {focusTask.notes ? (
                        <p className="mt-3 text-sm leading-6 text-slate-300">{focusTask.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-0 bg-white/10 text-white shadow-none">
                        {PRIORITY_OPTIONS.find((option) => option.value === focusTask.priority)?.label}
                      </Badge>
                      {focusTask.assignees.map((assignee) => (
                        <Badge key={assignee.id} className="border-0 bg-sky-400/15 text-sky-200 shadow-none">
                          {assignee.name}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full justify-between border-0 bg-white text-slate-950 hover:bg-slate-100"
                      onClick={() =>
                        toggleMutation.mutate({
                          taskId: focusTask.id,
                          completed: !focusTask.completed,
                        })
                      }
                    >
                      {focusTask.completed ? "Reopen task" : "Mark complete"}
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-slate-300">
                    Everything visible to you is wrapped up. Add a fresh task or mention a teammate to start a new collaboration thread.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <Card className="rounded-[1.75rem] border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle>Add a task</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Task title</label>
                  <Input
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    placeholder="Review Northeast pipeline with @Ava Rodriguez"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Context</label>
                  <Textarea
                    value={newTaskNotes}
                    onChange={(event) => setNewTaskNotes(event.target.value)}
                    placeholder="Mention teammates with @Full Name and they’ll see this task too."
                    className="min-h-24"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <MessageSquareShare className="size-4 text-primary" />
                    Mention preview
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mentionPreview.length > 0 ? (
                      mentionPreview.map((user) => (
                        <Badge key={user.id} variant="outline" className="border-slate-300 bg-white text-slate-700">
                          {user.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-600">
                        No teammate mentions detected yet. Without a mention, the task stays assigned to you.
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Priority</label>
                    <div className="grid grid-cols-1 gap-2">
                      {PRIORITY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setNewTaskPriority(option.value)}
                          className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
                            newTaskPriority === option.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background hover:border-primary/30"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORY_OPTIONS.map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setNewTaskCategory(category)}
                          className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
                            newTaskCategory === category
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background hover:border-primary/30"
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full gap-2" disabled={createMutation.isPending}>
                  <Plus className="size-4" />
                  {createMutation.isPending ? "Adding task..." : "Add task to queue"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-slate-200/80 shadow-sm">
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Task board</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This queue shows what you created, what was assigned to you, and anything you can help complete.
                  </p>
                </div>
                <div className="relative w-full lg:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search title, assignee, notes..."
                    className="pl-9"
                  />
                </div>
              </div>

              <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterValue)}>
                <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-muted/60 p-1">
                  <TabsTrigger value="all" className="rounded-xl">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="active" className="rounded-xl">
                    Active
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="rounded-xl">
                    Completed
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <ListFilter className="size-3.5" />
                    Showing
                  </div>
                  <div className="mt-3 text-2xl font-semibold">{filteredTasks.length}</div>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Focus tasks</div>
                  <div className="mt-3 text-2xl font-semibold">{filteredFocus.length}</div>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Completed</div>
                  <div className="mt-3 text-2xl font-semibold">{filteredCompleted.length}</div>
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed bg-muted/20 px-6 py-12 text-center">
                  <div className="text-lg font-medium">No tasks match this view</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try a different filter, or create a task and mention a teammate to start a new assignment thread.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredFocus.length > 0 ? (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Focus first</h2>
                        <span className="text-xs text-muted-foreground">{filteredFocus.length} urgent</span>
                      </div>
                      <div className="space-y-3">
                        {filteredFocus.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            canDelete={currentUser?.role === "admin" || currentUser?.id === task.createdBy.id}
                            onToggle={(nextTask) =>
                              toggleMutation.mutate({
                                taskId: nextTask.id,
                                completed: !nextTask.completed,
                              })
                            }
                            onDelete={(nextTask) => deleteMutation.mutate(nextTask.id)}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {filteredActive.length > 0 ? (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Up next</h2>
                        <span className="text-xs text-muted-foreground">{filteredActive.length} queued</span>
                      </div>
                      <div className="space-y-3">
                        {filteredActive.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            canDelete={currentUser?.role === "admin" || currentUser?.id === task.createdBy.id}
                            onToggle={(nextTask) =>
                              toggleMutation.mutate({
                                taskId: nextTask.id,
                                completed: !nextTask.completed,
                              })
                            }
                            onDelete={(nextTask) => deleteMutation.mutate(nextTask.id)}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {filteredCompleted.length > 0 ? (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Completed</h2>
                        <span className="text-xs text-muted-foreground">{filteredCompleted.length} done</span>
                      </div>
                      <div className="space-y-3">
                        {filteredCompleted.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            canDelete={currentUser?.role === "admin" || currentUser?.id === task.createdBy.id}
                            onToggle={(nextTask) =>
                              toggleMutation.mutate({
                                taskId: nextTask.id,
                                completed: !nextTask.completed,
                              })
                            }
                            onDelete={(nextTask) => deleteMutation.mutate(nextTask.id)}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
