-- Migration 0009_event_access_tokens.sql
-- Adds rotating access tokens and duration controls for event links

-- 1. Add columns to public.events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS access_token text,
ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS token_duration_hours integer NOT NULL DEFAULT 72;

-- 2. Backfill existing events with unique 8-character random tokens and 72-hour window
UPDATE public.events
SET
  access_token = coalesce(access_token, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  token_expires_at = coalesce(token_expires_at, now() + interval '72 hours'),
  token_duration_hours = coalesce(token_duration_hours, 72)
WHERE access_token IS NULL;

-- 3. Enforce NOT NULL on access_token
ALTER TABLE public.events ALTER COLUMN access_token SET NOT NULL;

-- 4. Create index on slug and access_token
CREATE INDEX IF NOT EXISTS idx_events_slug_token ON public.events (slug, access_token);
