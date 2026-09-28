import { createFileRoute, Link } from "@tanstack/react-router";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vigil Exam Hall — Daily MCQ exams for students" },
      {
        name: "description",
        content:
          "Take the daily multiple-choice exam, get instant marked results with +1 / −0.25 scoring, and review every past attempt.",
      },
      { property: "og:title", content: "Vigil Exam Hall — Daily MCQ exams for students" },
      {
        property: "og:description",
        content: "Daily MCQ exams with instant marking, answer review and a permanent attempt history.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-paper font-body text-ink">
      <AmbientBackground />
      <div className="mx-auto flex min-h-screen max-w-[1100px] flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-[10px] bg-ink font-display text-sm font-semibold text-panel">
              V
            </div>
            <div>
              <p className="font-display text-[15px] font-semibold leading-none">Vigil</p>
              <p className="text-[11px] text-ink-faint">Exam Hall</p>
            </div>
          </div>
          <Link
            to="/auth"
            className="rounded-[10px] bg-brand px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90"
          >
            Sign in
          </Link>
        </header>

        <section className="fade-up mt-16 max-w-[52ch]">
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            Daily multiple-choice examinations
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl font-semibold leading-tight sm:text-5xl">
            Sit the exam. See exactly where every mark went.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            A quiet, numbered answer sheet with a question navigator, honest negative marking, and a permanent record
            of every attempt you have ever made.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="rounded-[10px] bg-brand px-5 py-3 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90"
            >
              Enter the exam hall
            </Link>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
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
          <div className="panel-glass rounded-2xl p-5">
            <p className="text-xs text-ink-faint">During the exam</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              A numbered navigator shows answered and pending questions at a glance, with a running count and a
              confirmation step before you submit.
            </p>
          </div>
          <div className="panel-glass rounded-2xl p-5">
            <p className="text-xs text-ink-faint">Afterwards</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Every question is replayed with your answer and the correct one, and the attempt is stored to your
              account across devices.
            </p>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
