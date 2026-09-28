import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getExamForTaking,
  saveSessionAnswers,
  startExamSession,
  submitAttempt,
  type PublicQuestion,
} from "@/lib/exam.functions";
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
      { title: "Exam arena — Vigil Exam Hall" },
      { name: "description", content: "Timed answer sheet with question navigator and negative marking." },
      { property: "og:title", content: "Exam arena — Vigil Exam Hall" },
      { property: "og:description", content: "Timed answer sheet with question navigator and negative marking." },
    ],
  }),
  component: ExamPage,
});

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

type Session = { id: string; deadline: string; answers: Record<string, string | null> };

function formatTime(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function ExamPage() {
  const { examId } = Route.useParams();
  const navigate = useNavigate();
  const fetchExam = useServerFn(getExamForTaking);
  const startSession = useServerFn(startExamSession);
  const saveAnswers = useServerFn(saveSessionAnswers);
  const submit = useServerFn(submitAttempt);

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [clockOffset, setClockOffset] = useState(0); // serverNow - clientNow
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const { data, isLoading, error } = useQuery({
    queryKey: ["exam-lobby", examId],
    queryFn: () => fetchExam({ data: { examId } }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  function applySession(s: Session, qs: PublicQuestion[], serverNow: string) {
    setClockOffset(new Date(serverNow).getTime() - Date.now());
    setSession(s);
    setQuestions(qs);
    setAnswers(s.answers ?? {});
  }

  useEffect(() => {
    if (!data) return;
    if (data.expiredAttemptId) {
      toast.info("Your previous exam time ran out and was submitted automatically.");
      navigate({ to: "/results/$attemptId", params: { attemptId: data.expiredAttemptId }, replace: true });
      return;
    }
    if (data.session) applySession(data.session, data.questions, data.serverNow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const enter = useMutation({
    mutationFn: () => startSession({ data: { examId } }),
    onSuccess: (r) => applySession(r.session, r.questions, r.serverNow),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start the exam."),
  });

  const submission = useMutation({
    mutationFn: () => submit({ data: { sessionId: session!.id, answers: answersRef.current } }),
    onSuccess: (result) => {
      navigate({ to: "/results/$attemptId", params: { attemptId: result.attemptId }, replace: true });
    },
    onError: (e) => {
      submittedRef.current = false;
      toast.error(e instanceof Error ? e.message : "Could not submit your exam.");
    },
  });

  const doSubmit = useCallback(() => {
    if (submittedRef.current || !session) return;
    submittedRef.current = true;
    setLocked(true);
    submission.mutate();
  }, [session, submission]);

  // Countdown against the server deadline.
  useEffect(() => {
    if (!session) return;
    const deadline = new Date(session.deadline).getTime();
    const tick = () => {
      const left = deadline - (Date.now() + clockOffset);
      setRemaining(left);
      if (left <= 0 && !submittedRef.current) {
        setConfirmOpen(false);
        toast.warning("Time is up. Submitting your exam…");
        doSubmit();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [session, clockOffset, doSubmit]);

  // Autosave answers so a refresh keeps them.
  useEffect(() => {
    if (!session || locked) return;
    const id = window.setTimeout(() => {
      saveAnswers({ data: { sessionId: session.id, answers } }).catch(() => {});
    }, 600);
    return () => window.clearTimeout(id);
  }, [answers, session, locked, saveAnswers]);

  if (error) {
    return (
      <AppShell headerLeft={<p className="text-sm text-ink-soft">Exam unavailable</p>}>
        <p className="text-sm text-ink-soft">{error instanceof Error ? error.message : "This exam is not available."}</p>
      </AppShell>
    );
  }

  if (isLoading || !data) {
    return (
      <AppShell headerLeft={<p className="text-sm text-ink-soft">Preparing your answer sheet…</p>}>
        <p className="text-sm text-ink-soft">Loading…</p>
      </AppShell>
    );
  }

  // Lobby: timer has not started.
  if (!session) {
    return (
      <AppShell
        headerLeft={
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">Exam lobby</p>
            <p className="mt-0.5 truncate font-display text-sm font-semibold leading-none">{data.exam.title}</p>
          </div>
        }
      >
        <div className="fade-up panel-glass mx-auto max-w-2xl rounded-2xl p-6 sm:p-8">
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">Before you begin</span>
          <h2 className="mt-5 text-balance font-display text-2xl font-semibold leading-tight">{data.exam.title}</h2>
          {data.exam.description && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{data.exam.description}</p>}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-paper/70 p-4">
              <p className="text-xs text-ink-faint">Questions</p>
              <p className="mt-1 font-display text-2xl font-semibold">{data.exam.questionCount}</p>
            </div>
            <div className="rounded-xl bg-paper/70 p-4">
              <p className="text-xs text-ink-faint">Time</p>
              <p className="mt-1 font-display text-2xl font-semibold">{data.exam.durationMinutes} min</p>
            </div>
            <div className="rounded-xl bg-paper/70 p-4">
              <p className="text-xs text-ink-faint">Marking</p>
              <p className="mt-1 font-display text-2xl font-semibold">+1 / −0.25</p>
            </div>
          </div>
          <ul className="mt-6 space-y-2 text-sm text-ink-soft">
            <li>• The timer starts the moment you enter the arena and keeps running if you leave or refresh.</li>
            <li>• When time reaches 00:00 your exam is submitted automatically.</li>
            <li>• Unanswered questions score zero; wrong answers lose 0.25.</li>
          </ul>
          <button
            onClick={() => enter.mutate()}
            disabled={enter.isPending}
            className="mt-8 w-full rounded-[10px] bg-brand px-5 py-3 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90 disabled:opacity-60 sm:w-auto"
          >
            {enter.isPending ? "Opening the arena…" : "Enter Exam Arena"}
          </button>
        </div>
      </AppShell>
    );
  }

  const current = questions[index];
  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const left = remaining ?? 0;
  const critical = left <= 60_000;
  const warning = !critical && left <= 5 * 60_000;
  const disabled = locked || left <= 0;

  const timerClass = critical
    ? "flex items-center gap-2 rounded-full bg-wrong px-3 py-1.5 text-panel animate-pulse"
    : warning
      ? "flex items-center gap-2 rounded-full bg-amber px-3 py-1.5 text-panel"
      : "flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-panel";

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
            <p className="mt-1 truncate text-xs text-ink-faint">
              {answeredCount} answered · {questions.length - answeredCount} left
            </p>
          </div>
        </div>
      }
      headerRight={
        <div className={timerClass} aria-live="polite">
          <span className="hidden text-[11px] font-medium opacity-80 sm:inline">Time remaining</span>
          <span className="font-display text-sm font-semibold tabular-nums">{formatTime(left)}</span>
        </div>
      }
    >
      {warning && !disabled && (
        <div className="mb-4 rounded-xl bg-amber-soft px-4 py-2.5 text-sm font-medium text-amber">
          Less than 5 minutes left. Review your answers.
        </div>
      )}
      {critical && !disabled && (
        <div className="mb-4 rounded-xl bg-wrong-soft px-4 py-2.5 text-sm font-semibold text-wrong">
          Under a minute remaining — your exam will submit automatically at 00:00.
        </div>
      )}
      {disabled && (
        <div className="mb-4 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-panel">
          Answers are locked. Submitting your exam…
        </div>
      )}

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
                  disabled={disabled}
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [current.id]: prev[current.id] === option ? null : option }))
                  }
                  className={
                    selected
                      ? "flex w-full items-center gap-4 rounded-xl bg-brand-soft p-4 text-left ring-1 ring-brand/30 disabled:opacity-70"
                      : "flex w-full items-center gap-4 rounded-xl bg-panel p-4 text-left ring-1 ring-line transition-colors hover:bg-paper disabled:opacity-60"
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
              {current && answers[current.id] && !disabled && (
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
                  disabled={disabled}
                  className="rounded-[10px] bg-ink px-5 py-2.5 text-sm font-semibold text-panel disabled:opacity-60"
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
            disabled={disabled}
            className="mt-5 w-full rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-panel disabled:opacity-60"
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
              You have answered {answeredCount} of {questions.length} questions with {formatTime(left)} remaining.{" "}
              {questions.length - answeredCount > 0
                ? `${questions.length - answeredCount} will be left unanswered and score zero.`
                : "Every question has an answer."}{" "}
              You cannot change your answers after submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction onClick={doSubmit} disabled={submission.isPending}>
              {submission.isPending ? "Submitting…" : "Submit exam"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
