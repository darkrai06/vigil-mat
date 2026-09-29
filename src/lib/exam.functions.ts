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
  durationMinutes: number;
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
  explanation: string;
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
        .select("id, title, description, question_count, duration_minutes, created_at")
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

    const anyAdminRes = await supabaseAdmin.from("user_roles").select("id").eq("role", "admin").limit(1);

    const attempts: AttemptSummary[] = (attemptsRes.data ?? []).map((a) => ({
      id: a.id,
      examId: a.exam_id,
      examTitle: (a as unknown as { exams: { title: string } | null }).exams?.title ?? "Exam",
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
          durationMinutes: currentRes.data.duration_minutes,
          createdAt: currentRes.data.created_at,
        }
      : null;

    return {
      profile: {
        fullName: profileRes.data?.full_name ?? "",
        email: profileRes.data?.email ?? "",
      },
      isAdmin: (rolesRes.data ?? []).some((r) => r.role === "admin"),
      adminExists: (anyAdminRes.data ?? []).length > 0,
      currentExam: current,
      attempts,
    };
  });

// Grace period for network latency on auto-submit at the deadline.
const GRACE_MS = 15_000;

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function gradeAndStore(
  supabaseAdmin: AdminClient,
  params: { sessionId: string; examId: string; userId: string; answers: Record<string, string | null> },
) {
  const { data: questions } = await supabaseAdmin
    .from("questions")
    .select("id, correct_answer, options")
    .eq("exam_id", params.examId);
  const list = questions ?? [];
  if (list.length === 0) throw new Error("This exam has no questions.");

  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  const answerRows = list.map((q) => {
    const raw = params.answers?.[q.id] ?? null;
    const options = toOptions(q.options);
    const selected = typeof raw === "string" && options.includes(raw) ? raw : null;
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
      exam_id: params.examId,
      user_id: params.userId,
      total_questions: list.length,
      correct_count: correct,
      wrong_count: wrong,
      unanswered_count: unanswered,
      score,
    })
    .select("id")
    .single();
  if (error || !attempt) throw new Error("Could not save your exam. Please try again.");

  await supabaseAdmin.from("attempt_answers").insert(answerRows.map((r) => ({ ...r, attempt_id: attempt.id })));

  // Lock the session atomically; if another request already finalized it, discard this attempt.
  const { data: locked } = await supabaseAdmin
    .from("exam_sessions")
    .update({ attempt_id: attempt.id, answers: params.answers })
    .eq("id", params.sessionId)
    .is("attempt_id", null)
    .select("id");
  if (!locked || locked.length === 0) {
    await supabaseAdmin.from("attempts").delete().eq("id", attempt.id);
    const { data: s } = await supabaseAdmin.from("exam_sessions").select("attempt_id").eq("id", params.sessionId).single();
    return s?.attempt_id as string;
  }

  const unsolvedRows = answerRows
    .filter((r) => r.selected_answer === null)
    .map((r) => ({ user_id: params.userId, exam_id: params.examId, question_id: r.question_id, attempt_id: attempt.id }));
  if (unsolvedRows.length > 0) {
    await supabaseAdmin
      .from("unsolved_questions")
      .upsert(unsolvedRows, { onConflict: "attempt_id,question_id", ignoreDuplicates: true });
  }
  return attempt.id;
}

async function loadQuestions(supabaseAdmin: AdminClient, examId: string): Promise<PublicQuestion[]> {
  const { data: rows } = await supabaseAdmin
    .from("questions")
    .select("id, position, prompt, options")
    .eq("exam_id", examId)
    .order("position", { ascending: true });
  return (rows ?? []).map((q) => ({ id: q.id, position: q.position, prompt: q.prompt, options: toOptions(q.options) }));
}

async function findOpenSession(supabaseAdmin: AdminClient, examId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, deadline, answers")
    .eq("exam_id", examId)
    .eq("user_id", userId)
    .is("attempt_id", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// Exam lobby: no questions and no timer until the student enters the arena.
export const getExamForTaking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam } = await supabaseAdmin
      .from("exams")
      .select("id, title, description, question_count, duration_minutes, is_published")
      .eq("id", data.examId)
      .maybeSingle();
    if (!exam || !exam.is_published) throw new Error("This exam is not available.");

    const open = await findOpenSession(supabaseAdmin, data.examId, context.userId);
    let expiredAttemptId: string | null = null;
    let session: { id: string; deadline: string; answers: Record<string, string | null> } | null = null;
    let questions: PublicQuestion[] = [];

    if (open) {
      const answers = (open.answers ?? {}) as Record<string, string | null>;
      if (Date.now() > new Date(open.deadline).getTime() + GRACE_MS) {
        expiredAttemptId = await gradeAndStore(supabaseAdmin, {
          sessionId: open.id,
          examId: data.examId,
          userId: context.userId,
          answers,
        });
      } else {
        session = { id: open.id, deadline: open.deadline, answers };
        questions = await loadQuestions(supabaseAdmin, data.examId);
      }
    }

    return {
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        questionCount: exam.question_count,
        durationMinutes: exam.duration_minutes,
      },
      session,
      questions,
      expiredAttemptId,
      serverNow: new Date().toISOString(),
    };
  });

export const startExamSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam } = await supabaseAdmin
      .from("exams")
      .select("id, duration_minutes, is_published")
      .eq("id", data.examId)
      .maybeSingle();
    if (!exam || !exam.is_published) throw new Error("This exam is not available.");

    let open = await findOpenSession(supabaseAdmin, data.examId, context.userId);
    if (!open || Date.now() > new Date(open.deadline).getTime() + GRACE_MS) {
      const deadline = new Date(Date.now() + exam.duration_minutes * 60_000).toISOString();
      const { data: created, error } = await supabaseAdmin
        .from("exam_sessions")
        .insert({ exam_id: data.examId, user_id: context.userId, deadline })
        .select("id, deadline, answers")
        .single();
      if (error || !created) throw new Error("Could not start the exam.");
      open = created;
    }

    return {
      session: { id: open.id, deadline: open.deadline, answers: (open.answers ?? {}) as Record<string, string | null> },
      questions: await loadQuestions(supabaseAdmin, data.examId),
      serverNow: new Date().toISOString(),
    };
  });

// Autosave so a refresh keeps answers. Rejected after the deadline.
export const saveSessionAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string; answers: Record<string, string | null> }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("exam_sessions")
      .select("id, user_id, deadline, attempt_id")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!s || s.user_id !== context.userId || s.attempt_id) return { ok: false };
    if (Date.now() > new Date(s.deadline).getTime()) return { ok: false };
    await supabaseAdmin.from("exam_sessions").update({ answers: data.answers }).eq("id", s.id);
    return { ok: true };
  });

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string; answers: Record<string, string | null> }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("exam_sessions")
      .select("id, user_id, exam_id, deadline, attempt_id, answers")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!s || s.user_id !== context.userId) throw new Error("Exam session not found.");
    if (s.attempt_id) return { attemptId: s.attempt_id };

    // After the deadline (plus grace) the server ignores new client answers and uses the last autosave.
    const late = Date.now() > new Date(s.deadline).getTime() + GRACE_MS;
    const answers = late ? ((s.answers ?? {}) as Record<string, string | null>) : data.answers;

    const attemptId = await gradeAndStore(supabaseAdmin, {
      sessionId: s.id,
      examId: s.exam_id,
      userId: context.userId,
      answers,
    });
    return { attemptId };
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
        .select("id, position, prompt, options, correct_answer, explanation")
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
      explanation: (q.explanation ?? "").trim(),
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
