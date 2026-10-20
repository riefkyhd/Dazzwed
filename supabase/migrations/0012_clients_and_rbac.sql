-- Migration 0012_clients_and_rbac.sql
-- Multi-Tenant SaaS: Clients table, Client-Event linkage & RBAC

-- 1. Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text,
  access_code text NOT NULL,
  max_events integer NOT NULL DEFAULT 1 CHECK (max_events >= 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive index on email
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_lower ON public.clients (lower(email));

-- 2. Add client_id foreign key to public.events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_client_id ON public.events (client_id);
