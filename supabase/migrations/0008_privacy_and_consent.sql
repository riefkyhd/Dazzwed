-- Migration 0008_privacy_and_consent.sql
-- Hardens privacy, legal consent compliance (Indonesia UU PDP), and data hygiene.

-- 1. Add consent tracking columns to guests table
ALTER TABLE public.guests
ADD COLUMN IF NOT EXISTS consent_version text NOT NULL DEFAULT '2026-10-v1',
ADD COLUMN IF NOT EXISTS consent_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS consent_telemetry boolean NOT NULL DEFAULT false;

-- 2. Backfill existing guest rows to current consent version
UPDATE public.guests
SET
  consent_version = '2026-10-v1',
  consent_at = coalesce(consent_at, now()),
  consent_telemetry = coalesce(consent_telemetry, false)
WHERE consent_version IS NULL OR consent_at IS NULL;

-- 3. Drop DEFAULT on consent_version and consent_at so all future inserts MUST explicitly supply consent
ALTER TABLE public.guests ALTER COLUMN consent_version DROP DEFAULT;
ALTER TABLE public.guests ALTER COLUMN consent_at DROP DEFAULT;

-- 4. Index on consent_version for fast compliance querying
CREATE INDEX IF NOT EXISTS idx_guests_consent_version ON public.guests (consent_version);
