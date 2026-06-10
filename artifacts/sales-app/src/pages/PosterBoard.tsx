import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, Megaphone, Newspaper, Pin, Plus, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createPosterBoardPost, usePosterBoardPosts } from "@/lib/collaboration";
import { useCurrentUser, useUsers } from "@/lib/users";

const POST_TYPES = [
  { value: "announcement", label: "Announcement", icon: Megaphone },
  { value: "headline", label: "Headline", icon: Newspaper },
  { value: "reminder", label: "Reminder", icon: Bell },
] as const;

type PostType = (typeof POST_TYPES)[number]["value"];

function postTypeClasses(postType: PostType) {
  if (postType === "headline") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (postType === "reminder") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

export default function PosterBoard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const { data: posts = [], isLoading } = usePosterBoardPosts();
  const { data: users = [] } = useUsers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [postType, setPostType] = useState<PostType>("announcement");
  const [includeAllUsers, setIncludeAllUsers] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const createMutation = useMutation({
    mutationFn: createPosterBoardPost,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collaboration", "poster-board"] });
      setDialogOpen(false);
      setTitle("");
      setBody("");
      setPostType("announcement");
      setIncludeAllUsers(true);
      setSelectedUserIds([]);
      toast({
        title: "Poster published",
        description: "The selected team members can see it now.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to publish poster",
        description: error instanceof Error ? error.message : "Please review the poster details.",
        variant: "destructive",
      });
    },
  });

  function toggleUser(userId: number) {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  async function handleCreatePoster(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!includeAllUsers && selectedUserIds.length === 0) {
      toast({
        title: "Choose an audience",
        description: "Select at least one teammate or publish the poster to everyone.",
        variant: "destructive",
      });
      return;
    }

    await createMutation.mutateAsync({
      postType,
      title,
      body,
      includeAllUsers,
      targetUserIds: includeAllUsers ? [] : selectedUserIds,
    });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.18),_transparent_26%),linear-gradient(135deg,_rgba(255,251,235,0.95),_rgba(239,246,255,0.96))] p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge variant="outline" className="border-slate-300 bg-white/80 text-slate-700">
                Team communication board
              </Badge>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                Headlines, reminders, and announcements that land with the right people
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Publish team-wide notes or target a smaller audience when something only applies to a few reps.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 size-4" />
              New poster
            </Button>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-[1.5rem] border-slate-200/80 shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">Visible posts</div>
              <div className="mt-2 text-3xl font-semibold">{posts.length}</div>
            </CardContent>
          </Card>
          <Card className="rounded-[1.5rem] border-slate-200/80 shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">Created by you</div>
              <div className="mt-2 text-3xl font-semibold">
                {posts.filter((post) => post.createdBy.id === currentUser?.id).length}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[1.5rem] border-slate-200/80 shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">Audience-targeted</div>
              <div className="mt-2 text-3xl font-semibold">
                {posts.filter((post) => !post.includeAllUsers).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {isLoading ? (
            Array.from({ length: 4 }, (_, index) => (
              <Card key={index} className="h-56 rounded-[1.75rem] border-slate-200/80 shadow-sm" />
            ))
          ) : posts.length > 0 ? (
            posts.map((post) => {
              const Icon = POST_TYPES.find((option) => option.value === post.postType)?.icon ?? Megaphone;

              return (
                <Card key={post.id} className="rounded-[1.75rem] border-slate-200/80 shadow-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Badge variant="outline" className={postTypeClasses(post.postType)}>
                          <Icon className="mr-1 size-3.5" />
                          {POST_TYPES.find((option) => option.value === post.postType)?.label}
                        </Badge>
                        <CardTitle className="mt-4 text-2xl">{post.title}</CardTitle>
                        <CardDescription className="mt-2 text-sm">
                          Posted by {post.createdBy.name} {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                        </CardDescription>
                      </div>
                      {post.includeAllUsers ? (
                        <Badge className="bg-slate-900 text-white shadow-none">Everyone</Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                          {post.targets.length} selected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-7 text-slate-700">{post.body}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {post.includeAllUsers ? (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                          <Sparkles className="mr-1 size-3" />
                          Full team visibility
                        </Badge>
                      ) : (
                        post.targets.map((target) => (
                          <Badge key={target.id} variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                            <Pin className="mr-1 size-3" />
                            {target.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="rounded-[1.75rem] border-dashed border-slate-300 bg-slate-50/70 shadow-none xl:col-span-2">
              <CardContent className="p-12 text-center">
                <div className="text-xl font-medium text-slate-900">No posters yet</div>
                <p className="mt-2 text-sm text-slate-600">
                  Publish a reminder, headline, or announcement so the team has one shared place to check updates.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create a poster</DialogTitle>
            <DialogDescription>
              Share a reminder, headline, or announcement and choose who should see it.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleCreatePoster}>
            <div className="grid gap-3 sm:grid-cols-3">
              {POST_TYPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPostType(option.value)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    postType === option.value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <option.icon className="size-4" />
                  <div className="mt-3 font-medium">{option.label}</div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="poster-title">Title</Label>
              <Input id="poster-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="poster-body">Message</Label>
              <Textarea
                id="poster-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="min-h-32"
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Checkbox
                  checked={includeAllUsers}
                  onCheckedChange={(checked) => setIncludeAllUsers(Boolean(checked))}
                />
                <div>
                  <div className="font-medium text-slate-900">Show this to everyone</div>
                  <div className="text-sm text-slate-600">Turn this off to target only selected users.</div>
                </div>
              </label>

              {!includeAllUsers ? (
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
                  {users.map((user) => (
                    <label key={user.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3 py-3">
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => toggleUser(user.id)}
                      />
                      <div>
                        <div className="font-medium text-slate-900">{user.name}</div>
                        <div className="text-sm text-slate-600">{user.title}</div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : null}
              {!includeAllUsers && selectedUserIds.length === 0 ? (
                <p className="text-sm text-red-600">
                  Pick at least one teammate before publishing a targeted poster.
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Publishing..." : "Publish poster"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
