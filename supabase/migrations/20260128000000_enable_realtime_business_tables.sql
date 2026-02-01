-- Enable Supabase Realtime (postgres_changes) for business tables so that when one user
-- adds/updates/deletes establishments, householders, or visits, other users in the same
-- congregation see the changes immediately (no duplicate adds, no stale lists).
-- Dashboard alternative: Database → Replication → supabase_realtime → add these tables.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'business_establishments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_establishments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'householders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.householders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'calls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
END $$;
