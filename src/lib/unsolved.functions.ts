import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UnsolvedQuestion = {
  id: string;
  examTitle: string;
  prompt: string;
  options: string[];
  createdAt: string;
};

function toOptions(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((o) => String(o)) : [];
}

type Row = {
  id: string;
  created_at: string;
  questions: { prompt: string; options: unknown } | null;
  exams: { title: string } | null;
};

// Returns only the question and options — never the correct answer or explanation.
export const listUnsolved = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("unsolved_questions")
      .select("id, created_at, questions(prompt, options), exams(title)")
      .eq("user_id", context.userId)
      .is("solved_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = (data ?? []) as unknown as Row[];
    const list: UnsolvedQuestion[] = rows
      .filter((r) => r.questions)
      .map((r) => ({
        id: r.id,
        examTitle: r.exams?.title ?? "Exam",
        prompt: r.questions!.prompt,
        options: toOptions(r.questions!.options),
        createdAt: r.created_at,
      }));
    return list;
  });

export const solveUnsolved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), answer: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("unsolved_questions")
      .select("id, user_id, solved_at, question_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.user_id !== context.userId) throw new Error("Question not found.");
    if (row.solved_at) throw new Error("You have already solved this question.");

    const { data: q } = await supabaseAdmin
      .from("questions")
      .select("options, correct_answer, explanation")
      .eq("id", row.question_id)
      .single();
    if (!q) throw new Error("Question not found.");
    if (!toOptions(q.options).includes(data.answer)) throw new Error("Please choose one of the options.");

    const isCorrect = data.answer === q.correct_answer;
    // Atomic: only the first submission wins. Original exam score is never touched.
    const { data: updated } = await supabaseAdmin
      .from("unsolved_questions")
      .update({ solved_at: new Date().toISOString(), selected_answer: data.answer, is_correct: isCorrect })
      .eq("id", row.id)
      .is("solved_at", null)
      .select("id");
    if (!updated || updated.length === 0) throw new Error("You have already solved this question.");

    return {
      isCorrect,
      selectedAnswer: data.answer,
      correctAnswer: q.correct_answer,
      explanation: (q.explanation ?? "").trim(),
    };
  });
