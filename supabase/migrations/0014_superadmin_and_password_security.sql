-- Migration 0014_superadmin_and_password_security.sql
-- Multi-Tenant SaaS: Superadmin Role, Provisioning & Self-Service Password Security

-- 1. Add role column to public.clients if not exists
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'client' CHECK (role IN ('superadmin', 'client'));

-- Index on role for fast lookups
CREATE INDEX IF NOT EXISTS idx_clients_role ON public.clients (role);

-- 2. Upsert superadmin account for riefky.hd@gmail.com
INSERT INTO public.clients (
  name,
  email,
  access_code,
  max_events,
  status,
  role,
  notes,
  updated_at
)
VALUES (
  'Muhammad Riefky Hadid',
  'riefky.hd@gmail.com',
  'SUPERADM',
  999,
  'active',
  'superadmin',
  'Platform Owner / Superadmin',
  now()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'superadmin',
  status = 'active',
  max_events = 999,
  notes = 'Platform Owner / Superadmin',
  updated_at = now();
