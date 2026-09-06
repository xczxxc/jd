-- =====================================================================
-- LoveNest — skema database Supabase
-- Jalankan seluruh isi file ini di Supabase → SQL Editor → Run
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- PROFIL (hanya 2 baris: boy & girl) ----------
create table if not exists public.profiles (
  id           text primary key check (id in ('boy','girl')),
  display_name text not null default 'Sayang',
  avatar_url   text,
  bio          text,
  updated_at   timestamptz not null default now()
);

insert into public.profiles (id, display_name) values
  ('boy','Dia'), ('girl','Kamu')
on conflict (id) do nothing;

-- ---------- PENGATURAN BERSAMA ----------
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null default '{}'::jsonb
);

insert into public.settings (key, value) values
  ('relationship', '{"start_date":"2026-06-19"}'::jsonb)
on conflict (key) do nothing;

-- ---------- CHAT ----------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  sender     text not null check (sender in ('boy','girl')),
  kind       text not null default 'text' check (kind in ('text','image','audio','call')),
  body       text,
  media_url  text,
  media_path text,
  duration   int,
  reply_to   uuid references public.messages(id) on delete set null,
  reply_snip text,
  reaction   text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages (created_at desc);

-- ---------- GALERI MOMENT ----------
create table if not exists public.moments (
  id          uuid primary key default gen_random_uuid(),
  url         text not null,
  path        text not null,
  caption     text,
  uploaded_by text not null check (uploaded_by in ('boy','girl')),
  width       int,
  height      int,
  bytes       int,
  original_bytes int,
  taken_at    date,
  created_at  timestamptz not null default now()
);
create index if not exists moments_created_idx on public.moments (created_at desc);

-- ---------- SIKLUS HAID ----------
create table if not exists public.periods (
  id         uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date   date,
  flow       text default 'sedang' check (flow in ('ringan','sedang','berat')),
  symptoms   text[],
  note       text,
  created_at timestamptz not null default now()
);
create unique index if not exists periods_start_uidx on public.periods (start_date);

-- ---------- AGENDA / KALENDER BERSAMA ----------
create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  date       date not null,
  kind       text not null default 'agenda' check (kind in ('agenda','anniversary','ulangtahun','date')),
  note       text,
  created_by text not null check (created_by in ('boy','girl')),
  created_at timestamptz not null default now()
);
create index if not exists events_date_idx on public.events (date);

-- ---------- GAME (state realtime) ----------
create table if not exists public.game_rooms (
  id         text primary key,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.game_rooms (id, state) values
  ('snake', '{}'::jsonb),
  ('draw',  '{}'::jsonb)
on conflict (id) do nothing;

-- =====================================================================
-- RLS
-- Aplikasi ini hanya dipakai 2 orang dan sudah dikunci login sendiri
-- (kode login disimpan di environment variable, dicek di server).
-- Jadi policy di sini dibuat permisif untuk anon key.
-- =====================================================================
alter table public.profiles   enable row level security;
alter table public.settings   enable row level security;
alter table public.messages   enable row level security;
alter table public.moments    enable row level security;
alter table public.periods    enable row level security;
alter table public.events     enable row level security;
alter table public.game_rooms enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','settings','messages','moments','periods','events','game_rooms'] loop
    execute format('drop policy if exists "ln_all_%1$s" on public.%1$I', t);
    execute format('create policy "ln_all_%1$s" on public.%1$I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- REALTIME ----------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.moments;
alter publication supabase_realtime add table public.periods;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.game_rooms;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.settings;

alter table public.messages replica identity full;
alter table public.game_rooms replica identity full;

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public) values
  ('media','media',true), ('moments','moments',true), ('avatars','avatars',true)
on conflict (id) do nothing;

drop policy if exists "ln_storage_read"   on storage.objects;
drop policy if exists "ln_storage_write"  on storage.objects;
drop policy if exists "ln_storage_delete" on storage.objects;

create policy "ln_storage_read" on storage.objects for select
  using (bucket_id in ('media','moments','avatars'));
create policy "ln_storage_write" on storage.objects for insert
  with check (bucket_id in ('media','moments','avatars'));
create policy "ln_storage_delete" on storage.objects for delete
  using (bucket_id in ('media','moments','avatars'));
