CREATE TABLE IF NOT EXISTS public.exam_eligibility_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  exam_type text NOT NULL CHECK (exam_type IN ('PROPOSAL', 'RESULT')),
  decision text NOT NULL CHECK (decision IN ('NOT_YET', 'ELIGIBLE')),
  notes text,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, exam_type)
);

CREATE INDEX IF NOT EXISTS exam_eligibility_project_idx
  ON public.exam_eligibility_decisions (project_id, exam_type);

CREATE TABLE IF NOT EXISTS public.ai_review_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  model_name text NOT NULL DEFAULT 'gpt-5-mini'
    CHECK (model_name ~ '^[A-Za-z0-9._:-]{2,100}$'),
  custom_instructions text NOT NULL DEFAULT
    'Utamakan ketepatan ilmiah, konsistensi metode, bahasa akademik, etika penelitian, dan saran yang dapat ditindaklanjuti. Jangan mengarang sumber atau menyatakan plagiarisme.',
  max_findings smallint NOT NULL DEFAULT 20 CHECK (max_findings BETWEEN 1 AND 30),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ai_review_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

