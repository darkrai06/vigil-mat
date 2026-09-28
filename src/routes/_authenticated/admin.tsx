import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteExam,
  examUploadSchema,
  getAdminOverview,
  getExamQuestions,
  getStudentPerformance,
  publishExam,
  updateExam,
  type ExamUpload,
} from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — Vigil Exam Hall" },
      { name: "description", content: "Upload JSON exams, manage the daily exam and review student performance." },
      { property: "og:title", content: "Admin console — Vigil Exam Hall" },
      { property: "og:description", content: "Upload JSON exams, manage the daily exam and review student performance." },
    ],
  }),
  component: AdminPage,
});

type Tab = "exams" | "upload" | "students" | "activity";

const SAMPLE = `{
  "title": "Daily MCQ Exam - September 27",
  "time": 30,
  "questions": [
    {
      "question": "What is the capital of Bangladesh?",
      "options": ["Chittagong", "Dhaka", "Rajshahi", "Sylhet"],
      "correctAnswer": "Dhaka"
    }
  ]
}`;

function AdminPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const [tab, setTab] = useState<Tab>("exams");
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fetchOverview() });

  const tabs: { id: Tab; label: string }[] = [
    { id: "exams", label: "Exam management" },
    { id: "upload", label: "JSON upload" },
    { id: "students", label: "Student performance" },
    { id: "activity", label: "Recent submissions" },
  ];

  return (
    <AppShell
      showAdmin
      headerLeft={
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">Admin</p>
          <p className="mt-0.5 font-display text-sm font-semibold leading-none">Console</p>
        </div>
      }
    >
      {error ? (
        <div className="panel-glass rounded-2xl p-6 text-sm text-ink-soft">
          {error instanceof Error ? error.message : "Admin access required."}
        </div>
      ) : isLoading || !data ? (
        <p className="text-sm text-ink-soft">Loading console…</p>
      ) : (
        <div className="fade-up space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Students" value={data.stats.students} />
            <Stat label="Submissions" value={data.stats.attempts} />
            <Stat label="Average score" value={`${data.stats.avgPercent}%`} />
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  tab === t.id
                    ? "shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-panel"
                    : "shrink-0 rounded-full bg-panel/70 px-4 py-2 text-xs font-medium text-ink-soft ring-1 ring-line"
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "exams" && <ExamsTab exams={data.exams} />}
          {tab === "upload" && <UploadTab onDone={() => setTab("exams")} />}
          {tab === "students" && <StudentsTab />}
          {tab === "activity" && (
            <div className="panel-glass divide-y divide-line/70 rounded-2xl px-5">
              {data.recentAttempts.length === 0 && <p className="py-5 text-sm text-ink-soft">No submissions yet.</p>}
              {data.recentAttempts.map((a) => (
                <Link
                  key={a.id}
                  to="/results/$attemptId"
                  params={{ attemptId: a.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.studentName}</span>
                  <span className="text-xs text-ink-faint">{a.examTitle}</span>
                  <span className="text-xs text-ink-faint">{new Date(a.submittedAt).toLocaleString()}</span>
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                    {a.score} / {a.totalQuestions}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel-glass rounded-2xl p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

type AdminExam = Awaited<ReturnType<typeof getAdminOverview>>["exams"][number];

function ExamsTab({ exams }: { exams: AdminExam[] }) {
  if (exams.length === 0)
    return <div className="panel-glass rounded-2xl p-6 text-sm text-ink-soft">No exams yet. Use the JSON upload tab.</div>;
  return (
    <div className="grid gap-3">
      {exams.map((e) => (
        <ExamRow key={e.id} exam={e} />
      ))}
    </div>
  );
}

function ExamRow({ exam }: { exam: AdminExam }) {
  const qc = useQueryClient();
  const update = useServerFn(updateExam);
  const remove = useServerFn(deleteExam);
  const loadQuestions = useServerFn(getExamQuestions);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(exam.title);
  const [minutes, setMinutes] = useState(String(exam.durationMinutes));
  const [showQuestions, setShowQuestions] = useState(false);

  const questions = useQuery({
    queryKey: ["admin-questions", exam.id],
    queryFn: () => loadQuestions({ data: { examId: exam.id } }),
    enabled: showQuestions,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-overview"] });
  const mut = useMutation({
    mutationFn: (patch: Parameters<typeof update>[0]["data"]) => update({ data: patch }),
    onSuccess: () => {
      refresh();
      setEditing(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed."),
  });
  const del = useMutation({
    mutationFn: () => remove({ data: { examId: exam.id } }),
    onSuccess: () => {
      toast.success("Exam deleted.");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed."),
  });

  return (
    <div className="panel-glass rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-wrap gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-w-0 flex-1 rounded-[10px] border border-line bg-panel px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-24 rounded-[10px] border border-line bg-panel px-3 py-2 text-sm"
                aria-label="Minutes"
              />
            </div>
          ) : (
            <>
              <p className="truncate font-display text-base font-semibold">{exam.title}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {exam.questionCount} questions · {exam.durationMinutes} min · {new Date(exam.createdAt).toLocaleDateString()}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exam.isCurrent && (
            <span className="rounded-full bg-correct-soft px-2.5 py-1 text-xs font-semibold text-correct">Daily exam</span>
          )}
          <span
            className={
              exam.isPublished
                ? "rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand"
                : "rounded-full bg-paper px-2.5 py-1 text-xs font-semibold text-ink-faint ring-1 ring-line"
            }
          >
            {exam.isPublished ? "Published" : "Hidden"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {editing ? (
          <>
            <Btn
              onClick={() =>
                mut.mutate({ examId: exam.id, title: title.trim() || exam.title, durationMinutes: Number(minutes) })
              }
              primary
            >
              Save
            </Btn>
            <Btn onClick={() => setEditing(false)}>Cancel</Btn>
          </>
        ) : (
          <>
            {!exam.isCurrent && (
              <Btn primary onClick={() => mut.mutate({ examId: exam.id, isCurrent: true, isPublished: true })}>
                Set as daily exam
              </Btn>
            )}
            <Btn onClick={() => mut.mutate({ examId: exam.id, isPublished: !exam.isPublished })}>
              {exam.isPublished ? "Unpublish" : "Publish"}
            </Btn>
            <Btn onClick={() => setEditing(true)}>Edit</Btn>
            <Btn onClick={() => setShowQuestions((s) => !s)}>{showQuestions ? "Hide questions" : "View questions"}</Btn>
            <Btn
              danger
              onClick={() => {
                if (confirm(`Delete "${exam.title}" and all its results?`)) del.mutate();
              }}
            >
              Delete
            </Btn>
          </>
        )}
      </div>

      {showQuestions && (
        <div className="mt-4 space-y-2">
          {questions.isLoading && <p className="text-xs text-ink-faint">Loading…</p>}
          {questions.data?.map((q) => (
            <div key={q.id} className="rounded-xl bg-paper/70 p-3 text-sm">
              <p className="font-medium">
                {q.position}. {q.prompt}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {q.options.join(" · ")} — <span className="font-semibold text-correct">{q.correctAnswer}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Btn({
  children,
  onClick,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const cls = primary
    ? "rounded-[10px] bg-brand px-3 py-2 text-on-brand"
    : danger
      ? "rounded-[10px] bg-wrong-soft px-3 py-2 text-wrong"
      : "rounded-[10px] bg-panel px-3 py-2 text-ink-soft ring-1 ring-line";
  return (
    <button onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

function validate(text: string): { exam: ExamUpload | null; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { exam: null, errors: [`Invalid JSON: ${e instanceof Error ? e.message : "could not parse"}`] };
  }
  const parsed = examUploadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      exam: null,
      errors: parsed.error.issues.map((i) => {
        const path = i.path
          .map((p) => (typeof p === "number" ? `#${p + 1}` : p))
          .join(" › ");
        return `${path || "root"}: ${i.message}`;
      }),
    };
  }
  const errors: string[] = [];
  parsed.data.questions.forEach((q, i) => {
    if (!q.options.includes(q.correctAnswer))
      errors.push(`questions › #${i + 1}: correctAnswer "${q.correctAnswer}" does not match any option`);
    if (new Set(q.options).size !== q.options.length) errors.push(`questions › #${i + 1}: options contain duplicates`);
  });
  return { exam: errors.length ? null : parsed.data, errors };
}

function UploadTab({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const publish = useServerFn(publishExam);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ exam: ExamUpload | null; errors: string[] } | null>(null);
  const [setCurrent, setSetCurrent] = useState(true);

  const mut = useMutation({
    mutationFn: () => publish({ data: { payload: JSON.parse(text), setCurrent } }),
    onSuccess: () => {
      toast.success("Exam published.");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      setText("");
      setResult(null);
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Publish failed."),
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("File is larger than 2MB.");
    const content = await file.text();
    setText(content);
    setResult(validate(content));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="panel-glass space-y-4 rounded-2xl p-5">
        <p className="font-display text-sm font-semibold">Upload exam JSON</p>
        <label className="grid cursor-pointer place-items-center rounded-xl border border-dashed border-line bg-paper/60 px-4 py-8 text-center">
          <span className="text-xs font-medium text-ink-soft">Choose a .json file</span>
          <span className="mt-1 text-[11px] text-ink-faint">Max 2MB · must include "time" in minutes</span>
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          placeholder={SAMPLE}
          rows={10}
          className="w-full rounded-xl border border-line bg-panel p-3 font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setResult(validate(text))}
            disabled={!text.trim()}
            className="rounded-[10px] bg-ink px-4 py-2 text-xs font-semibold text-panel disabled:opacity-50"
          >
            Validate
          </button>
          <button onClick={() => setText(SAMPLE)} className="text-xs font-semibold text-brand">
            Load sample
          </button>
        </div>
        {result && result.errors.length > 0 && (
          <div className="rounded-xl bg-wrong-soft/70 p-3 ring-1 ring-wrong/20">
            <p className="text-xs font-semibold text-wrong">Validation failed ({result.errors.length})</p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-[11px] text-ink-soft">
              {result.errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          </div>
        )}
        {result?.exam && (
          <div className="rounded-xl bg-correct-soft/70 p-3 ring-1 ring-correct/20">
            <p className="text-xs font-semibold text-correct">Validation passed</p>
            <p className="mt-1 text-[11px] text-ink-soft">
              {result.exam.questions.length} questions · {result.exam.time} minutes
            </p>
          </div>
        )}
      </div>

      <div className="panel-glass rounded-2xl p-5">
        <p className="font-display text-sm font-semibold">Preview</p>
        {!result?.exam ? (
          <p className="mt-4 text-sm text-ink-soft">Validate a file to preview its questions here before publishing.</p>
        ) : (
          <>
            <h3 className="mt-3 font-display text-xl font-semibold">{result.exam.title}</h3>
            <p className="text-xs text-ink-faint">
              {result.exam.questions.length} questions · {result.exam.time} min
            </p>
            <div className="mt-4 max-h-[480px] space-y-3 overflow-auto pr-1">
              {result.exam.questions.map((q, i) => (
                <div key={i} className="rounded-xl bg-paper/70 p-3">
                  <p className="text-sm font-medium">
                    {i + 1}. {q.question}
                  </p>
                  <div className="mt-2 grid gap-1">
                    {q.options.map((o) => (
                      <span
                        key={o}
                        className={
                          o === q.correctAnswer
                            ? "rounded-lg bg-correct-soft px-2 py-1 text-xs font-semibold text-correct"
                            : "rounded-lg bg-panel px-2 py-1 text-xs text-ink-soft"
                        }
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={setCurrent} onChange={(e) => setSetCurrent(e.target.checked)} />
              Set as today&apos;s daily exam
            </label>
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className="mt-4 rounded-[10px] bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-60"
            >
              {mut.isPending ? "Publishing…" : "Publish exam"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StudentsTab() {
  const fetchPerf = useServerFn(getStudentPerformance);
  const { data, isLoading } = useQuery({ queryKey: ["admin-students"], queryFn: () => fetchPerf() });
  const [open, setOpen] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-ink-soft">Loading students…</p>;
  if (!data || data.length === 0)
    return <div className="panel-glass rounded-2xl p-6 text-sm text-ink-soft">No students have registered yet.</div>;

  return (
    <div className="grid gap-3">
      {data.map((s) => (
        <div key={s.id} className="panel-glass rounded-2xl p-5">
          <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full flex-wrap items-center gap-3 text-left">
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-semibold">{s.name}</p>
              <p className="truncate text-xs text-ink-faint">{s.email}</p>
            </div>
            <span className="text-xs text-ink-soft">
              Attempts <b className="text-ink">{s.attemptCount}</b>
            </span>
            <span className="text-xs text-ink-soft">
              Avg <b className="text-ink">{s.avgPercent}%</b>
            </span>
            <span className="rounded-full bg-correct-soft px-2.5 py-1 text-xs font-semibold text-correct">
              Best {s.bestPercent}%
            </span>
          </button>
          {open === s.id && (
            <div className="mt-4 divide-y divide-line/70">
              {s.attempts.length === 0 && <p className="py-2 text-xs text-ink-faint">No attempts yet.</p>}
              {s.attempts.map((a) => (
                <Link
                  key={a.id}
                  to="/results/$attemptId"
                  params={{ attemptId: a.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.examTitle}</span>
                  <span className="text-ink-faint">{new Date(a.submittedAt).toLocaleString()}</span>
                  <span className="text-correct">✓ {a.correctCount}</span>
                  <span className="text-wrong">✗ {a.wrongCount}</span>
                  <span className="text-amber">– {a.unansweredCount}</span>
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 font-semibold text-brand">
                    {a.score} / {a.totalQuestions}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
