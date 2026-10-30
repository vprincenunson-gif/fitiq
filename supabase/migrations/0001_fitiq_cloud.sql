-- ─────────────────────────────────────────────────────────────────────────────
-- FITIQ cloud schema
--
-- Run this once in the Supabase SQL editor (or with `supabase db push`).
-- It creates the metadata tables, a PRIVATE photo bucket, and strict
-- Row Level Security so a user can only ever read or write their own rows
-- and their own folder inside Storage.
--
-- No service-role key is required by the app. The browser only uses the
-- publishable/anon key and RLS enforces ownership.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Metadata tables ─────────────────────────────────────────────────────────

create table if not exists public.wardrobe_items (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  -- Gender-inclusive category ids. See 0002 for the migration that expands
  -- this list on projects where 0001 was already applied.
  category text not null constraint wardrobe_items_category_check check (
    category in (
      'shirt', 'blouse', 'top', 'pants', 'jeans', 'skirt',
      'dress', 'jumpsuit', 'ethnic', 'shoes', 'accessory'
    )
  ),
  color text not null,
  color_label text not null default '',
  style_tags text[] not null default '{}',
  fit text not null default 'regular' check (fit in ('slim', 'regular', 'relaxed')),
  wear_status text not null default 'ready'
    check (wear_status in ('ready', 'needs-ironing', 'worn', 'in-laundry')),
  wear_count integer not null default 0 check (wear_count >= 0),
  last_worn_at timestamptz,
  -- Bundled SVG path for sample artwork (no upload).
  image_path text,
  -- Private Storage object path, e.g. "<user-id>/gar_<uuid>.jpg".
  photo_path text,
  source text not null default 'scanned' check (source in ('scanned', 'sample')),
  scanned_at timestamptz,
  favorite boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.wear_log (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date_key date not null,
  worn_at timestamptz not null,
  garment_ids text[] not null default '{}',
  outfit_id text,
  source text not null default 'planner' check (source in ('planner', 'saved')),
  created_at timestamptz not null default now()
);

create table if not exists public.saved_outfits (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  garment_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planner_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date_key date not null,
  outfit_id text,
  occasion text,
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

create table if not exists public.style_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  fit text check (fit in ('slim', 'regular', 'relaxed')),
  favorite_colors text[] not null default '{}',
  likes text[] not null default '{}',
  avoids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- A row may only reference an object inside its owner's Storage folder, so a
-- stolen path can never be attached to another account's row.
alter table public.wardrobe_items drop constraint if exists wardrobe_items_photo_path_owner;
alter table public.wardrobe_items add constraint wardrobe_items_photo_path_owner
  check (photo_path is null or photo_path like user_id::text || '/%');

create index if not exists wardrobe_items_user_id_idx on public.wardrobe_items (user_id);
create index if not exists wear_log_user_id_idx on public.wear_log (user_id);
create index if not exists wear_log_user_date_idx on public.wear_log (user_id, date_key);
create index if not exists saved_outfits_user_id_idx on public.saved_outfits (user_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- `force` also applies RLS to the table owner. Only the service role bypasses
-- it, and the service role never reaches the browser.

alter table public.wardrobe_items enable row level security;
alter table public.wardrobe_items force row level security;
alter table public.wear_log enable row level security;
alter table public.wear_log force row level security;
alter table public.saved_outfits enable row level security;
alter table public.saved_outfits force row level security;
alter table public.planner_days enable row level security;
alter table public.planner_days force row level security;
alter table public.style_profiles enable row level security;
alter table public.style_profiles force row level security;

drop policy if exists "wardrobe_own_rows" on public.wardrobe_items;
create policy "wardrobe_own_rows" on public.wardrobe_items
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "wear_log_own_rows" on public.wear_log;
create policy "wear_log_own_rows" on public.wear_log
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "saved_outfits_own_rows" on public.saved_outfits;
create policy "saved_outfits_own_rows" on public.saved_outfits
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "planner_days_own_rows" on public.planner_days;
create policy "planner_days_own_rows" on public.planner_days
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "style_profiles_own_row" on public.style_profiles;
create policy "style_profiles_own_row" on public.style_profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Belt and braces: anonymous visitors have no table privileges at all.
revoke all on public.wardrobe_items from anon;
revoke all on public.wear_log from anon;
revoke all on public.saved_outfits from anon;
revoke all on public.planner_days from anon;
revoke all on public.style_profiles from anon;

grant select, insert, update, delete on public.wardrobe_items to authenticated;
grant select, insert, update, delete on public.wear_log to authenticated;
grant select, insert, update, delete on public.saved_outfits to authenticated;
grant select, insert, update, delete on public.planner_days to authenticated;
grant select, insert, update, delete on public.style_profiles to authenticated;

-- ── Private photo bucket ────────────────────────────────────────────────────
-- Original captures only. The bucket is private; the app reads short-lived
-- signed URLs and never stores a public URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wardrobe-photos',
  'wardrobe-photos',
  false,
  10485760, -- 10 MB per original capture
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fitiq_photos_select_own" on storage.objects;
create policy "fitiq_photos_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'wardrobe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fitiq_photos_insert_own" on storage.objects;
create policy "fitiq_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'wardrobe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fitiq_photos_update_own" on storage.objects;
create policy "fitiq_photos_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'wardrobe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'wardrobe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fitiq_photos_delete_own" on storage.objects;
create policy "fitiq_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'wardrobe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
