-- Film Roll Postcard — shareable rolls.
-- Paste into Supabase → SQL Editor → Run (or `supabase db push`).
--
-- Access model: the browser never talks to Supabase directly. Every read and
-- write goes through the Vercel functions in /api using the service-role key,
-- so RLS is ON with NO policies — the anon key can't list or read anything.

create table if not exists public.rolls (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  delete_token_hash text not null,

  recipient  text not null check (char_length(recipient) between 1 and 40),
  sender     text          check (char_length(sender) <= 40),
  note       text          check (char_length(note) <= 280),
  stock      text not null default 'OKROMA 100',

  -- [{ path, width, height, alt }] — filled in on publish
  frames       jsonb not null default '[]'::jsonb,
  -- storage paths handed out at create time; publish may only use these
  upload_paths text[] not null default '{}',

  status     text not null default 'pending' check (status in ('pending', 'live')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.rolls enable row level security;

create index if not exists rolls_pending_idx on public.rolls (created_at) where status = 'pending';

-- Public bucket: objects are readable by exact URL (paths are random, under a
-- random roll id), but with no storage.objects policies nobody can list them.
-- Uploads only happen through signed upload URLs minted by /api/rolls.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rolls', 'rolls', true, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
