-- Migration: 0005_client_events.sql
-- Lightweight, anonymous client error & event telemetry

create table if not exists public.client_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  type text not null check (type in ('error', 'unhandledrejection', 'camera_fail', 'upload_fail', 'warning', 'info')),
  message text not null check (char_length(message) <= 1000),
  route text not null check (char_length(route) <= 255),
  device_class text check (device_class in ('mobile', 'tablet', 'desktop', 'unknown')),
  browser text check (char_length(browser) <= 100),
  os text check (char_length(os) <= 100),
  app_version text check (char_length(app_version) <= 50),
  created_at timestamptz not null default now()
);

create index if not exists client_events_event_idx on public.client_events(event_id, created_at desc);
create index if not exists client_events_type_idx on public.client_events(type, created_at desc);

-- RLS: Only allow allowlisted admin read access; service role has full access
alter table public.client_events enable row level security;

create policy "client_events_admin_select" on public.client_events
  for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.admin_emails a
      where a.email = lower(auth.jwt() ->> 'email')
    )
  );

-- No public insert via anon key; inserts happen through validated /api/telemetry route using service role
