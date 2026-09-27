import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getExamForTaking, submitAttempt } from "@/lib/exam.functions";
import { AppShell } from "@/components/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/exam/$examId")({
  head: () => ({
    meta: [
      { title: "Exam in progress — Vigil Exam Hall" },
      { name: "description", content: "Answer sheet with question navigator and negative marking." },
      { property: "og:title", content: "Exam in progress — Vigil Exam Hall" },
      { property: "og:description", content: "Answer sheet with question navigator and negative marking." },
    ],
  }),
  component: ExamPage,
});

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function ExamPage() {
  const { examId } = Route.useParams();
  const navigate = useNavigate();
  const fetchExam = useServerFn(getExamForTaking);
  const submit = useServerFn(submitAttempt);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => fetchExam({ data: { examId } }),
  });

  const submission = useMutation({
    mutationFn: () => submit({ data: { examId, answers } }),
    onSuccess: (result) => {
      navigate({ to: "/results/$attemptId", params: { attemptId: result.attemptId }, replace: true });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not submit your exam."),
  });

  if (isLoading || !data) {
    return (
      <AppShell headerLeft={<p className="text-sm text-ink-soft">Preparing your answer sheet…</p>}>
        <p className="text-sm text-ink-soft">Loading questions…</p>
      </AppShell>
    );
  }

  const questions = data.questions;
  const current = questions[index];
  const answeredCount = questions.filter((q) => answers[q.id]).length;

  return (
    <AppShell
      headerLeft={
        <div className="flex items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-ink font-display text-xs font-semibold text-panel">
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold leading-none">
              Question {index + 1} / {questions.length}
            </p>
            <p className="mt-1 truncate text-xs text-ink-faint">{data.exam.title}</p>
          </div>
        </div>
      }
      headerRight={
        <div className="hidden items-center gap-2 rounded-full bg-panel/70 px-3 py-1.5 ring-1 ring-black/5 sm:flex">
          <span className="size-2 rounded-full bg-correct" />
          <span className="text-xs font-medium text-ink-soft">
            {answeredCount} answered · {questions.length - answeredCount} left
          </span>
        </div>
      }
    >
      <section className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="fade-up panel-glass rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">Single correct</span>
            <span className="text-xs text-ink-faint">+1 · −0.25</span>
          </div>
          <h2 className="mt-5 max-w-[40ch] text-balance font-display text-xl font-semibold leading-tight sm:text-2xl">
            {current?.prompt}
          </h2>

          <div className="mt-6 grid gap-3">
            {current?.options.map((option, optionIndex) => {
              const selected = answers[current.id] === option;
              return (
                <button
                  key={option + optionIndex}
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [current.id]: prev[current.id] === option ? null : option }))
                  }
                  className={
                    selected
                      ? "flex w-full items-center gap-4 rounded-xl bg-brand-soft p-4 text-left ring-1 ring-brand/30"
                      : "flex w-full items-center gap-4 rounded-xl bg-panel p-4 text-left ring-1 ring-line transition-colors hover:bg-paper"
                  }
                >
                  <span
                    className={
                      selected
                        ? "grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-on-brand"
                        : "grid size-7 shrink-0 place-items-center rounded-full bg-paper text-xs font-semibold text-ink-soft"
                    }
                  >
                    {LETTERS[optionIndex] ?? optionIndex + 1}
                  </span>
                  <span className={selected ? "text-sm font-medium text-ink" : "text-sm text-ink-soft"}>{option}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="rounded-[10px] px-4 py-2.5 text-sm font-medium text-ink-soft disabled:opacity-40"
            >
              Previous
            </button>
            <div className="flex items-center gap-2">
              {current && answers[current.id] && (
                <button
                  onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: null }))}
                  className="rounded-[10px] px-3 py-2.5 text-sm font-medium text-ink-faint"
                >
                  Clear
                </button>
              )}
              {index < questions.length - 1 ? (
                <button
                  onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                  className="rounded-[10px] bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90"
                >
                  Next question
                </button>
              ) : (
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="rounded-[10px] bg-ink px-5 py-2.5 text-sm font-semibold text-panel"
                >
                  Submit exam
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="panel-glass h-fit rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-semibold">Navigator</p>
            <span className="text-xs text-ink-faint">
              {index + 1} of {questions.length}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {questions.map((q, i) => {
              const isCurrent = i === index;
              const isAnswered = Boolean(answers[q.id]);
              return (
                <button
                  key={q.id}
                  onClick={() => setIndex(i)}
                  className={
                    isCurrent
                      ? "grid aspect-square place-items-center rounded-[8px] bg-ink text-xs font-semibold text-panel ring-2 ring-brand/40"
                      : isAnswered
                        ? "grid aspect-square place-items-center rounded-[8px] bg-correct text-xs font-semibold text-panel"
                        : "grid aspect-square place-items-center rounded-[8px] bg-paper text-xs font-semibold text-ink-faint ring-1 ring-line"
                  }
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-faint">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-correct" />
              Answered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-ink" />
              Current
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-paper ring-1 ring-line" />
              Pending
            </span>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            className="mt-5 w-full rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-panel"
          >
            Submit exam
          </button>
        </aside>
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your exam?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} of {questions.length} questions.{" "}
              {questions.length - answeredCount > 0
                ? `${questions.length - answeredCount} will be left unanswered and score zero.`
                : "Every question has an answer."}{" "}
              You cannot change your answers after submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction onClick={() => submission.mutate()} disabled={submission.isPending}>
              {submission.isPending ? "Submitting…" : "Submit exam"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
