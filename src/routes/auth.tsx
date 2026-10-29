import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/use-session";
import { FormAlert, friendlyAuthError } from "@/lib/auth-errors";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { EbitBrand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({ next: oauthReturnPath(s["next"]) }),
  head: () => ({
    meta: [
      { title: "Sign in | EBiT Open Core" },
      { name: "description", content: "Sign in to your EBiT Open Core workspace." },
      { property: "og:title", content: "Sign in | EBiT Open Core" },
      { property: "og:description", content: "Sign in to your EBiT Open Core workspace." },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next = "/" } = Route.useSearch();
  const destination = next === "/" ? "/app" : next;
  const { user } = useSession();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "magic">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (user) window.location.replace(destination);
  }, [user, destination]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Please enter a valid email address.");
    if (mode !== "forgot" && mode !== "magic" && password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: new URL("/auth?next=" + encodeURIComponent(destination), window.location.origin).href } });
        if (error) return setError(friendlyAuthError(error.message));
        return setNotice("Check your email for your secure sign-in link.");
      }
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) return setError(friendlyAuthError(error.message));
        return setNotice("If an account exists for this email, a reset link is on its way.");
      }
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return setError(friendlyAuthError(error.message));
        toast.success("Welcome back");
        window.location.assign(destination);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: new URL("/auth?next=" + encodeURIComponent(next), window.location.origin).href },
      });
      if (error) return setError(friendlyAuthError(error.message));
      if (data.user && (data.user.identities?.length ?? 0) === 0) return setError(friendlyAuthError("already registered"));
      if (!data.session) return setNotice("Account created. Check your email for the confirmation link.");
      window.location.assign(destination);
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError("");
    const callback = new URL("/auth", window.location.origin);
    callback.searchParams.set("next", next);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: callback.href });
    if (result.error) return setError("Google sign-in is unavailable right now. Please use email and password.");
    if (result.redirected) return;
    window.location.assign(destination);
  }

  const title = mode === "signin" ? "Sign in" : mode === "signup" ? "Create your workspace" : mode === "magic" ? "Email sign-in link" : "Reset password";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8"><EbitBrand /></div>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signup" ? "A private workspace is created for you automatically." : "Access your EBiT Open Core workspace."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode !== "forgot" && mode !== "magic" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          {error && <FormAlert kind="error">{error}</FormAlert>}
          {notice && <FormAlert kind="success">{notice}</FormAlert>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "magic" ? "Send sign-in link" : "Send reset link"}
          </Button>
        </form>
        {mode !== "forgot" && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
            <Button type="button" variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
          </>
        )}
        <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm">
          {mode === "signin" ? (
            <>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setMode("signup")}>Create account</button>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>Forgot password?</button>
              <Button variant="ghost" className="w-full" onClick={() => setMode("magic")}>Sign in with an email link</Button>
            </>
          ) : (
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>Back to sign in</button>
          )}
        </div>
      </div>
      <Link to="/docs" className="mt-6 text-sm text-muted-foreground hover:text-foreground">Read the documentation →</Link>
    </main>
  );
}
