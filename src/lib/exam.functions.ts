import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PublicQuestion = {
  id: string;
  position: number;
  prompt: string;
  options: string[];
};

export type ExamSummary = {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  createdAt: string;
};

export type AttemptSummary = {
  id: string;
  examId: string;
  examTitle: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  score: number;
  submittedAt: string;
};

export type ReviewQuestion = {
  id: string;
  position: number;
  prompt: string;
  options: string[];
  correctAnswer: string;
  selectedAnswer: string | null;
};

function toOptions(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((o) => String(o)) : [];
}

export const getStudentHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [profileRes, rolesRes, currentRes, attemptsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin
        .from("exams")
        .select("id, title, description, question_count, created_at")
        .eq("is_published", true)
        .eq("is_current", true)
        .maybeSingle(),
      supabaseAdmin
        .from("attempts")
        .select("id, exam_id, total_questions, correct_count, wrong_count, unanswered_count, score, submitted_at, exams(title)")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false })
        .limit(50),
    ]);

    const userEmail =
      (context.claims?.email as string)?.toLowerCase() || profileRes.data?.email?.toLowerCase() || "";
    const isTargetAdmin = userEmail === "mmalmahin@gmail.com";

    if (isTargetAdmin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    }

    const isAdmin = isTargetAdmin || (rolesRes.data ?? []).some((r) => r.role === "admin");

    const attempts: AttemptSummary[] = (attemptsRes.data ?? []).map((a) => ({
      id: a.id,
      examId: a.exam_id,
      examTitle: (a as unknown as { exams: { title: string } | null }).exams?.title ?? "পরীক্ষা",
      totalQuestions: a.total_questions,
      correctCount: a.correct_count,
      wrongCount: a.wrong_count,
      unansweredCount: a.unanswered_count,
      score: Number(a.score),
      submittedAt: a.submitted_at,
    }));

    const current: ExamSummary | null = currentRes.data
      ? {
          id: currentRes.data.id,
          title: currentRes.data.title,
          description: currentRes.data.description,
          questionCount: currentRes.data.question_count,
          createdAt: currentRes.data.created_at,
        }
      : null;

    return {
      profile: {
        fullName: profileRes.data?.full_name ?? "",
        email: profileRes.data?.email ?? userEmail,
      },
      isAdmin,
      adminExists: true,
      currentExam: current,
      attempts,
    };
  });

export const getExamForTaking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: exam } = await supabaseAdmin
      .from("exams")
      .select("id, title, description, question_count, is_published")
      .eq("id", data.examId)
      .maybeSingle();

    if (!exam || !exam.is_published) throw new Error("This exam is not available.");

    const { data: rows } = await supabaseAdmin
      .from("questions")
      .select("id, position, prompt, options")
      .eq("exam_id", data.examId)
      .order("position", { ascending: true });

    const questions: PublicQuestion[] = (rows ?? []).map((q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      options: toOptions(q.options),
    }));

    return {
      exam: { id: exam.id, title: exam.title, description: exam.description },
      questions,
    };
  });

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examId: string; answers: Record<string, string | null> }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: exam } = await supabaseAdmin
      .from("exams")
      .select("id, is_published")
      .eq("id", data.examId)
      .maybeSingle();
    if (!exam || !exam.is_published) throw new Error("This exam is not available.");

    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, correct_answer, options")
      .eq("exam_id", data.examId);

    const list = questions ?? [];
    if (list.length === 0) throw new Error("This exam has no questions.");

    let correct = 0;
    let wrong = 0;
    let unanswered = 0;

    const answerRows = list.map((q) => {
      const raw = data.answers?.[q.id] ?? null;
      const options = toOptions(q.options);
      const selected = raw !== null && options.includes(raw) ? raw : null;
      if (selected === null) {
        unanswered += 1;
        return { question_id: q.id, selected_answer: null, is_correct: false };
      }
      const isCorrect = selected === q.correct_answer;
      if (isCorrect) correct += 1;
      else wrong += 1;
      return { question_id: q.id, selected_answer: selected, is_correct: isCorrect };
    });

    const score = Number((correct * 1 - wrong * 0.25).toFixed(2));

    const { data: attempt, error } = await supabaseAdmin
      .from("attempts")
      .insert({
        exam_id: data.examId,
        user_id: userId,
        total_questions: list.length,
        correct_count: correct,
        wrong_count: wrong,
        unanswered_count: unanswered,
        score,
      })
      .select("id")
      .single();

    if (error || !attempt) throw new Error("Could not save your exam. Please try again.");

    const { error: answerError } = await supabaseAdmin
      .from("attempt_answers")
      .insert(answerRows.map((r) => ({ ...r, attempt_id: attempt.id })));
    if (answerError) throw new Error("Could not save your answers. Please try again.");

    return { attemptId: attempt.id };
  });

export const getAttemptReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attemptId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: attempt } = await supabaseAdmin
      .from("attempts")
      .select(
        "id, user_id, exam_id, total_questions, correct_count, wrong_count, unanswered_count, score, submitted_at, exams(title)",
      )
      .eq("id", data.attemptId)
      .maybeSingle();

    if (!attempt) throw new Error("Attempt not found.");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (attempt.user_id !== userId && !isAdmin) throw new Error("You cannot view this attempt.");

    const [{ data: questions }, { data: answers }] = await Promise.all([
      supabaseAdmin
        .from("questions")
        .select("id, position, prompt, options, correct_answer")
        .eq("exam_id", attempt.exam_id)
        .order("position", { ascending: true }),
      supabaseAdmin.from("attempt_answers").select("question_id, selected_answer").eq("attempt_id", attempt.id),
    ]);

    const selectedByQuestion = new Map((answers ?? []).map((a) => [a.question_id, a.selected_answer]));

    const review: ReviewQuestion[] = (questions ?? []).map((q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      options: toOptions(q.options),
      correctAnswer: q.correct_answer,
      selectedAnswer: selectedByQuestion.get(q.id) ?? null,
    }));

    const summary: AttemptSummary = {
      id: attempt.id,
      examId: attempt.exam_id,
      examTitle: (attempt as unknown as { exams: { title: string } | null }).exams?.title ?? "Exam",
      totalQuestions: attempt.total_questions,
      correctCount: attempt.correct_count,
      wrongCount: attempt.wrong_count,
      unansweredCount: attempt.unanswered_count,
      score: Number(attempt.score),
      submittedAt: attempt.submitted_at,
    };

    return { attempt: summary, questions: review };
  });
