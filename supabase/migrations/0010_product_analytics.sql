-- Migration 0010_product_analytics.sql
-- Audit-Safe Product & Filter Usage Analytics (Zero-Overhead, UU PDP Compliant)

-- 1. Add preset_id to public.photos for gallery filtering and historical audit
ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS preset_id text;

CREATE INDEX IF NOT EXISTS idx_photos_event_preset ON public.photos (event_id, preset_id);

-- 2. Create anonymous aggregate counter table for zero-PII event metrics
CREATE TABLE IF NOT EXISTS public.event_metrics (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  metric_key text NOT NULL,
  count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, metric_type, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_event_metrics_event_type ON public.event_metrics (event_id, metric_type);

-- 3. Atomic counter increment RPC
CREATE OR REPLACE FUNCTION public.increment_event_metric(
  p_event_id uuid,
  p_metric_type text,
  p_metric_key text,
  p_delta bigint DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.event_metrics (event_id, metric_type, metric_key, count, updated_at)
  VALUES (p_event_id, p_metric_type, p_metric_key, p_delta, now())
  ON CONFLICT (event_id, metric_type, metric_key)
  DO UPDATE SET
    count = public.event_metrics.count + EXCLUDED.count,
    updated_at = now();
END;
$$;
