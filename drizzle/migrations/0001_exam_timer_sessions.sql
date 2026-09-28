ALTER TABLE public.exams ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 30;

CREATE TABLE public.exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline TIMESTAMPTZ NOT NULL,
  attempt_id UUID REFERENCES public.attempts(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX exam_sessions_user_exam_idx ON public.exam_sessions(user_id, exam_id);
GRANT ALL ON public.exam_sessions TO service_role;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;