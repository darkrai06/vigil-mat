ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS explanation text NOT NULL DEFAULT '';

CREATE TABLE public.unsolved_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  solved_at timestamptz,
  selected_answer text,
  is_correct boolean,
  UNIQUE (attempt_id, question_id)
);
CREATE INDEX unsolved_questions_user_idx ON public.unsolved_questions(user_id, solved_at);
GRANT SELECT ON public.unsolved_questions TO authenticated;
GRANT ALL ON public.unsolved_questions TO service_role;
ALTER TABLE public.unsolved_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own unsolved select" ON public.unsolved_questions FOR SELECT TO authenticated USING (auth.uid() = user_id);