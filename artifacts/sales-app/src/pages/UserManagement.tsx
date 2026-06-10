import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Clock3,
  Edit3,
  KeyRound,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  createUser,
  listUsers,
  resetUserPin,
  updateUser,
  useCurrentUser,
  type ClarityUser,
  type UserCreateInput,
  type UserInput,
  type UserStatus,
} from "@/lib/users";

const EMPTY_FORM: UserCreateInput = {
  name: "",
  email: "",
  phone: "",
  title: "Sales Representative",
  status: "active",
  pin: "2468",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function lastSeenLabel(value: string | null) {
  if (!value) return "Has not signed in yet";
  return `Active ${formatDistanceToNow(new Date(value), { addSuffix: true })}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UserManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser, isLoading: isLoadingCurrentUser } =
    useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: isAdmin,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ClarityUser | null>(null);
  const [form, setForm] = useState<UserCreateInput>(EMPTY_FORM);
  const [resetPin, setResetPin] = useState("2468");

  const saveMutation = useMutation({
    mutationFn: () =>
      editingUser
        ? updateUser(editingUser.id, {
            name: form.name,
            email: form.email,
            phone: form.phone,
            title: form.title,
            status: form.status,
          })
        : createUser(form),
    onSuccess: async (savedUser) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setDialogOpen(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
      setResetPin("2468");
      toast({
        title: editingUser ? "User updated" : "Sales rep created",
        description:
          "temporaryPin" in savedUser
            ? `${savedUser.name}'s account is ready. Temporary PIN: ${savedUser.temporaryPin}.`
            : `${savedUser.name}'s account is ready.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to save user",
        description:
          error instanceof Error
            ? error.message
            : "Please review the account details.",
        variant: "destructive",
      });
    },
  });

  const resetPinMutation = useMutation({
    mutationFn: () => {
      if (!editingUser) {
        throw new Error("Select a user first");
      }

      return resetUserPin(editingUser.id, resetPin);
    },
    onSuccess: async (updatedUser) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "PIN reset",
        description: `${updatedUser.name}'s new PIN is ${updatedUser.temporaryPin}.`,
      });
      setResetPin(updatedUser.temporaryPin);
    },
    onError: (error) => {
      toast({
        title: "Unable to reset PIN",
        description:
          error instanceof Error ? error.message : "Please try a different PIN.",
        variant: "destructive",
      });
    },
  });

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;
      const matchesSearch =
        !term ||
        [user.name, user.email, user.phone, user.title, user.role]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, users]);

  const activeReps = users.filter(
    (user) => user.role === "sales_rep" && user.status === "active",
  ).length;
  const inactiveUsers = users.filter(
    (user) => user.status === "inactive",
  ).length;

  function openCreateDialog() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setResetPin("2468");
    setDialogOpen(true);
  }

  function openEditDialog(user: ClarityUser) {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      title: user.title,
      status: user.status,
      pin: "",
    });
    setResetPin("2468");
    setDialogOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate();
  }

  if (isLoadingCurrentUser) {
    return (
      <AppLayout>
        <div className="space-y-5">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-80 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <Card className="mx-auto mt-12 max-w-xl">
          <CardHeader>
            <CardTitle>Administrator access required</CardTitle>
            <CardDescription>
              User creation and profile management are reserved for the main
              administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">
              Administration
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              User Management
            </h1>
            <p className="mt-1 text-muted-foreground">
              Manage the people who can work in Clarity and keep sales ownership
              in sync. Admins can also issue or reset PINs during onboarding.
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 size-4" />
            Add sales rep
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            icon={Users}
            label="Total users"
            value={users.length}
            description="Admin and sales team"
          />
          <StatCard
            icon={UserRoundCheck}
            label="Active sales reps"
            value={activeReps}
            description="Available for assignment"
          />
          <StatCard
            icon={Clock3}
            label="Inactive users"
            value={inactiveUsers}
            description="Access currently paused"
          />
        </div>

        <Card>
          <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Team directory</CardTitle>
              <CardDescription>
                {visibleUsers.length} users match the current view.
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, email, or title"
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as "all" | UserStatus)
                }
              >
                <SelectTrigger className="sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">User</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {initials(user.name)}
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.title}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <a
                            className="flex items-center gap-2 hover:text-primary"
                            href={`mailto:${user.email}`}
                          >
                            <Mail className="size-3.5 text-muted-foreground" />
                            {user.email}
                          </a>
                          <p className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="size-3.5" />
                            {user.phone || "No phone added"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role === "admin" ? (
                          <Badge className="gap-1">
                            <ShieldCheck className="size-3" />
                            Main admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">Sales rep</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            user.status === "active"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                          }
                        >
                          {user.status === "active" ? (
                            <CheckCircle2 className="mr-1 size-3" />
                          ) : null}
                          {user.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lastSeenLabel(user.lastActiveAt)}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit3 className="mr-2 size-4" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              openEditDialog(user);
                              setResetPin("2468");
                            }}
                          >
                            <KeyRound className="mr-2 size-4" />
                            Reset PIN
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit user" : "Add a sales rep"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update account details and access status."
                : "New users receive sales rep access and can be assigned to customers and orders."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user-name">Full name</Label>
                <Input
                  id="user-name"
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-title">Job title</Label>
                <Input
                  id="user-title"
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                required
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user-phone">Phone</Label>
                <Input
                  id="user-phone"
                  value={form.phone ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-status">Status</Label>
                <Select
                  value={editingUser?.role === "admin" ? "active" : form.status}
                  disabled={editingUser?.role === "admin"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      status: value as UserStatus,
                    }))
                  }
                >
                  <SelectTrigger id="user-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editingUser ? (
              <div className="space-y-2">
                <Label htmlFor="user-pin">Initial PIN</Label>
                <Input
                  id="user-pin"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.pin ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pin: event.target.value,
                    }))
                  }
                  placeholder="2468"
                />
                <p className="text-xs text-muted-foreground">
                  Use 4 to 8 digits. Leave `2468` if you want the default PIN.
                </p>
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? "Saving..."
                  : editingUser
                    ? "Save changes"
                    : "Create user"}
              </Button>
            </DialogFooter>
          </form>
          {editingUser ? (
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="reset-pin">Reset PIN</Label>
                  <Input
                    id="reset-pin"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={resetPin}
                    onChange={(event) => setResetPin(event.target.value)}
                    placeholder="2468"
                  />
                  <p className="text-xs text-muted-foreground">
                    Give {editingUser.name} a fresh 4 to 8 digit PIN without changing their role or status.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={resetPinMutation.isPending}
                  onClick={() => resetPinMutation.mutate()}
                >
                  {resetPinMutation.isPending ? "Resetting..." : "Reset PIN"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
