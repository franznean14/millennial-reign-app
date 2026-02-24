-- Personal territory: publisher who has taken this establishment as personal territory (like publisher_id on householders)
-- Adds column and index only; no data is deleted or modified.

DO $$ BEGIN
  ALTER TABLE public.business_establishments ADD COLUMN IF NOT EXISTS publisher_id uuid REFERENCES public.profiles(id);
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

CREATE INDEX IF NOT EXISTS business_establishments_publisher_id_idx ON public.business_establishments(publisher_id) WHERE publisher_id IS NOT NULL;
