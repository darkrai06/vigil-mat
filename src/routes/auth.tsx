import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Footer } from "@/components/Footer";

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
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. Initial check for existing active session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      }
    });

    // 2. Listen to auth state changes (crucial for Google OAuth redirect completion)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
        navigate({ to: "/dashboard", replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setInfoMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password;
    const cleanFullName = fullName.trim();

    try {
      if (mode === "signup") {
        if (!cleanFullName) {
          toast.error("Please enter your full name.");
          setBusy(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: cleanFullName },
          },
        });

        if (error) throw error;

        // If email confirmation is enabled in Supabase, user exists but session is null
        if (data.user && !data.session) {
          setInfoMessage(
            "Account created! Please check your email inbox to confirm your account before logging in."
          );
          toast.success("Account created! Check your email to confirm.");
          return;
        }

        toast.success("Account created successfully!");
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) throw error;

        toast.success("Signed in successfully!");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setInfoMessage(null);

    try {
      // 1. Try Lovable cloud auth integration first
      let result;
      try {
        result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      } catch (err) {
        console.warn("Lovable cloud auth failed, falling back to Supabase OAuth:", err);
      }

      if (result && !result.error) {
        if (result.redirected) return;
        if (result.tokens) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
      }

      // 2. Fallback to standard Supabase OAuth with Google
      const redirectTo = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in did not complete.");
      setBusy(false);
    }
  }

  function toggleMode(newMode: "signin" | "signup") {
    setMode(newMode);
    setInfoMessage(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink">
      <div className="flex flex-1 items-center justify-center px-5 py-10">
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

          {infoMessage && (
            <div className="mt-4 rounded-xl border border-brand/20 bg-brand-soft p-3.5 text-xs font-medium text-brand">
              {infoMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="fullName" className="text-xs font-medium text-ink-soft">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={busy}
                  className="mt-1.5 w-full rounded-[10px] border border-line bg-panel px-3 py-2.5 text-sm outline-none focus:border-brand disabled:opacity-50"
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
                disabled={busy}
                className="mt-1.5 w-full rounded-[10px] border border-line bg-panel px-3 py-2.5 text-sm outline-none focus:border-brand disabled:opacity-50"
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
                disabled={busy}
                className="mt-1.5 w-full rounded-[10px] border border-line bg-panel px-3 py-2.5 text-sm outline-none focus:border-brand disabled:opacity-50"
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
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-line bg-panel px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-60"
          >
            <svg className="size-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-ink-soft">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => toggleMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-brand"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
      </div>
      <Footer />
    </div>
  );
}
