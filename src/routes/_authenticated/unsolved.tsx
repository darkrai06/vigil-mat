import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUnsolvedExams, getStudentHome } from "@/lib/exam.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/unsolved")({
  head: () => ({
    meta: [
      { title: "Unsolved Exams — Vigil Exam Hall" },
      { name: "description", content: "Published exams you have not attempted yet." },
      { property: "og:title", content: "Unsolved Exams — Vigil Exam Hall" },
      { property: "og:description", content: "Published exams you have not attempted yet." },
    ],
  }),
  component: UnsolvedPage,
});

function UnsolvedPage() {
  const fetchList = useServerFn(getUnsolvedExams);
  const fetchHome = useServerFn(getStudentHome);
  const { data, isLoading } = useQuery({ queryKey: ["unsolved-exams"], queryFn: () => fetchList() });
  const { data: home } = useQuery({ queryKey: ["student-home"], queryFn: () => fetchHome() });

  return (
    <AppShell
      showAdmin={home?.isAdmin}
      headerLeft={
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">Pending</p>
          <p className="mt-0.5 font-display text-sm font-semibold leading-none">Unsolved exams</p>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-ink-soft">Loading exams…</p>
      ) : !data || data.length === 0 ? (
        <div className="panel-glass rounded-2xl p-6 text-sm text-ink-soft">
          You have attempted every available exam. Great work!
        </div>
      ) : (
        <div className="fade-up grid gap-4 sm:grid-cols-2">
          {data.map((exam) => (
            <div key={exam.id} className="panel-glass flex flex-col rounded-2xl p-5">
              <span className="text-xs text-ink-faint">
                {exam.questionCount} questions · {exam.durationMinutes} min
              </span>
              <h3 className="mt-2 font-display text-lg font-semibold leading-tight">{exam.title}</h3>
              {exam.description && (
                <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{exam.description}</p>
              )}
              <Link
                to="/exam/$examId"
                params={{ examId: exam.id }}
                className="mt-4 self-start rounded-[10px] bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand/90"
              >
                Start exam
              </Link>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
