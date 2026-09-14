BEGIN;
CREATE TABLE IF NOT EXISTS public.ai_review_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  model_name text NOT NULL DEFAULT 'gpt-5-mini',
  custom_instructions text NOT NULL DEFAULT '',
  max_findings smallint NOT NULL DEFAULT 20,
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TABLE IF EXISTS public.surat_requests CASCADE;
DROP TABLE IF EXISTS public.surat_templates CASCADE;
DROP TABLE IF EXISTS public.comment_templates CASCADE;
DROP TABLE IF EXISTS public.rubric_criteria CASCADE;
DROP TABLE IF EXISTS public.student_period_enrollments CASCADE;
DROP TABLE IF EXISTS public.booking_requests CASCADE;
DROP TABLE IF EXISTS public.booking_slots CASCADE;
DROP TABLE IF EXISTS public.student_progress CASCADE;
DROP TABLE IF EXISTS public.logbook_entries CASCADE;
DROP TABLE IF EXISTS public.title_revisions CASCADE;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS metadata;
ALTER TABLE public.guidance_threads
  DROP COLUMN IF EXISTS unread_count_student,
  DROP COLUMN IF EXISTS unread_count_lecturer,
  DROP COLUMN IF EXISTS last_message_at;
ALTER TABLE public.academic_periods
  DROP COLUMN IF EXISTS academic_year,
  DROP COLUMN IF EXISTS is_locked;
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS bio,
  DROP COLUMN IF EXISTS google_scholar_url,
  DROP COLUMN IF EXISTS orcid_id;
COMMIT;
