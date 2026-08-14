-- KyaScene — Milestone 1 schema (spec §11.1)
--
-- Covers only what Milestone 1 needs: the account shell, private student details, the
-- invitation ledger and the reference catalogues. Later tables arrive with the milestone
-- that owns them, per §11.3.
--
-- Every table holding user data has Row Level Security enabled in 20260808000200_rls.sql.
-- §13.1: "Row Level Security enabled before any beta user is added."

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

-- §11.2. Status changes are validated server-side and recorded in admin_audit_logs.
create type public.account_status as enum (
  'invited',
  'email_verified',
  'onboarding',
  'pending_review',
  'approved',
  'rejected',
  'suspended',
  'deletion_pending',
  'deleted'
);

create type public.invite_status as enum ('active', 'expired', 'exhausted', 'revoked');

-- §S06. Australian qualification levels a student may hold.
create type public.study_level as enum (
  'certificate',
  'diploma',
  'bachelor',
  'master',
  'phd',
  'other'
);

-- §S07. Whether the student is already in Sydney.
create type public.arrival_status as enum ('in_sydney', 'arriving_soon', 'not_yet_decided');

-- ---------------------------------------------------------------- helpers

-- Every mutable record carries created_at and updated_at (§11).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles

-- §11.1: "Public-safe account shell". Nothing private belongs here — this is the row that
-- other approved students will eventually be permitted to see, subject to profile_visibility.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_path text,
  status public.account_status not null default 'invited',
  onboarding_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint display_name_length check (
    display_name is null or char_length(display_name) between 1 and 60
  )
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

comment on table public.profiles is
  'Public-safe account shell (spec §11.1). Status transitions are server-controlled.';

-- ---------------------------------------------------------- student_profiles

-- §11.1: "Private student information". Never exposed to another student, at any status.
create table public.student_profiles (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,

  -- §S06 study details
  provider text,
  provider_other text,
  campus text,
  course text,
  study_level public.study_level,
  intake_month smallint,
  intake_year smallint,
  completion_month smallint,
  completion_year smallint,
  student_email text,

  -- §S07 Sydney location. Suburb-level only: no street address, no coordinates (§13.2).
  suburb text,
  postcode text,
  arrival_status public.arrival_status,

  -- §S08 India background
  india_state_code text,
  hometown text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint intake_month_valid check (intake_month is null or intake_month between 1 and 12),
  constraint completion_month_valid check (
    completion_month is null or completion_month between 1 and 12
  ),
  constraint intake_year_valid check (intake_year is null or intake_year between 2000 and 2100),
  constraint completion_year_valid check (
    completion_year is null or completion_year between 2000 and 2100
  ),

  -- §S06: "Completion cannot precede intake." Enforced in the database as well as the form,
  -- because the form is not the only way a row can be written.
  constraint completion_after_intake check (
    intake_year is null
    or completion_year is null
    or (completion_year * 100 + coalesce(completion_month, 1))
       >= (intake_year * 100 + coalesce(intake_month, 1))
  ),

  -- §S07: Australian postcodes are four digits. Sydney is 1000–2249 plus 2555–2574 etc.,
  -- but the range check stays broad — an over-tight rule would wrongly reject a real student.
  constraint postcode_shape check (postcode is null or postcode ~ '^[0-9]{4}$'),

  -- §S08: "Hometown is free text with length and safety limits."
  constraint hometown_length check (hometown is null or char_length(hometown) between 1 and 80),
  constraint course_length check (course is null or char_length(course) between 1 and 120),
  constraint suburb_length check (suburb is null or char_length(suburb) between 1 and 80)
);

create trigger student_profiles_touch_updated_at
  before update on public.student_profiles
  for each row execute function public.touch_updated_at();

comment on table public.student_profiles is
  'Private student information (spec §11.1). Suburb-level location only — §13.2 forbids exact location and street address.';

-- ---------------------------------------------------------------- invites

-- §11.1 invites: "code hash, owner, campaign, capacity, redeemed count, expiry, status".
--
-- The code itself is never stored. A leaked database backup must not yield working invite
-- codes, so only a digest is kept and redemption compares digests.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  owner_user_id uuid references public.profiles (user_id) on delete set null,
  campaign text,
  capacity integer not null default 1,
  redeemed_count integer not null default 0,
  expires_at timestamptz,
  status public.invite_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint capacity_positive check (capacity > 0),
  constraint redeemed_count_not_negative check (redeemed_count >= 0),
  -- §S04: "A code cannot be redeemed beyond its allowance under concurrent requests."
  -- The Edge Function serialises redemption; this constraint is the backstop that makes
  -- over-redemption impossible even if that logic is wrong.
  constraint redeemed_within_capacity check (redeemed_count <= capacity)
);

create trigger invites_touch_updated_at
  before update on public.invites
  for each row execute function public.touch_updated_at();

create index invites_owner_idx on public.invites (owner_user_id);
create index invites_campaign_idx on public.invites (campaign) where campaign is not null;

comment on table public.invites is
  'Invitation ledger (spec §11.1). Stores a digest, never the code itself.';

-- ------------------------------------------------------- invite_redemptions

-- §11.1: "Atomic redemption ledger".
create table public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  redeemed_at timestamptz not null default now(),

  -- §12.4 idempotency: a retried redemption must not create a second row. One redemption
  -- per user per invite, and one redeemed invite per user overall.
  constraint one_redemption_per_user_per_invite unique (invite_id, user_id),
  constraint one_invite_per_user unique (user_id)
);

create index invite_redemptions_invite_idx on public.invite_redemptions (invite_id);

comment on table public.invite_redemptions is
  'Atomic redemption ledger (spec §11.1). Unique on user_id so a tester cannot redeem twice.';

-- ------------------------------------------------------ reference catalogues

-- §11.1. Read-only to clients, maintained by operators. No user data, so these are readable
-- by any authenticated user but writable by nobody through the API.

create table public.india_states (
  code text primary key,
  name text not null,
  is_union_territory boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true
);

comment on table public.india_states is
  'Maintained reference list of Indian states and union territories (spec §S08).';

create table public.education_providers (
  code text primary key,
  name text not null,
  city text,
  sort_order integer not null default 0,
  active boolean not null default true
);

comment on table public.education_providers is
  'Searchable education provider list for §S06. "Not listed" is handled client-side via provider_other.';

alter table public.student_profiles
  add constraint student_profiles_provider_fkey
  foreign key (provider) references public.education_providers (code) on delete set null;

alter table public.student_profiles
  add constraint student_profiles_india_state_fkey
  foreign key (india_state_code) references public.india_states (code) on delete set null;
