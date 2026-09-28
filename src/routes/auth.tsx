import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AmbientBackground } from "@/components/AmbientBackground";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Vigil Exam Hall" },
      { name: "description", content: "Sign in or create a student account to take the daily MCQ exam." },
      { property: "og:title", content: "Sign in — Vigil Exam Hall" },
      { property: "og:description", content: "Sign in or create a student account to take the daily MCQ exam." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in did not complete.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-5 py-10 font-body text-ink">
      <AmbientBackground />
      <div className="fade-up w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-[10px] bg-ink font-display text-sm font-semibold text-panel">
            V
          </div>
          <div>
            <p className="font-display text-[15px] font-semibold leading-none">Vigil</p>
            <p className="text-[11px] text-ink-faint">Exam Hall</p>
          </div>
        </Link>

        <div className="panel-glass rounded-2xl p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold leading-tight">
            {mode === "signin" ? "Sign in to sit today's exam" : "Create your student account"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Your attempts and results are saved to your account on every device.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="fullName" className="text-xs font-medium text-ink-soft">
                  Full name
                </label>
                <input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-[10px] border border-line bg-panel px-3 py-2.5 text-sm outline-none focus:border-brand"
                  placeholder="Aisha Khan"
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="text-xs font-medium text-ink-soft">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1.5 w-full rounded-[10px] border border-line bg-panel px-3 py-2.5 text-sm outline-none focus:border-brand"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs font-medium text-ink-soft">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1.5 w-full rounded-[10px] border border-line bg-panel px-3 py-2.5 text-sm outline-none focus:border-brand"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-[10px] bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full rounded-[10px] border border-line bg-panel px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-paper"
          >
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-ink-soft">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-brand"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
