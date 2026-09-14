CREATE TABLE IF NOT EXISTS public.document_files (
  document_version_id uuid PRIMARY KEY
    REFERENCES public.document_versions(id) ON DELETE CASCADE,
  content bytea NOT NULL,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_files_content_size CHECK (octet_length(content) <= 4194304)
);

CREATE INDEX IF NOT EXISTS document_files_created_at_idx
  ON public.document_files (created_at DESC);

