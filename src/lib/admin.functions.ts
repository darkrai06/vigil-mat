import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = (process.env["ADMIN_EMAIL"] || "mmalmahin@gmail.com").toLowerCase();

export const examUploadSchema = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().optional(),
  time: z.number().int().min(1, "time must be at least 1 minute").optional(),
  questions: z
    .array(
      z.object({
        question: z.string().min(1, "question text is required"),
        options: z.array(z.string().min(1, "option text cannot be empty")).min(2, "at least 2 options required"),
        correctAnswer: z.string().min(1, "correctAnswer is required"),
      }),
    )
    .min(1, "at least one question is required"),
});

export type ExamUpload = z.infer<typeof examUploadSchema>;

async function assertAdmin(userId: string, email?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let isTargetEmail = email?.toLowerCase() === ADMIN_EMAIL;
  if (!isTargetEmail) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userData?.user?.email?.toLowerCase() === ADMIN_EMAIL) {
      isTargetEmail = true;
    }
  }

  if (isTargetEmail) {
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    return supabaseAdmin;
  }

  const { data } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("এডমিন অ্যাক্সেস প্রয়োজন।");
  return supabaseAdmin;
}

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("user_roles").select("id").eq("role", "admin").limit(1);
    if ((existing ?? []).length > 0) throw new Error("An administrator already exists for this site.");

    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error("Could not grant admin access.");
    return { ok: true };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);

    const [{ data: exams }, { data: attempts }, { data: students }] = await Promise.all([
      supabaseAdmin
        .from("exams")
        .select("id, title, description, question_count, is_published, is_current, created_at, duration_minutes")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("attempts")
        .select("id, exam_id, user_id, score, total_questions, correct_count, wrong_count, unanswered_count, submitted_at, auto_submitted")
        .order("submitted_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, full_name, email"),
    ]);

    const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name || s.email || "Student"]));
    const emailById = new Map((students ?? []).map((s) => [s.id, s.email || ""]));
    const titleById = new Map((exams ?? []).map((e) => [e.id, e.title]));

    const allAttempts = (attempts ?? []).map((a) => ({
      id: a.id,
      userId: a.user_id,
      studentName: nameById.get(a.user_id) ?? "Student",
      studentEmail: emailById.get(a.user_id) ?? "",
      examTitle: titleById.get(a.exam_id) ?? "Exam",
      examId: a.exam_id,
      score: Number(a.score),
      totalQuestions: a.total_questions,
      correctCount: a.correct_count,
      wrongCount: a.wrong_count,
      unansweredCount: a.unanswered_count,
      submittedAt: a.submitted_at,
      autoSubmitted: a.auto_submitted ?? false,
    }));

    const totalAttempts = allAttempts.length;
    const avgPercent =
      totalAttempts === 0
        ? 0
        : Math.round(
            (allAttempts.reduce((sum, a) => sum + (a.totalQuestions ? a.score / a.totalQuestions : 0), 0) /
              totalAttempts) *
              100,
          );

    return {
      exams: (exams ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        questionCount: e.question_count,
        isPublished: e.is_published,
        isCurrent: e.is_current,
        createdAt: e.created_at,
        durationMinutes: e.duration_minutes,
      })),
      recentAttempts: allAttempts,
      stats: {
        students: (students ?? []).length,
        attempts: totalAttempts,
        avgPercent,
      },
    };
  });

export const publishExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payload: unknown; setCurrent: boolean }) => input)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);

    const parsed = examUploadSchema.safeParse(data.payload);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; "));
    }

    const exam = parsed.data;
    const badIndex = exam.questions.findIndex((q) => !q.options.includes(q.correctAnswer));
    if (badIndex >= 0) {
      throw new Error(`Question ${badIndex + 1}: correctAnswer must exactly match one of the options.`);
    }

    const { data: created, error } = await supabaseAdmin
      .from("exams")
      .insert({
        title: exam.title,
        description: exam.description ?? "",
        question_count: exam.questions.length,
        is_published: true,
        is_current: data.setCurrent,
        created_by: context.userId,
        duration_minutes: exam.time ?? null,
      })
      .select("id")
      .single();

    if (error || !created) throw new Error("Could not create the exam.");

    const { error: qError } = await supabaseAdmin.from("questions").insert(
      exam.questions.map((q, index) => ({
        exam_id: created.id,
        position: index + 1,
        prompt: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
      })),
    );
    if (qError) {
      await supabaseAdmin.from("exams").delete().eq("id", created.id);
      throw new Error("Could not save the questions.");
    }

    return { examId: created.id };
  });

export const updateExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { examId: string; title?: string; description?: string; isPublished?: boolean; isCurrent?: boolean }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.description !== undefined) patch["description"] = data.description;
    if (data.isPublished !== undefined) patch["is_published"] = data.isPublished;
    if (data.isCurrent !== undefined) patch["is_current"] = data.isCurrent;

    const { error } = await supabaseAdmin.from("exams").update(patch).eq("id", data.examId);
    if (error) throw new Error("Could not update the exam.");
    return { ok: true };
  });

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examId: string }) => input)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("exams").delete().eq("id", data.examId);
    if (error) throw new Error("Could not delete the exam.");
    return { ok: true };
  });

export const getExamQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { examId: string }) => input)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: rows } = await supabaseAdmin
      .from("questions")
      .select("id, position, prompt, options, correct_answer")
      .eq("exam_id", data.examId)
      .order("position", { ascending: true });

    return (rows ?? []).map((q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      options: Array.isArray(q.options) ? q.options.map((o) => String(o)) : [],
      correctAnswer: q.correct_answer,
    }));
  });
