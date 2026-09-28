import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = (process.env["ADMIN_EMAIL"] || "mmalmahin@gmail.com").toLowerCase();

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
  durationMinutes: number | null;
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
  autoSubmitted: boolean;
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
        .select("id, title, description, question_count, created_at, duration_minutes")
        .eq("is_published", true)
        .eq("is_current", true)
        .maybeSingle(),
      supabaseAdmin
        .from("attempts")
        .select("id, exam_id, total_questions, correct_count, wrong_count, unanswered_count, score, submitted_at, auto_submitted, exams(title)")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false })
        .limit(50),
    ]);

    const userEmail =
      (context.claims?.email as string)?.toLowerCase() || profileRes.data?.email?.toLowerCase() || "";
    const isTargetAdmin = userEmail === ADMIN_EMAIL;

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
      autoSubmitted: a.auto_submitted ?? false,
    }));

    const current: ExamSummary | null = currentRes.data
      ? {
          id: currentRes.data.id,
          title: currentRes.data.title,
          description: currentRes.data.description,
          questionCount: currentRes.data.question_count,
          durationMinutes: currentRes.data.duration_minutes,
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
      .select("id, title, description, question_count, is_published, duration_minutes")
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
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        durationMinutes: exam.duration_minutes,
      },
      questions,
    };
  });

/** Start an exam session – records server-side start time and computes the deadline. */
export const startExamSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Check if session already exists (for page refresh resilience)
    const { data: existing } = await supabaseAdmin
      .from("exam_sessions")
      .select("id, started_at, deadline")
      .eq("user_id", userId)
      .eq("exam_id", data.examId)
      .maybeSingle();

    if (existing) {
      return {
        sessionId: existing.id,
        startedAt: existing.started_at,
        deadline: existing.deadline,
      };
    }

    // Get exam to determine duration
    const { data: exam } = await supabaseAdmin
      .from("exams")
      .select("id, is_published, duration_minutes")
      .eq("id", data.examId)
      .maybeSingle();

    if (!exam || !exam.is_published) throw new Error("This exam is not available.");

    const now = new Date();
    const deadline = exam.duration_minutes
      ? new Date(now.getTime() + exam.duration_minutes * 60 * 1000).toISOString()
      : null;

    const { data: session, error } = await supabaseAdmin
      .from("exam_sessions")
      .insert({
        user_id: userId,
        exam_id: data.examId,
        started_at: now.toISOString(),
        deadline,
      })
      .select("id, started_at, deadline")
      .single();

    if (error || !session) throw new Error("Could not start the exam session.");

    return {
      sessionId: session.id,
      startedAt: session.started_at,
      deadline: session.deadline,
    };
  });

/** Get existing exam session for a user (for timer restoration on page refresh). */
export const getExamSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("exam_sessions")
      .select("id, started_at, deadline")
      .eq("user_id", context.userId)
      .eq("exam_id", data.examId)
      .maybeSingle();

    return session
      ? { sessionId: session.id, startedAt: session.started_at, deadline: session.deadline }
      : null;
  });

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examId: string; answers: Record<string, string | null>; autoSubmitted?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: exam } = await supabaseAdmin
      .from("exams")
      .select("id, is_published, duration_minutes")
      .eq("id", data.examId)
      .maybeSingle();
    if (!exam || !exam.is_published) throw new Error("This exam is not available.");

    // Check if already submitted
    const { data: existingAttempt } = await supabaseAdmin
      .from("attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("exam_id", data.examId)
      .limit(1);
    if (existingAttempt && existingAttempt.length > 0) {
      return { attemptId: existingAttempt[0].id };
    }

    // Enforce server-side deadline if there's a timed session
    let isAutoSubmitted = data.autoSubmitted ?? false;
    const { data: session } = await supabaseAdmin
      .from("exam_sessions")
      .select("deadline")
      .eq("user_id", userId)
      .eq("exam_id", data.examId)
      .maybeSingle();

    if (session?.deadline) {
      const deadlineTime = new Date(session.deadline).getTime();
      const now = Date.now();
      // Allow a small grace period of 5 seconds for network latency
      if (now > deadlineTime + 5000) {
        isAutoSubmitted = true;
      }
    }

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
        auto_submitted: isAutoSubmitted,
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
        "id, user_id, exam_id, total_questions, correct_count, wrong_count, unanswered_count, score, submitted_at, auto_submitted, exams(title)",
      )
      .eq("id", data.attemptId)
      .maybeSingle();

    if (!attempt) throw new Error("Attempt not found.");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (attempt.user_id !== userId && !isAdmin) throw new Error("You cannot view this attempt.");

    // Get student info for admin view
    let studentName = "";
    let studentEmail = "";
    if (isAdmin && attempt.user_id !== userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", attempt.user_id)
        .maybeSingle();
      studentName = profile?.full_name ?? "";
      studentEmail = profile?.email ?? "";
    }

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
      autoSubmitted: attempt.auto_submitted ?? false,
    };

    return { attempt: summary, questions: review, studentName, studentEmail };
  });
