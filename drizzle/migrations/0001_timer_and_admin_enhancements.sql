-- Add exam duration support
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- Add auto-submit tracking to attempts
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS auto_submitted BOOLEAN NOT NULL DEFAULT false;

-- Exam sessions: tracks when a student starts a timed exam (for timer persistence)
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, exam_id)
);

CREATE INDEX IF NOT EXISTS exam_sessions_user_exam_idx ON public.exam_sessions(user_id, exam_id);

GRANT SELECT, INSERT ON public.exam_sessions TO authenticated;
GRANT ALL ON public.exam_sessions TO service_role;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sessions select" ON public.exam_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own sessions insert" ON public.exam_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
