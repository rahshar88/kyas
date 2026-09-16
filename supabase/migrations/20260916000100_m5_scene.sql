-- Milestone 5: the Scene — public places & services (ADR-0007)
--
-- The first tables in this database that an ANONYMOUS caller may read. That is a deliberate
-- posture change, decided by the founder on 16 Sep 2026 and recorded in ADR-0007: KyaScene
-- gains a public side — a curated directory of Indian places and services in Australia —
-- while the student community stays private and invite-gated.
--
-- The boundary, stated where it is enforced: PLACES ARE PUBLIC, PEOPLE ARE NEVER PUBLIC.
-- Nothing here references a user, and no policy in this file touches any table that does.
-- Every person-shaped table keeps the posture of 20260808000400_lock_down_anon.sql: no anon
-- grant, RLS owned-rows-only for authenticated. The membership-privacy rules (§2.3, §13,
-- count-never-names) are untouched by this migration.

-- --------------------------------------------------------------- categories

create table public.place_categories (
  code text primary key,
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint place_categories_code_shape check (code ~ '^[a-z][a-z0-9_]{1,31}$')
);

comment on table public.place_categories is
  'Scene directory categories (ADR-0007). Public-read catalogue, curated by operators only.';

-- ------------------------------------------------------------------- places

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_code text not null references public.place_categories (code),
  suburb text not null,
  state_code text not null default 'NSW',
  address text,
  url text,
  phone text,
  description text,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint places_name_length check (char_length(name) between 1 and 120),
  constraint places_suburb_length check (char_length(suburb) between 1 and 60),
  -- AU states only; the directory is "Indian Australia", not a world gazetteer.
  constraint places_state_shape check (state_code in ('NSW','VIC','QLD','SA','WA','TAS','ACT','NT')),
  constraint places_description_length check (description is null or char_length(description) <= 600),
  -- A URL a stranger will tap gets the same shape check a browser would apply.
  constraint places_url_shape check (url is null or url ~ '^https://')
);

comment on table public.places is
  'The Scene: curated Indian places & services (ADR-0007). Public-read of active rows; '
  'no client writes — curation is an operator act. Contains no personal data by design.';

create index places_category_idx on public.places (category_code, active, sort_order);

create trigger places_touch_updated_at
  before update on public.places
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- the reach
--
-- 20260808000400_lock_down_anon.sql revoked schema usage from `anon` and set default
-- privileges to deny it, so a stranger reaches NOTHING unless it is named here. Restoring
-- `usage` re-opens only name resolution: every other table still has no anon grant (layer
-- one) and an owner-or-authenticated-only policy (layer two). Defence in depth holds for
-- everything person-shaped; these two tables opt in explicitly, read-only, active rows only.

grant usage on schema public to anon;

alter table public.place_categories enable row level security;
alter table public.places enable row level security;

create policy "place_categories: public read" on public.place_categories
  for select to anon, authenticated using (active);

create policy "places: public read" on public.places
  for select to anon, authenticated using (active);

grant select on public.place_categories to anon, authenticated;
grant select on public.places to anon, authenticated;

-- No insert/update/delete policies and no write grants for either role: a client session can
-- never write the directory. Curation happens as an operator (service role via the console
-- or SQL editor), which bypasses RLS by design and is audited by being a human act.
