import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listUnsolved, solveUnsolved, type UnsolvedQuestion } from "@/lib/unsolved.functions";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

type Result = { isCorrect: boolean; selectedAnswer: string; correctAnswer: string; explanation: string };

export function UnsolvedQuestions() {
  const fetchList = useServerFn(listUnsolved);
  const { data, isLoading } = useQuery({ queryKey: ["unsolved"], queryFn: () => fetchList() });
  // Keep solved cards visible until dismissed so the student can read the result.
  const [done, setDone] = useState<Record<string, { q: UnsolvedQuestion; r: Result }>>({});
  const qc = useQueryClient();

  const list = data ?? [];
  const solvedIds = Object.keys(done);
  const pending = list.filter((q) => !done[q.id]);

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-ink-faint">Practice</p>
          <h3 className="mt-1 font-display text-2xl font-semibold leading-none">Unsolved Questions</h3>
        </div>
        {pending.length > 0 && <span className="text-xs text-ink-faint">{pending.length} left</span>}
      </div>
      {isLoading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <div className="space-y-4">
          {solvedIds.map((id) => (
            <SolvedCard
              key={id}
              q={done[id].q}
              r={done[id].r}
              onDismiss={() => {
                setDone((d) => {
                  const n = { ...d };
                  delete n[id];
                  return n;
                });
                qc.invalidateQueries({ queryKey: ["unsolved"] });
              }}
            />
          ))}
          {pending.length === 0 && solvedIds.length === 0 && (
            <div className="panel-glass rounded-2xl p-6 text-sm text-ink-soft">
              No unsolved questions. You&apos;re all caught up!
            </div>
          )}
          {pending.map((q) => (
            <PendingCard key={q.id} q={q} onSolved={(r) => setDone((d) => ({ ...d, [q.id]: { q, r } }))} />
          ))}
        </div>
      )}
    </section>
  );
}

function PendingCard({ q, onSolved }: { q: UnsolvedQuestion; onSolved: (r: Result) => void }) {
  const solve = useServerFn(solveUnsolved);
  const [selected, setSelected] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => solve({ data: { id: q.id, answer: selected! } }),
    onSuccess: onSolved,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit."),
  });
  return (
    <div className="panel-glass rounded-2xl p-5">
      <p className="truncate text-xs font-semibold text-ink-faint">From: {q.examTitle}</p>
      <p className="mt-2 break-words font-display text-base font-semibold leading-snug">{q.prompt}</p>
      <div className="mt-4 grid gap-2">
        {q.options.map((o, i) => (
          <button
            key={o + i}
            type="button"
            onClick={() => setSelected(o)}
            className={
              selected === o
                ? "flex items-center gap-3 rounded-xl bg-brand-soft p-3 text-left ring-1 ring-brand/40"
                : "flex items-center gap-3 rounded-xl bg-panel p-3 text-left ring-1 ring-line hover:ring-brand/30"
            }
          >
            <span
              className={
                selected === o
                  ? "grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-semibold text-on-brand"
                  : "grid size-6 shrink-0 place-items-center rounded-full bg-paper text-[11px] font-semibold text-ink-soft"
              }
            >
              {LETTERS[i] ?? i + 1}
            </span>
            <span className="min-w-0 break-words text-sm text-ink-soft">{o}</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => m.mutate()}
        disabled={!selected || m.isPending}
        className="mt-4 w-full rounded-[10px] bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50 sm:w-auto"
      >
        {m.isPending ? "Submitting…" : "Submit Answer"}
      </button>
    </div>
  );
}

function SolvedCard({ q, r, onDismiss }: { q: UnsolvedQuestion; r: Result; onDismiss: () => void }) {
  return (
    <div className="panel-glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-semibold text-ink-faint">From: {q.examTitle}</p>
        <span
          className={
            r.isCorrect
              ? "shrink-0 rounded-full bg-correct-soft px-2.5 py-1 text-xs font-semibold text-correct"
              : "shrink-0 rounded-full bg-wrong-soft px-2.5 py-1 text-xs font-semibold text-wrong"
          }
        >
          {r.isCorrect ? "Correct" : "Wrong"}
        </span>
      </div>
      <p className="mt-2 break-words font-display text-base font-semibold leading-snug">{q.prompt}</p>
      <div className="mt-4 grid gap-2">
        {q.options.map((o, i) => {
          const isAnswer = o === r.correctAnswer;
          const isWrongPick = o === r.selectedAnswer && !isAnswer;
          return (
            <div
              key={o + i}
              className={
                isAnswer
                  ? "flex items-center gap-3 rounded-xl bg-correct-soft/70 p-3 ring-1 ring-correct/25"
                  : isWrongPick
                    ? "flex items-center gap-3 rounded-xl bg-wrong-soft/70 p-3 ring-1 ring-wrong/25"
                    : "flex items-center gap-3 rounded-xl bg-panel p-3 ring-1 ring-line"
              }
            >
              <span
                className={
                  isAnswer
                    ? "grid size-6 shrink-0 place-items-center rounded-full bg-correct text-[11px] font-semibold text-panel"
                    : isWrongPick
                      ? "grid size-6 shrink-0 place-items-center rounded-full bg-wrong text-[11px] font-semibold text-panel"
                      : "grid size-6 shrink-0 place-items-center rounded-full bg-paper text-[11px] font-semibold text-ink-soft"
                }
              >
                {LETTERS[i] ?? i + 1}
              </span>
              <span className="min-w-0 break-words text-sm text-ink-soft">{o}</span>
              {isAnswer && <span className="ml-auto shrink-0 text-[11px] font-semibold text-correct">Correct answer</span>}
              {isWrongPick && <span className="ml-auto shrink-0 text-[11px] font-semibold text-wrong">Your answer</span>}
            </div>
          );
        })}
      </div>
      {r.explanation && (
        <div className="mt-4 rounded-xl bg-paper/70 p-4 ring-1 ring-line">
          <p className="text-xs font-semibold text-ink">Explanation:</p>
          <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft">{r.explanation}</p>
        </div>
      )}
      <button onClick={onDismiss} className="mt-4 text-xs font-semibold text-brand">
        Done — remove from list
      </button>
    </div>
  );
}
