-- Migration 0007: Drop setup_initial_admin function if it exists and revoke any public privileges
DO $$
BEGIN
  DROP FUNCTION IF EXISTS public.setup_initial_admin(text, text);
  DROP FUNCTION IF EXISTS public.setup_initial_admin(text);
  DROP FUNCTION IF EXISTS public.setup_initial_admin();
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
