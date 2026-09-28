import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAttemptReview } from "@/lib/exam.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/results/$attemptId")({
  head: () => ({
    meta: [
      { title: "Exam result — Vigil Exam Hall" },
      { name: "description", content: "Your marked exam with every question, your answer and the correct answer." },
      { property: "og:title", content: "Exam result — Vigil Exam Hall" },
      {
        property: "og:description",
        content: "Your marked exam with every question, your answer and the correct answer.",
      },
    ],
  }),
  component: ResultsPage,
});

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function ResultsPage() {
  const { attemptId } = Route.useParams();
  const fetchReview = useServerFn(getAttemptReview);

  const { data, isLoading } = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => fetchReview({ data: { attemptId } }),
  });

  if (isLoading || !data) {
    return (
      <AppShell headerLeft={<p className="text-sm text-ink-soft">Marking your paper…</p>}>
        <p className="text-sm text-ink-soft">Loading your result…</p>
      </AppShell>
    );
  }

  const { attempt, questions } = data;
  const percent = attempt.totalQuestions ? Math.round((attempt.score / attempt.totalQuestions) * 100) : 0;

  return (
    <AppShell
      headerLeft={
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">Results review</p>
          <p className="mt-0.5 truncate font-display text-sm font-semibold leading-none">{attempt.examTitle}</p>
        </div>
      }
      headerRight={
        <Link to="/dashboard" className="text-xs font-semibold text-brand">
          Back to dashboard
        </Link>
      }
    >
      <div className="fade-up space-y-8">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="panel-glass rounded-2xl p-5">
            <p className="text-xs text-ink-faint">Final score</p>
            <p className="mt-2 font-display text-3xl font-semibold leading-none">
              {attempt.score}
              <span className="text-base text-ink-faint"> / {attempt.totalQuestions}</span>
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              {percent}% · {new Date(attempt.submittedAt).toLocaleString()}
            </p>
          </div>
          <div className="panel-glass rounded-2xl p-5">
            <p className="text-xs text-ink-faint">Breakdown</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-correct" />
                  Correct
                </span>
                <span className="font-semibold tabular-nums">{attempt.correctCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-wrong" />
                  Wrong
                </span>
                <span className="font-semibold tabular-nums">{attempt.wrongCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-amber" />
                  Unanswered
                </span>
                <span className="font-semibold tabular-nums">{attempt.unansweredCount}</span>
              </div>
            </div>
          </div>
          <div className="panel-glass rounded-2xl p-5">
            <p className="text-xs text-ink-faint">Marking</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Correct</span>
                <span className="font-semibold text-correct">+1.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Wrong</span>
                <span className="font-semibold text-wrong">−0.25</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Unanswered</span>
                <span className="font-semibold text-ink-soft">0.00</span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-display text-2xl font-semibold leading-none">Question by question</h3>
          {questions.map((q) => {
            const state = q.selectedAnswer === null ? "skipped" : q.selectedAnswer === q.correctAnswer ? "correct" : "wrong";
            return (
              <div key={q.id} className="panel-glass rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-ink-faint">Question {q.position}</span>
                  <span
                    className={
                      state === "correct"
                        ? "rounded-full bg-correct-soft px-2.5 py-1 text-xs font-semibold text-correct"
                        : state === "wrong"
                          ? "rounded-full bg-wrong-soft px-2.5 py-1 text-xs font-semibold text-wrong"
                          : "rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-amber"
                    }
                  >
                    {state === "correct" ? "Correct · +1.00" : state === "wrong" ? "Wrong · −0.25" : "Not answered · 0.00"}
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
                        {isCorrect && <span className="ml-auto text-[11px] font-semibold text-correct">Correct answer</span>}
                        {isSelectedWrong && (
                          <span className="ml-auto text-[11px] font-semibold text-wrong">Your answer</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {state === "skipped" && (
                  <p className="mt-3 text-xs font-medium text-amber">You did not answer this question.</p>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
