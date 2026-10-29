import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function friendlyAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect. Check both and try again, or reset your password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — open the link we sent to your inbox.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Sign in instead, or reset your password.";
  if (m.includes("password should be") || m.includes("at least")) return "Password must be at least 6 characters.";
  if (m.includes("weak") || m.includes("pwned") || m.includes("compromised")) return "This password is too easy to guess or has appeared in a data leak. Choose a stronger one.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Please enter a valid email address.";
  if (m.includes("same password") || m.includes("different from the old")) return "New password must be different from your current one.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "This link has expired or was already used. Request a new one.";
  if (m.includes("fetch") || m.includes("network")) return "Couldn't reach the server. Check your internet connection and try again.";
  return raw || "Something went wrong. Please try again.";
}

export function FormAlert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-sm",
        kind === "error" ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-primary/40 bg-primary/10 text-foreground",
      )}
    >
      {children}
    </div>
  );
}

