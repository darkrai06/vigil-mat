import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getStudentHome } from "@/lib/exam.functions";
import { claimFirstAdmin } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";
import { UnsolvedQuestions } from "@/components/UnsolvedQuestions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Vigil Exam Hall" },
      { name: "description", content: "Your daily exam, recent results and marking scheme in one place." },
      { property: "og:title", content: "Dashboard — Vigil Exam Hall" },
      { property: "og:description", content: "Your daily exam, recent results and marking scheme in one place." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchHome = useServerFn(getStudentHome);
  const claimAdmin = useServerFn(claimFirstAdmin);
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["student-home"],
    queryFn: () => fetchHome(),
  });

  const claim = useMutation({
    mutationFn: () => claimAdmin(),
    onSuccess: () => {
      toast.success("You are now the administrator.");
      refetch();
      navigate({ to: "/admin" });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not grant admin access."),
  });

  const recent = (data?.attempts ?? []).slice(0, 4);
  const attempts = data?.attempts ?? [];
  const avgPercent =
    attempts.length === 0
      ? 0
      : Math.round(
          (attempts.reduce((s, a) => s + (a.totalQuestions ? a.score / a.totalQuestions : 0), 0) / attempts.length) *
            100,
        );
  const best = attempts.reduce((m, a) => Math.max(m, a.totalQuestions ? (a.score / a.totalQuestions) * 100 : 0), 0);

  return (
    <AppShell
      showAdmin={data?.isAdmin}
      headerLeft={
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">Student</p>
          <p className="mt-0.5 font-display text-sm font-semibold leading-none">
            {data?.profile.fullName || data?.profile.email || "Welcome"}
          </p>
        </div>
      }
      headerRight={
        <span className="hidden rounded-full bg-panel/70 px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-black/5 sm:inline">
          +1 · −0.25 · 0
        </span>
      }
    >
      {isLoading ? (
        <p className="text-sm text-ink-soft">Loading your exam hall…</p>
      ) : (
        <div className="fade-up space-y-8">
          <section className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <div className="panel-glass rounded-2xl p-6 sm:p-8">
              {data?.currentExam ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
                      Today&apos;s exam
                    </span>
                    <span className="text-xs text-ink-faint">{data.currentExam.questionCount} questions · {data.currentExam.durationMinutes} min</span>
                  </div>
                  <h2 className="mt-5 max-w-[40ch] text-balance font-display text-xl font-semibold leading-tight sm:text-2xl">
                    {data.currentExam.title}
                  </h2>
                  {data.currentExam.description && (
                    <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-soft">
                      {data.currentExam.description}
                    </p>
                  )}
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      to="/exam/$examId"
                      params={{ examId: data.currentExam.id }}
                      className="rounded-[10px] bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90"
                    >
                      Start exam
                    </Link>
                    <span className="text-xs text-ink-faint">{data.currentExam.durationMinutes} minutes · timer starts when you enter the arena</span>
                  </div>
                </>
              ) : (
                <>
                  <span className="rounded-full bg-amber-soft px-3 py-1 text-xs font-medium text-amber">
                    No exam set
                  </span>
                  <h2 className="mt-5 font-display text-xl font-semibold leading-tight sm:text-2xl">
                    There is no exam scheduled right now
                  </h2>
                  <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-soft">
                    Your administrator has not marked a daily exam yet. Check back shortly.
                  </p>
                  {!data?.adminExists && (
                    <button
                      onClick={() => claim.mutate()}
                      disabled={claim.isPending}
                      className="mt-6 rounded-[10px] bg-ink px-5 py-2.5 text-sm font-semibold text-panel disabled:opacity-60"
                    >
                      {claim.isPending ? "Setting up…" : "Make me the administrator"}
                    </button>
                  )}
                </>
              )}
            </div>

            <aside className="panel-glass rounded-2xl p-5">
              <p className="font-display text-sm font-semibold">Your record</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">Attempts</span>
                  <span className="font-semibold tabular-nums">{attempts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">Average</span>
                  <span className="font-semibold tabular-nums">{avgPercent}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">Best</span>
                  <span className="font-semibold tabular-nums text-correct">{Math.round(best)}%</span>
                </div>
              </div>
            </aside>
          </section>

          <UnsolvedQuestions />

          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-ink-faint">Recent</p>
                <h3 className="mt-1 font-display text-2xl font-semibold leading-none">Past attempts</h3>
              </div>
              <Link to="/history" className="text-xs font-semibold text-brand">
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="panel-glass rounded-2xl p-6 text-sm text-ink-soft">
                You have not sat an exam yet. Your results will appear here.
              </div>
            ) : (
              <div className="panel-glass divide-y divide-line/70 rounded-2xl px-5">
                {recent.map((attempt) => (
                  <Link
                    key={attempt.id}
                    to="/results/$attemptId"
                    params={{ attemptId: attempt.id }}
                    className="flex items-center gap-4 py-3.5"
                  >
                    <span className="w-16 shrink-0 text-xs text-ink-faint">
                      {new Date(attempt.submittedAt).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{attempt.examTitle}</span>
                    <span className="hidden text-xs text-ink-faint sm:block">
                      {attempt.score} / {attempt.totalQuestions}
                    </span>
                    <span className="rounded-full bg-correct-soft px-2.5 py-1 text-xs font-semibold text-correct">
                      {attempt.totalQuestions
                        ? Math.round((attempt.score / attempt.totalQuestions) * 100)
                        : 0}
                      %
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
