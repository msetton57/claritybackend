import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSession, useSetupPassword } from "@/lib/auth";
import { ApiError } from "@/lib/http";

export default function SetupPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: session, isLoading } = useSession();
  const setupPasswordMutation = useSetupPassword();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    if (!session.user.passwordResetRequired) {
      setLocation("/");
    }
  }, [session?.user, setLocation]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await setupPasswordMutation.mutateAsync({ password, confirmPassword });
      toast({
        title: "Password saved",
        description: "Your personal password is now active.",
      });
      setLocation("/");
    } catch (error) {
      toast({
        title: "Unable to save password",
        description:
          error instanceof ApiError ? error.message : "Please review the two password fields and try again.",
        variant: "destructive",
      });
    }
  }

  if (isLoading || !session?.user) {
    return <div className="min-h-screen bg-[linear-gradient(135deg,#f4f1e8,#edf5f3)]" />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(209,165,84,0.22),transparent_30%),linear-gradient(135deg,#f6f3eb,#e7f2ef)] px-4 py-10">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-xl backdrop-blur">
          <Badge variant="outline" className="border-slate-300 bg-white/80 text-slate-700">
            Password setup required
          </Badge>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-slate-950">
            Set your own password
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            You&apos;re signed in with the temporary PIN. Choose a personal password now so future logins belong only to you.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card className="border-emerald-200/70 bg-emerald-50/80 shadow-none">
              <CardContent className="p-5">
                <KeyRound className="size-5 text-emerald-700" />
                <div className="mt-3 text-sm font-medium text-slate-900">Personal sign-in</div>
                <p className="mt-1 text-sm text-slate-600">Replace the shared starter PIN with a password only you know.</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200/70 bg-amber-50/80 shadow-none">
              <CardContent className="p-5">
                <ShieldCheck className="size-5 text-amber-700" />
                <div className="mt-3 text-sm font-medium text-slate-900">Admin reset support</div>
                <p className="mt-1 text-sm text-slate-600">If needed, an admin can reset you back to the temporary PIN and have you set a new one again.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <Card className="rounded-[2rem] border-white/70 bg-white/90 shadow-xl">
          <CardHeader>
            <CardTitle>Create your password</CardTitle>
            <CardDescription>
              Signed in as {session.user.name} ({session.user.email})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="setup-password">New password</Label>
                <Input
                  id="setup-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create your password"
                  minLength={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-confirm-password">Confirm password</Label>
                <Input
                  id="setup-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Retype your password"
                  minLength={4}
                  required
                />
              </div>
              <Button className="w-full" type="submit" disabled={setupPasswordMutation.isPending}>
                {setupPasswordMutation.isPending ? "Saving..." : "Save password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
