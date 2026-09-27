import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAttemptReview } from "@/lib/exam.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/results/$attemptId")({
  head: () => ({
    meta: [
      { title: "পরীক্ষার ফলাফল — Vigil Exam Hall" },
      { name: "description", content: "আপনার প্রতিটি প্রশ্ন, আপনার দেওয়া উত্তর ও সঠিক উত্তর সহ মার্ককৃত ফলাফল।" },
      { property: "og:title", content: "পরীক্ষার ফলাফল — Vigil Exam Hall" },
      {
        property: "og:description",
        content: "আপনার প্রতিটি প্রশ্ন, আপনার দেওয়া উত্তর ও সঠিক উত্তর সহ মার্ককৃত ফলাফল।",
      },
    ],
  }),
  component: ResultsPage,
});

const LETTERS = ["ক", "খ", "গ", "ঘ", "ঙ", "চ", "ছ", "জ"];

function ResultsPage() {
  const { attemptId } = Route.useParams();
  const fetchReview = useServerFn(getAttemptReview);

  const { data, isLoading } = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => fetchReview({ data: { attemptId } }),
  });

  if (isLoading || !data) {
    return (
      <AppShell headerLeft={<p className="text-sm text-ink-soft">উত্তরপত্র মূল্যায়ন করা হচ্ছে…</p>}>
        <p className="text-sm text-ink-soft">আপনার ফলাফল লোড হচ্ছে…</p>
      </AppShell>
    );
  }

  const { attempt, questions } = data;
  const percent = attempt.totalQuestions ? Math.round((attempt.score / attempt.totalQuestions) * 100) : 0;

  return (
    <AppShell
      headerLeft={
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">ফলাফল পর্যালোচনা</p>
          <p className="mt-0.5 truncate font-display text-sm font-semibold leading-none">{attempt.examTitle}</p>
        </div>
      }
      headerRight={
        <Link to="/dashboard" className="text-xs font-semibold text-brand">
          ড্যাশবোর্ডে ফিরে যান
        </Link>
      }
    >
      <div className="fade-up space-y-8">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="panel-glass rounded-2xl p-5">
            <p className="text-xs text-ink-faint">সর্বমোট নম্বর</p>
            <p className="mt-2 font-display text-3xl font-semibold leading-none">
              {attempt.score}
              <span className="text-base text-ink-faint"> / {attempt.totalQuestions}</span>
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              {percent}% · {new Date(attempt.submittedAt).toLocaleString("bn-BD")}
            </p>
          </div>
          <div className="panel-glass rounded-2xl p-5">
            <p className="text-xs text-ink-faint">ফলাফলের বিস্তারিত</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-correct" />
                  সঠিক উত্তর
                </span>
                <span className="font-semibold tabular-nums">{attempt.correctCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-wrong" />
                  ভুল উত্তর
                </span>
                <span className="font-semibold tabular-nums">{attempt.wrongCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-amber" />
                  উত্তর দেওয়া হয়নি
                </span>
                <span className="font-semibold tabular-nums">{attempt.unansweredCount}</span>
              </div>
            </div>
          </div>
          <div className="panel-glass rounded-2xl p-5">
            <p className="text-xs text-ink-faint">মার্কিং নিয়ম</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>সঠিক</span>
                <span className="font-semibold text-correct">+১.০০</span>
              </div>
              <div className="flex items-center justify-between">
                <span>ভুল</span>
                <span className="font-semibold text-wrong">−০.২৫</span>
              </div>
              <div className="flex items-center justify-between">
                <span>উত্তর না দিলে</span>
                <span className="font-semibold text-ink-soft">০.০০</span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-display text-2xl font-semibold leading-none">প্রশ্নোত্তর পর্যালোচনা</h3>
          {questions.map((q) => {
            const state = q.selectedAnswer === null ? "skipped" : q.selectedAnswer === q.correctAnswer ? "correct" : "wrong";
            return (
              <div key={q.id} className="panel-glass rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-ink-faint">প্রশ্ন {q.position}</span>
                  <span
                    className={
                      state === "correct"
                        ? "rounded-full bg-correct-soft px-2.5 py-1 text-xs font-semibold text-correct"
                        : state === "wrong"
                          ? "rounded-full bg-wrong-soft px-2.5 py-1 text-xs font-semibold text-wrong"
                          : "rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-amber"
                    }
                  >
                    {state === "correct" ? "সঠিক · +১.০০" : state === "wrong" ? "ভুল · −০.২৫" : "উত্তর দেওয়া হয়নি · ০.০০"}
                  </span>
                </div>
                <p className="mt-3 max-w-[60ch] font-display text-base font-semibold leading-snug">{q.prompt}</p>
                <div className="mt-4 grid gap-2">
                  {q.options.map((option, i) => {
                    const isCorrect = option === q.correctAnswer;
                    const isSelectedWrong = option === q.selectedAnswer && !isCorrect;
                    return (
                      <div
                        key={option + i}
                        className={
                          isCorrect
                            ? "flex items-center gap-3 rounded-xl bg-correct-soft/70 p-3 ring-1 ring-correct/25"
                            : isSelectedWrong
                              ? "flex items-center gap-3 rounded-xl bg-wrong-soft/70 p-3 ring-1 ring-wrong/25"
                              : "flex items-center gap-3 rounded-xl bg-panel p-3 ring-1 ring-line"
                        }
                      >
                        <span
                          className={
                            isCorrect
                              ? "grid size-6 shrink-0 place-items-center rounded-full bg-correct text-[11px] font-semibold text-panel"
                              : isSelectedWrong
                                ? "grid size-6 shrink-0 place-items-center rounded-full bg-wrong text-[11px] font-semibold text-panel"
                                : "grid size-6 shrink-0 place-items-center rounded-full bg-paper text-[11px] font-semibold text-ink-soft"
                          }
                        >
                          {LETTERS[i] ?? i + 1}
                        </span>
                        <span className="text-sm text-ink-soft">{option}</span>
                        {isCorrect && <span className="ml-auto text-[11px] font-semibold text-correct">সঠিক উত্তর</span>}
                        {isSelectedWrong && (
                          <span className="ml-auto text-[11px] font-semibold text-wrong">আপনার উত্তর</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {state === "skipped" && (
                  <p className="mt-3 text-xs font-medium text-amber">আপনি এই প্রশ্নটির কোনো উত্তর দেননি।</p>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
