import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AmbientBackground } from "@/components/AmbientBackground";

type NavItem = { to: string; label: string };

const baseNav: NavItem[] = [
  { to: "/dashboard", label: "Today's exam" },
  { to: "/history", label: "Attempt history" },
];

export function AppShell({
  children,
  showAdmin,
  headerLeft,
  headerRight,
}: {
  children: ReactNode;
  showAdmin?: boolean;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = showAdmin ? [...baseNav, { to: "/admin", label: "Admin" }] : baseNav;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-paper font-body text-ink">
      <AmbientBackground />
      <div className="mx-auto flex max-w-[1440px]">
        <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-line/70 bg-panel/55 px-5 py-6 backdrop-blur-2xl lg:flex">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-[10px] bg-ink font-display text-sm font-semibold text-panel">
              V
            </div>
            <div>
              <p className="font-display text-[15px] font-semibold leading-none">Vigil</p>
              <p className="text-[11px] text-ink-faint">Exam Hall</p>
            </div>
          </Link>
          <nav className="flex flex-col gap-1">
            {items.map((item, index) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    active
                      ? "flex items-center gap-3 rounded-[10px] bg-brand-soft px-3 py-2.5 text-sm font-medium text-brand"
                      : "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-panel/70"
                  }
                >
                  <span className="grid size-4 place-items-center text-[10px] font-semibold">{index + 1}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3">
            <div className="rounded-xl bg-ink p-4 text-panel">
              <p className="text-[11px] uppercase tracking-[0.15em] text-panel/50">Marking scheme</p>
              <p className="mt-1 font-display text-2xl font-semibold leading-none">+1 · −0.25</p>
              <p className="mt-2 text-xs text-panel/60">Unanswered questions score zero.</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full rounded-[10px] border border-line bg-panel/70 px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-6 sm:px-8">
          <header className="sticky top-0 z-10 -mx-5 mb-6 flex items-center justify-between gap-4 border-b border-line/70 bg-paper/70 px-5 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">{headerLeft}</div>
            <div className="flex shrink-0 items-center gap-3">
              {headerRight}
              <button
                onClick={handleSignOut}
                className="rounded-full border border-line bg-panel/70 px-3 py-1.5 text-xs font-medium text-ink-soft lg:hidden"
              >
                Sign out
              </button>
            </div>
          </header>
          <div className="flex gap-2 overflow-x-auto pb-4 lg:hidden">
            {items.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    active
                      ? "shrink-0 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand"
                      : "shrink-0 rounded-full bg-panel/70 px-3 py-1.5 text-xs font-medium text-ink-soft"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
