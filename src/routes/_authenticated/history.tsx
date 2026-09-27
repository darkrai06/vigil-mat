import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStudentHome } from "@/lib/exam.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "পরীক্ষার ইতিহাস — Vigil Exam Hall" },
      { name: "description", content: "আপনার দেওয়া প্রতিটি পরীক্ষা, প্রাপ্ত নম্বর ও বিস্তারিত উত্তর পর্যালোচনা।" },
      { property: "og:title", content: "পরীক্ষার ইতিহাস — Vigil Exam Hall" },
      { property: "og:description", content: "আপনার দেওয়া প্রতিটি পরীক্ষা, প্রাপ্ত নম্বর ও বিস্তারিত উত্তর পর্যালোচনা।" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const fetchHome = useServerFn(getStudentHome);
  const { data, isLoading } = useQuery({ queryKey: ["student-home"], queryFn: () => fetchHome() });
  const attempts = data?.attempts ?? [];

  return (
    <AppShell
      showAdmin={data?.isAdmin}
      headerLeft={
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">শিক্ষার্থী</p>
          <p className="mt-0.5 font-display text-sm font-semibold leading-none">পরীক্ষার ইতিহাস</p>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-ink-soft">ইতিহাস লোড হচ্ছে…</p>
      ) : attempts.length === 0 ? (
        <div className="panel-glass rounded-2xl p-6 text-sm text-ink-soft">
          আপনি এখনও কোনো পরীক্ষা দেননি। পরীক্ষা দেওয়ার পর আপনার ফলাফল এখানে স্থায়ীভাবে সংরক্ষিত থাকবে।
        </div>
      ) : (
        <div className="fade-up grid gap-3">
          {attempts.map((attempt) => (
            <Link
              key={attempt.id}
              to="/results/$attemptId"
              params={{ attemptId: attempt.id }}
              className="panel-glass rounded-2xl p-5 transition-colors hover:bg-panel"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold leading-tight">{attempt.examTitle}</p>
                  <p className="mt-1 text-xs text-ink-faint">{new Date(attempt.submittedAt).toLocaleString("bn-BD")}</p>
                </div>
                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                  {attempt.score} / {attempt.totalQuestions}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                <span className="text-ink-soft">
                  প্রশ্ন <span className="font-semibold text-ink tabular-nums">{attempt.totalQuestions}টি</span>
                </span>
                <span className="text-correct">
                  সঠিক <span className="font-semibold tabular-nums">{attempt.correctCount}</span>
                </span>
                <span className="text-wrong">
                  ভুল <span className="font-semibold tabular-nums">{attempt.wrongCount}</span>
                </span>
                <span className="text-amber">
                  উত্তর না দেওয়া <span className="font-semibold tabular-nums">{attempt.unansweredCount}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
