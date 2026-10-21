-- Migration 0013_unique_event_access_token.sql
-- Enforces global uniqueness for event access tokens across all events

-- 1. Deduplicate any duplicate or null access_token values
DO $$
DECLARE
  r RECORD;
  new_tok TEXT;
  collision_count INT;
BEGIN
  -- Backfill any null tokens first
  FOR r IN (SELECT id FROM public.events WHERE access_token IS NULL) LOOP
    LOOP
      new_tok := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      SELECT COUNT(*) INTO collision_count FROM public.events WHERE access_token = new_tok;
      IF collision_count = 0 THEN
        UPDATE public.events SET access_token = new_tok WHERE id = r.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  -- Deduplicate duplicate tokens (preserve the oldest event's token)
  FOR r IN (
    SELECT id, access_token, ROW_NUMBER() OVER (PARTITION BY access_token ORDER BY created_at ASC) as rn
    FROM public.events
    WHERE access_token IS NOT NULL
  ) LOOP
    IF r.rn > 1 THEN
      LOOP
        new_tok := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
        SELECT COUNT(*) INTO collision_count FROM public.events WHERE access_token = new_tok;
        IF collision_count = 0 THEN
          UPDATE public.events SET access_token = new_tok WHERE id = r.id;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 2. Create partial unique index on access_token
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_access_token_unique
ON public.events (access_token)
WHERE access_token IS NOT NULL;
