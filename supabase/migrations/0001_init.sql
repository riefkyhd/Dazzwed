-- Disposable Cam — initial schema. Run in Supabase SQL editor (region: Singapore).

-- ============ Tables ============
-- (gen_random_uuid() is built into Postgres 13+, no extension needed)

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  couple_names text not null,
  shots_per_guest int not null default 15 check (shots_per_guest between 1 and 100),
  opens_at timestamptz,
  closes_at timestamptz,
  manually_closed boolean not null default false,
  theme jsonb not null default '{}'::jsonb,
  drive_root_folder_id text,
  created_at timestamptz not null default now(),
  check (opens_at is null or closes_at is null or opens_at < closes_at)
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  drive_folder_id text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index guests_event_idx on public.guests(event_id);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  shot_id uuid not null unique,
  drive_file_id text,
  size_bytes int check (size_bytes is null or size_bytes > 0),
  status text not null default 'pending'
    check (status in ('pending','confirmed','failed','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index photos_guest_status_idx on public.photos(guest_id, status);
create index photos_event_status_idx on public.photos(event_id, status);

-- Admin allowlist (RLS cannot read env vars). Keep in sync with ADMIN_EMAILS.
create table public.admin_emails (
  email text primary key check (email = lower(email))
);

-- Rate limit buckets (used in Phase 6)
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- ============ RLS ============
alter table public.events       enable row level security;
alter table public.guests       enable row level security;
alter table public.photos       enable row level security;
alter table public.admin_emails enable row level security;
alter table public.rate_limits  enable row level security;
-- No policies for anon => anon has zero access. service_role bypasses RLS.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) and coalesce(auth.jwt() ->> 'role', '') = 'authenticated';
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy events_admin on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy guests_admin on public.guests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy photos_admin on public.photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_emails_read on public.admin_emails for select to authenticated
  using (public.is_admin());
-- rate_limits: no policies => server-only.

revoke all on all tables in schema public from anon;

-- ============ Atomic shot reservation ============
-- outcome: reserved | duplicate | limit_reached | not_found
create or replace function public.reserve_shot(
  p_event_id uuid, p_guest_id uuid, p_shot_id uuid
) returns table (outcome text, photo_id uuid, status text, drive_file_id text, shots_used int)
language plpgsql security definer set search_path = public as $$
declare
  v_limit int; v_guest_event uuid; v_used int; v_photo public.photos%rowtype;
begin
  -- Row lock serializes all reservations for this guest => cannot race past the limit.
  select g.event_id into v_guest_event from guests g where g.id = p_guest_id for update;
  if v_guest_event is null or v_guest_event <> p_event_id then
    return query select 'not_found'::text, null::uuid, null::text, null::text, 0; return;
  end if;
  select e.shots_per_guest into v_limit from events e where e.id = p_event_id;

  -- Expire abandoned reservations (e.g. crashed function) so they free the slot.
  update photos p set status = 'failed', updated_at = now()
   where p.guest_id = p_guest_id and p.status = 'pending'
     and p.updated_at < now() - interval '10 minutes';

  select count(*)::int into v_used from photos p
   where p.guest_id = p_guest_id and p.status <> 'failed';

  select * into v_photo from photos p where p.shot_id = p_shot_id;
  if found then
    if v_photo.guest_id <> p_guest_id then
      return query select 'not_found'::text, null::uuid, null::text, null::text, v_used; return;
    end if;
    if v_photo.status = 'failed' then
      if v_used >= v_limit then
        return query select 'limit_reached'::text, v_photo.id, v_photo.status, null::text, v_used; return;
      end if;
      update photos p set status = 'pending', updated_at = now()
       where p.id = v_photo.id returning * into v_photo;
      return query select 'reserved'::text, v_photo.id, v_photo.status, null::text, v_used + 1; return;
    end if;
    return query select 'duplicate'::text, v_photo.id, v_photo.status, v_photo.drive_file_id, v_used; return;
  end if;

  if v_used >= v_limit then
    return query select 'limit_reached'::text, null::uuid, null::text, null::text, v_used; return;
  end if;

  insert into photos (event_id, guest_id, shot_id, status)
  values (p_event_id, p_guest_id, p_shot_id, 'pending') returning * into v_photo;
  return query select 'reserved'::text, v_photo.id, v_photo.status, null::text, v_used + 1;
end $$;
revoke all on function public.reserve_shot(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_shot(uuid,uuid,uuid) to service_role;

-- Release a reservation after a Drive failure
create or replace function public.release_shot(p_shot_id uuid) returns void
language sql security definer set search_path = public as $$
  update photos set status = 'failed', updated_at = now()
   where shot_id = p_shot_id and status = 'pending';
$$;
revoke all on function public.release_shot(uuid) from public, anon, authenticated;
grant execute on function public.release_shot(uuid) to service_role;
