-- Migration 0003: Photo Metadata Extensions
-- Adds full-res dimensions, capture source, storage tier, filtering status, and original file tracking

alter table public.photos
  add column if not exists width int,
  add column if not exists height int,
  add column if not exists source text not null default 'inapp'
    check (source in ('inapp', 'native')),
  add column if not exists tier text not null default 'high'
    check (tier in ('original', 'high', 'standard', 'lite')),
  add column if not exists filtered boolean not null default true,
  add column if not exists original_drive_file_id text;

-- Create index on source and tier for admin metrics reporting
create index if not exists photos_source_tier_idx on public.photos(event_id, source, tier);
