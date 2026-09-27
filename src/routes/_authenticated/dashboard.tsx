import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStudentHome } from "@/lib/exam.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "ড্যাশবোর্ড — Vigil Exam Hall" },
      { name: "description", content: "আপনার দৈনিক পরীক্ষা, সাম্প্রতিক ফলাফল ও নম্বর বন্টন এক নজরে।" },
      { property: "og:title", content: "ড্যাশবোর্ড — Vigil Exam Hall" },
      { property: "og:description", content: "আপনার দৈনিক পরীক্ষা, সাম্প্রতিক ফলাফল ও নম্বর বন্টন এক নজরে।" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchHome = useServerFn(getStudentHome);

  const { data, isLoading } = useQuery({
    queryKey: ["student-home"],
    queryFn: () => fetchHome(),
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
          <p className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">শিক্ষার্থী</p>
          <p className="mt-0.5 font-display text-sm font-semibold leading-none">
            {data?.profile.fullName || data?.profile.email || "স্বাগতম"}
          </p>
        </div>
      }
      headerRight={
        <span className="hidden rounded-full bg-panel/70 px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-black/5 sm:inline">
          +১ · −০.২৫ · ০
        </span>
      }
    >
      {isLoading ? (
        <p className="text-sm text-ink-soft">পরীক্ষা হল লোড হচ্ছে…</p>
      ) : (
        <div className="fade-up space-y-8">
          <section className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <div className="panel-glass rounded-2xl p-6 sm:p-8">
              {data?.currentExam ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
                      আজকের পরীক্ষা
                    </span>
                    <span className="text-xs text-ink-faint">{data.currentExam.questionCount}টি প্রশ্ন</span>
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
                      পরীক্ষা শুরু করুন
                    </Link>
                    <span className="text-xs text-ink-faint">কোনো সময়সীমা নেই · প্রস্তুত হলে জমা দিন</span>
                  </div>
                </>
              ) : (
                <>
                  <span className="rounded-full bg-amber-soft px-3 py-1 text-xs font-medium text-amber">
                    পরীক্ষা নেই
                  </span>
                  <h2 className="mt-5 font-display text-xl font-semibold leading-tight sm:text-2xl">
                    বর্তমানে কোনো পরীক্ষা নির্ধারিত নেই
                  </h2>
                  <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-soft">
                    এডমিন এখনও আজকের পরীক্ষা প্রকাশ করেননি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।
                  </p>
                </>
              )}
            </div>

            <aside className="panel-glass rounded-2xl p-5">
              <p className="font-display text-sm font-semibold">আপনার রেকর্ড</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">মোট পরীক্ষা</span>
                  <span className="font-semibold tabular-nums">{attempts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">গড় নম্বর</span>
                  <span className="font-semibold tabular-nums">{avgPercent}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">সর্বোচ্চ প্রাপ্তি</span>
                  <span className="font-semibold tabular-nums text-correct">{Math.round(best)}%</span>
                </div>
              </div>
            </aside>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-ink-faint">সাম্প্রতিক</p>
                <h3 className="mt-1 font-display text-2xl font-semibold leading-none">পূর্ববর্তী পরীক্ষাসমূহ</h3>
              </div>
              <Link to="/history" className="text-xs font-semibold text-brand">
                সবগুলো দেখুন
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="panel-glass rounded-2xl p-6 text-sm text-ink-soft">
                আপনি এখনও কোনো পরীক্ষা দেননি। আপনার ফলাফল এখানে দেখাবে।
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
                      {new Date(attempt.submittedAt).toLocaleDateString("bn-BD", {
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
