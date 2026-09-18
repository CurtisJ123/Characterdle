-- Run manually in STAGING. The application does not execute this script.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('character-portraits', 'character-portraits', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public."AdminCatalogCreations" (
  request_id uuid primary key,
  resource_type text not null check (resource_type in ('character', 'quote')),
  request_hash text not null,
  resource_id bigint not null,
  created_at timestamptz not null default now()
);
alter table public."AdminCatalogCreations" enable row level security;
revoke all on table public."AdminCatalogCreations" from public, anon, authenticated;

commit;
