-- Bimbingan Andaz v2: fitur yang belum tersedia pada schema produksi.
-- Migration ini bersifat additive kecuali penghapusan tiga tabel AI Review
-- yang memang diminta secara eksplisit oleh spesifikasi produk terbaru.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS google_scholar_url text,
  ADD COLUMN IF NOT EXISTS orcid_id text;

ALTER TABLE public.academic_periods
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

UPDATE public.academic_periods
SET academic_year = COALESCE(
  academic_year,
  extract(year FROM starts_on)::int::text || '/' || extract(year FROM ends_on)::int::text
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_period_active
  ON public.academic_periods (is_active) WHERE is_active;

ALTER TABLE public.guidance_threads
  ADD COLUMN IF NOT EXISTS unread_count_student integer NOT NULL DEFAULT 0 CHECK (unread_count_student >= 0),
  ADD COLUMN IF NOT EXISTS unread_count_lecturer integer NOT NULL DEFAULT 0 CHECK (unread_count_lecturer >= 0),
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

UPDATE public.guidance_threads gt
SET last_message_at = COALESCE(
  (SELECT max(m.created_at) FROM public.messages m WHERE m.thread_id = gt.id),
  gt.updated_at
)
WHERE last_message_at IS NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.title_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_submission_id uuid NOT NULL REFERENCES public.title_submissions(id) ON DELETE CASCADE,
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  snapshot jsonb NOT NULL,
  change_reason text,
  changed_by uuid NOT NULL REFERENCES public.profiles(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (title_submission_id, revision_number)
);

CREATE TABLE IF NOT EXISTS public.logbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  guidance_thread_id uuid REFERENCES public.guidance_threads(id) ON DELETE SET NULL,
  entry_date date NOT NULL,
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 3 AND 200),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 5000),
  feedback_received text,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_meeting_target date,
  meeting_type text NOT NULL DEFAULT 'CHAT' CHECK (meeting_type IN ('CHAT','IN_PERSON','DOCUMENT_REVISION')),
  is_verified boolean NOT NULL DEFAULT false,
  verified_by uuid REFERENCES public.profiles(id),
  verified_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logbook_project_date ON public.logbook_entries(project_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS public.student_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  stage_id smallint NOT NULL REFERENCES public.progress_stages(id),
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED','IN_PROGRESS','SUBMITTED','REVIEWED','APPROVED','REJECTED')),
  target_date date,
  completed_at date,
  notes text,
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, stage_id)
);

CREATE TABLE IF NOT EXISTS public.booking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecturer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  method text NOT NULL CHECK (method IN ('Tatap muka','Google Meet/Zoom','WhatsApp')),
  location_or_url text,
  quota integer NOT NULL DEFAULT 1 CHECK (quota BETWEEN 1 AND 20),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (lecturer_id, starts_at)
);
CREATE INDEX IF NOT EXISTS idx_booking_slots_open ON public.booking_slots(starts_at) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.booking_slots(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 3 AND 300),
  note text,
  status text NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED','REJECTED')),
  decided_by uuid REFERENCES public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, project_id)
);

CREATE TABLE IF NOT EXISTS public.student_period_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.academic_periods(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','WITHDRAWN')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, period_id)
);

CREATE TABLE IF NOT EXISTS public.rubric_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id uuid NOT NULL REFERENCES public.review_rubrics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  weight numeric(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
  max_score numeric(8,2) NOT NULL DEFAULT 100 CHECK (max_score > 0),
  sequence_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comment_templates_owner ON public.comment_templates(owner_id, category);

CREATE TABLE IF NOT EXISTS public.surat_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  document_type text NOT NULL,
  body_template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.surat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.surat_templates(id) ON DELETE SET NULL,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','COMPLETED')),
  reviewer_notes text,
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TABLE IF EXISTS public.ai_review_items CASCADE;
DROP TABLE IF EXISTS public.ai_reviews CASCADE;
DROP TABLE IF EXISTS public.ai_review_settings CASCADE;

COMMIT;
