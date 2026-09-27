import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getAdminOverview, publishExam, updateExam, deleteExam } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "এডমিন প্যানেল — Vigil Exam Hall" },
      { name: "description", content: "নতুন পরীক্ষা তৈরি, প্রকাশ ও শিক্ষার্থীদের ফলাফল পরিচালনা করুন।" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getAdminOverview);
  const publish = useServerFn(publishExam);
  const update = useServerFn(updateExam);
  const remove = useServerFn(deleteExam);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jsonInput, setJsonInput] = useState(`[
  {
    "question": "বাংলাদেশের রাজধানী কোনটি?",
    "options": ["ঢাকা", "চট্টগ্রাম", "সিলেট", "রাজশাহী"],
    "correctAnswer": "ঢাকা"
  },
  {
    "question": "বাংলাদেশের জাতীয় পাখির নাম কি?",
    "options": ["দোয়েল", "ময়না", "টিয়া", "কাক"],
    "correctAnswer": "দোয়েল"
  }
]`);
  const [setCurrent, setSetCurrent] = useState(true);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
  });

  const publishMutation = useMutation({
    mutationFn: (payload: unknown) => publish({ data: { payload, setCurrent } }),
    onSuccess: () => {
      toast.success("পরীক্ষা সফলভাবে তৈরি ও প্রকাশ করা হয়েছে।");
      setTitle("");
      setDescription("");
      refetch();
      navigate({ to: "/dashboard" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "পরীক্ষা প্রকাশ করা যায়নি।"),
  });

  const toggleCurrentMutation = useMutation({
    mutationFn: ({ examId, isCurrent }: { examId: string; isCurrent: boolean }) =>
      update({ data: { examId, isCurrent } }),
    onSuccess: () => {
      toast.success("আজকের পরীক্ষা আপডেট করা হয়েছে।");
      refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "আবেদন ব্যর্থ হয়েছে।"),
  });

  const deleteMutation = useMutation({
    mutationFn: (examId: string) => remove({ data: { examId } }),
    onSuccess: () => {
      toast.success("পরীক্ষা মুছে ফেলা হয়েছে।");
      refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "ডিলিট করা যায়নি।"),
  });

  function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    try {
      const questions = JSON.parse(jsonInput);
      publishMutation.mutate({
        title,
        description,
        questions,
      });
    } catch {
      toast.error("JSON ফরম্যাট সঠিক নয়। অনুগ্রহ করে সঠিকভাবে প্রশ্নগুলো দিন।");
    }
  }

  return (
    <AppShell
      showAdmin={true}
      headerLeft={
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-brand font-semibold">এডমিন ড্যাশবোর্ড</p>
          <p className="mt-0.5 font-display text-sm font-semibold leading-none">পরীক্ষা ব্যবস্থাপনা</p>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-ink-soft">এডমিন প্যানেল লোড হচ্ছে…</p>
      ) : (
        <div className="fade-up space-y-8">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="panel-glass rounded-2xl p-5">
              <p className="text-xs text-ink-faint">মোট শিক্ষার্থী</p>
              <p className="mt-2 font-display text-3xl font-semibold leading-none">{data?.stats.students}</p>
            </div>
            <div className="panel-glass rounded-2xl p-5">
              <p className="text-xs text-ink-faint">মোট পরীক্ষা জমা</p>
              <p className="mt-2 font-display text-3xl font-semibold leading-none">{data?.stats.attempts}</p>
            </div>
            <div className="panel-glass rounded-2xl p-5">
              <p className="text-xs text-ink-faint">গড় সাফল্য শতাংশ</p>
              <p className="mt-2 font-display text-3xl font-semibold leading-none">{data?.stats.avgPercent}%</p>
            </div>
          </section>

          <section className="panel-glass rounded-2xl p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold">নতুন পরীক্ষা আপলোড করুন</h2>
            <p className="mt-1 text-sm text-ink-soft">
              নতুন পরীক্ষার শিরোনাম ও বাংলায় প্রশ্নপত্রের তালিকা প্রবেশ করিয়ে প্রকাশ করুন।
            </p>

            <form onSubmit={handleCreateExam} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-ink-soft">পরীক্ষার শিরোনাম</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: আজকের সাধারণ জ্ঞান পরীক্ষা - ১"
                  className="mt-1.5 w-full rounded-[10px] border border-line bg-panel px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-soft">পরীক্ষার বিবরণ (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="যেমন: এই পরীক্ষায় ১০টি বহুচর্চামূলক প্রশ্ন রয়েছে।"
                  className="mt-1.5 w-full rounded-[10px] border border-line bg-panel px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-soft">প্রশ্ন তালিকা (JSON Format)</label>
                <textarea
                  rows={8}
                  required
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  className="mt-1.5 w-full rounded-[10px] border border-line bg-panel p-3 font-mono text-xs outline-none focus:border-brand"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="setCurrent"
                  checked={setCurrent}
                  onChange={(e) => setSetCurrent(e.target.checked)}
                  className="size-4 rounded border-line text-brand focus:ring-brand"
                />
                <label htmlFor="setCurrent" className="text-xs font-medium text-ink">
                  এটিকে আজকের প্রধান পরীক্ষা (Current Daily Exam) হিসেবে সেট করুন
                </label>
              </div>

              <button
                type="submit"
                disabled={publishMutation.isPending}
                className="rounded-[10px] bg-brand px-6 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90 disabled:opacity-60"
              >
                {publishMutation.isPending ? "প্রকাশ হচ্ছে…" : "পরীক্ষা প্রকাশ করুন"}
              </button>
            </form>
          </section>

          <section>
            <h3 className="font-display text-xl font-semibold">বিদ্যমান পরীক্ষাসমূহ</h3>
            <div className="mt-4 space-y-3">
              {(data?.exams ?? []).map((exam) => (
                <div key={exam.id} className="panel-glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display text-base font-semibold">{exam.title}</p>
                      {exam.isCurrent && (
                        <span className="rounded-full bg-correct-soft px-2.5 py-0.5 text-xs font-semibold text-correct">
                          আজকের পরীক্ষা
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">{exam.questionCount}টি প্রশ্ন</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!exam.isCurrent && (
                      <button
                        onClick={() => toggleCurrentMutation.mutate({ examId: exam.id, isCurrent: true })}
                        className="rounded-[8px] border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-ink"
                      >
                        আজকের পরীক্ষা বানান
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(exam.id)}
                      className="rounded-[8px] bg-wrong/10 px-3 py-1.5 text-xs font-semibold text-wrong hover:bg-wrong/20"
                    >
                      মুছে ফেলুন
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
