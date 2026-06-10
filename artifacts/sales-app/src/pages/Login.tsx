import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getLoginOptions, useLogin, useSession } from "@/lib/auth";
import { ApiError } from "@/lib/http";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: session, isLoading: isLoadingSession } = useSession();
  const { data: loginOptions = [] } = useQuery({
    queryKey: ["auth", "login-options"],
    queryFn: getLoginOptions,
    retry: false,
  });
  const loginMutation = useLogin();
  const [email, setEmail] = useState("morris.setton@clarity.local");
  const [pin, setPin] = useState("2468");

  useEffect(() => {
    if (session?.user) {
      setLocation("/");
    }
  }, [session?.user, setLocation]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await loginMutation.mutateAsync({ email, pin });
      setLocation("/");
    } catch (error) {
      toast({
        title: "Login failed",
        description:
          error instanceof ApiError ? error.message : "Please check the email and PIN.",
        variant: "destructive",
      });
    }
  }

  if (isLoadingSession) {
    return <div className="min-h-screen bg-[linear-gradient(135deg,#f4f1e8,#edf5f3)]" />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(209,165,84,0.22),transparent_30%),linear-gradient(135deg,#f6f3eb,#e7f2ef)] px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-xl backdrop-blur">
          <Badge variant="outline" className="border-slate-300 bg-white/80 text-slate-700">
            Clarity collaboration login
          </Badge>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-slate-950">
            Sign in to your shared sales workspace
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            We’re moving identity, tasks, and announcements into one shared flow so assignments,
            reminders, and board posts follow the right people automatically.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Card className="border-amber-200/70 bg-amber-50/80 shadow-none">
              <CardContent className="p-5">
                <ShieldCheck className="size-5 text-amber-700" />
                <div className="mt-3 text-sm font-medium text-slate-900">Admin and rep sessions</div>
                <p className="mt-1 text-sm text-slate-600">Access now follows the actual signed-in user.</p>
              </CardContent>
            </Card>
            <Card className="border-sky-200/70 bg-sky-50/80 shadow-none">
              <CardContent className="p-5">
                <Users className="size-5 text-sky-700" />
                <div className="mt-3 text-sm font-medium text-slate-900">Mention-based tasks</div>
                <p className="mt-1 text-sm text-slate-600">Write `@Full Name` and it lands in their queue.</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200/70 bg-emerald-50/80 shadow-none">
              <CardContent className="p-5">
                <KeyRound className="size-5 text-emerald-700" />
                <div className="mt-3 text-sm font-medium text-slate-900">PIN-based access</div>
                <p className="mt-1 text-sm text-slate-600">Admins can create reps and issue their PINs without changing the login flow.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <Card className="rounded-[2rem] border-white/70 bg-white/90 shadow-xl">
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Select a teammate or sign in by email and PIN.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="morris.setton@clarity.local"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-pin">PIN</Label>
                <Input
                  id="login-pin"
                  type="password"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  placeholder="2468"
                />
              </div>
              <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">Quick sign-in</div>
              <div className="grid gap-3">
                {loginOptions.slice(0, 6).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setEmail(option.email)}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition hover:border-slate-400 hover:bg-white"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{option.name}</div>
                      <div className="text-sm text-slate-600">{option.email}</div>
                    </div>
                    <Badge variant="outline">{option.role === "admin" ? "Admin" : "Sales rep"}</Badge>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
