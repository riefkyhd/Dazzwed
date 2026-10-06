-- Migration 0004: Look Engine
-- Add look metadata to photos and event look configurations

alter table public.photos
  add column if not exists look_id text default 'disposable-400',
  add column if not exists look_version int default 1;

create index if not exists photos_look_id_idx on public.photos(event_id, look_id);
