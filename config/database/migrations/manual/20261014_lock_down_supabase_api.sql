-- Lock down Supabase's auto-generated Data API (PostgREST) for the public schema.
--
-- Why: every table had RLS disabled and the API roles `anon` / `authenticated` held
-- SELECT, INSERT, UPDATE, DELETE and TRUNCATE on all of them. Anyone with the project's
-- anon key (Supabase treats it as public) could read or rewrite users, payments, quiz
-- answers, etc. without going through the backend.
--
-- Safe for the app: Prisma connects as `postgres`, which owns every table and has
-- BYPASSRLS, so it is unaffected. ForensIQ does not use supabase-js / the Data API.
--
-- Idempotent. Rollback (only if something unexpectedly needs the Data API):
--   ALTER TABLE ... DISABLE ROW LEVEL SECURITY;  and re-GRANT the privileges.

BEGIN;

-- 1) Turn on RLS for every table in public (no policies => API roles see nothing).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- 2) Remove the API roles' table and sequence privileges outright.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 3) Tables created later (e.g. by `prisma db push`) must not be exposed either.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;
