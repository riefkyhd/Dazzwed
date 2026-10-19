-- Migration 0011_multi_event_saas.sql
-- Multi-event isolation, package tiers, and quota anti-tamper locks

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
ADD COLUMN IF NOT EXISTS package_tier text NOT NULL DEFAULT 'owner_unlimited' CHECK (package_tier IN ('pocket_roll', 'classic_35mm', 'grand_archive', 'owner_unlimited')),
ADD COLUMN IF NOT EXISTS package_max_guests integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS package_max_shots_per_guest integer NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS dual_master_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

-- Backfill existing events as owner_unlimited with package_max_shots_per_guest=100
UPDATE public.events
SET
  status = CASE WHEN manually_closed = true THEN 'archived' ELSE 'active' END,
  package_tier = COALESCE(package_tier, 'owner_unlimited'),
  package_max_shots_per_guest = GREATEST(COALESCE(package_max_shots_per_guest, 100), shots_per_guest),
  dual_master_enabled = COALESCE(dual_master_enabled, true)
WHERE package_tier IS NULL OR status IS NULL;

-- Add index on status for quick active event resolution
CREATE INDEX IF NOT EXISTS idx_events_status_created ON public.events (status, created_at DESC);
