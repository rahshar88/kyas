-- KyaScene — Milestone 2 schema (spec §11.1, §21.4)
--
-- Adds the tables S09–S17 and the admin approval workflow need, and nothing else. §11.3:
-- "Do not create empty future tables merely to appear complete." Connections, posts, reports
-- and the rest still belong to their own milestones.
--
-- Row Level Security for everything here lives in 20260813000200_m2_rls.sql, and is enabled
-- in the same deployment — §13.1 requires RLS before any beta user exists.
--
-- A note on where rules are enforced. Anything expressible as a constraint is a constraint,
-- because the form is not the only way a row can be written: an Edge Function, a psql session
-- or a future admin tool can all reach these tables. Rules that need to count rows across a
-- table (S11's "at least three interests") cannot be a CHECK and are enforced in
-- submit-registration instead, where the count happens inside the same transaction.

-- ---------------------------------------------------------------- enums

-- §S09. Ordered strongest to weakest; the order is meaningful for later recommendations.
create type public.language_proficiency as enum (
  'native',
  'fluent',
  'conversational',
  'learning'
);

-- §S15. Each policy type is consented to separately — "required and optional consent must
-- never be bundled", so marketing is a row of its own that may legitimately be false.
create type public.consent_policy_type as enum (
  'terms',
  'privacy',
  'community_guidelines',
  'beta_changes',
  'marketing'
);

-- §11.1 verification_requests. Distinct from account_status: a user has one status, but may
-- accumulate several review requests over time (resubmission after a rejection).
create type public.verification_state as enum (
  'pending',
  'approved',
  'rejected',
  'withdrawn'
);

/**
 * §S17: "Read reason category and contact support. Avoid exposing internal moderation notes."
 *
 * The category is the ONLY rejection detail a student ever sees, which is why it is a closed
 * enum rather than free text — free text written by an operator would inevitably leak internal
 * reasoning to the person it is about. The operator's actual notes live in
 * admin_audit_logs.reason, which no student can read.
 */
create type public.rejection_category as enum (
  'not_eligible',
  'incomplete_information',
  'unable_to_verify_study',
  'duplicate_account',
  'safety_concern',
  'other'
);

-- §15.2: "Admin roles are separate from student roles."
create type public.admin_role as enum ('operator', 'administrator');

-- §13.3 / §15.1. Every administrative action is recorded under one of these.
create type public.admin_action as enum (
  'registration_approved',
  'registration_rejected',
  'user_suspended',
  'user_reinstated',
  'avatar_hidden',
  'display_name_cleared'
);

-- ------------------------------------------------------- reference catalogues

/**
 * §S09 languages. Seeded in supabase/seed/03-languages.sql.
 *
 * `code` is a stable identifier used by analytics (§S12: "Record category identifiers, not
 * free-text personal information"), so it must never be renamed once shipped — the label can
 * change freely, the code cannot.
 */
create table public.languages (
  code text primary key,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint languages_code_shape check (code ~ '^[a-z][a-z0-9_]{1,31}$')
);

comment on table public.languages is
  'Language catalogue (spec §11.1, §S09). Codes are permanent; labels may change.';

-- §S10 cultural communities. "Never inferred from state, language or religion" — this is a
-- catalogue the user picks from directly, with no derivation from any other field.
create table public.communities (
  code text primary key,
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint communities_code_shape check (code ~ '^[a-z][a-z0-9_]{1,31}$')
);

comment on table public.communities is
  'Cultural community catalogue (spec §11.1, §S10). Self-identified only, never inferred.';

-- §S11 interests. `category` groups them in the picker.
create table public.interests (
  code text primary key,
  label text not null,
  category text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint interests_code_shape check (code ~ '^[a-z][a-z0-9_]{1,31}$')
);

comment on table public.interests is 'Interest catalogue (spec §11.1, §S11).';

-- §S12 goals.
create table public.goals (
  code text primary key,
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint goals_code_shape check (code ~ '^[a-z][a-z0-9_]{1,31}$')
);

comment on table public.goals is 'Goal catalogue (spec §11.1, §S12).';

-- ------------------------------------------------------------ user relations

/**
 * §S09: "Duplicate language entries are prevented."
 *
 * Structural rather than validated: the primary key makes a duplicate impossible, so the
 * acceptance criterion holds even for a caller that never touches our form.
 */
create table public.profile_languages (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  language_code text not null references public.languages (code) on delete restrict,
  proficiency public.language_proficiency not null,
  created_at timestamptz not null default now(),

  primary key (user_id, language_code)
);

create index profile_languages_user_idx on public.profile_languages (user_id);

-- §S10. Optional and multi-select. The "prefer not to specify" case is a column on
-- student_profiles below, not a magic row here, so "no communities selected" and "declined to
-- say" stay distinguishable — they mean different things to a recommendation engine.
create table public.profile_communities (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  community_code text not null references public.communities (code) on delete restrict,
  created_at timestamptz not null default now(),

  primary key (user_id, community_code)
);

create index profile_communities_user_idx on public.profile_communities (user_id);

-- §S11. The "at least three" rule is a submission-time check, not a row constraint.
create table public.profile_interests (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  interest_code text not null references public.interests (code) on delete restrict,
  created_at timestamptz not null default now(),

  primary key (user_id, interest_code)
);

create index profile_interests_user_idx on public.profile_interests (user_id);

/**
 * §S12: "Select up to five and rank the top need."
 *
 * Both halves are structural. `rank between 1 and 5` plus a unique rank per user means a
 * sixth goal has no valid rank to occupy — the maximum is enforced by the shape of the table
 * rather than by a count someone has to remember to write.
 */
create table public.profile_goals (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  goal_code text not null references public.goals (code) on delete restrict,
  rank smallint not null,
  created_at timestamptz not null default now(),

  primary key (user_id, goal_code),
  constraint profile_goals_rank_range check (rank between 1 and 5),
  constraint profile_goals_rank_unique unique (user_id, rank)
    deferrable initially deferred
);

create index profile_goals_user_idx on public.profile_goals (user_id);

comment on constraint profile_goals_rank_unique on public.profile_goals is
  'Deferrable so a reorder can swap two ranks inside one transaction without a temporary
   collision. Still enforced at commit.';

-- ------------------------------------------------------------ S10 opt-out

/**
 * §S10: "Prefer not to specify clears other selections."
 *
 * Kept on student_profiles because it is an answer to a registration question, not a
 * visibility setting. The trigger in 20260813000200_m2_rls.sql makes the clearing automatic,
 * so the acceptance criterion cannot be defeated by writing the flag and the rows in the
 * wrong order.
 */
alter table public.student_profiles
  add column communities_not_specified boolean not null default false;

comment on column public.student_profiles.communities_not_specified is
  'S10 "prefer not to specify". Distinct from "none selected yet" — setting it clears
   profile_communities.';

-- --------------------------------------------------------- profile_visibility

/**
 * §S14 per-field privacy choices.
 *
 * Defaults are all false. §S14: "Defaults: Conservative". A row created by a partially
 * completed registration therefore reveals nothing, which is the correct failure direction —
 * a bug that skips this screen under-shares rather than over-shares.
 *
 * There is deliberately no column for email, telephone or exact location. §13.2 forbids a
 * public email or telephone number and any exact location outright, so those are not settings
 * a user can get wrong: the capability does not exist.
 */
create table public.profile_visibility (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,

  show_suburb boolean not null default false,
  show_india_state boolean not null default false,
  show_hometown boolean not null default false,
  show_languages boolean not null default false,
  show_communities boolean not null default false,
  show_study boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profile_visibility_touch_updated_at
  before update on public.profile_visibility
  for each row execute function public.touch_updated_at();

comment on table public.profile_visibility is
  'Per-field privacy choices (spec §11.1, §S14). Conservative by default; no contact or exact
   location field exists at all (§13.2).';

-- ---------------------------------------------------------------- consents

/**
 * §S15: "Store policy type, version, accepted timestamp and user ID."
 *
 * One row per (user, policy type, version). Versioned because a policy change requires fresh
 * consent, and the evidence of the old acceptance must survive that change — so rows are
 * append-only rather than updated in place. There is no update or delete policy anywhere.
 */
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  policy_type public.consent_policy_type not null,
  version text not null,
  accepted boolean not null,
  accepted_at timestamptz not null default now(),

  constraint consents_version_shape check (char_length(version) between 1 and 32),
  constraint consents_unique_per_version unique (user_id, policy_type, version)
);

create index consents_user_idx on public.consents (user_id);

comment on table public.consents is
  'Versioned consent evidence (spec §11.1, §S15). Append-only: no update or delete policy
   exists, because consent history is the record.';

-- ------------------------------------------------------ verification_requests

/**
 * §11.1: "Manual student review."
 *
 * §S16: "Submission is idempotent… repeated taps cannot create duplicate registration
 * records." The partial unique index below is what guarantees that — a second pending request
 * cannot exist, no matter how many times submit is tapped or how the taps interleave. A
 * resubmission after a rejection is a genuinely new row, which is why the index is partial
 * rather than a plain unique on user_id.
 */
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  state public.verification_state not null default 'pending',

  -- §11.1 "method". P0 has no document upload (§13.2), so this records how the claim was
  -- substantiated: currently only a self-declaration plus an institutional email domain.
  method text not null default 'self_declared',

  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references auth.users (id) on delete set null,

  -- Shown to the student. Never free text — see the rejection_category comment above.
  rejection_category public.rejection_category,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint verification_reviewed_consistently check (
    (state in ('pending', 'withdrawn') and reviewed_at is null and reviewer_id is null)
    or (state in ('approved', 'rejected') and reviewed_at is not null)
  ),
  constraint verification_rejection_has_category check (
    (state = 'rejected') = (rejection_category is not null)
  )
);

create unique index verification_requests_one_pending
  on public.verification_requests (user_id)
  where state = 'pending';

create index verification_requests_queue_idx
  on public.verification_requests (state, submitted_at);

create trigger verification_requests_touch_updated_at
  before update on public.verification_requests
  for each row execute function public.touch_updated_at();

comment on index public.verification_requests_one_pending is
  'S16 idempotency: at most one pending review per user, enforced by the database rather than
   by the client not double-tapping.';

-- ---------------------------------------------------------------- admin_users

/**
 * §15.2: "Admin roles are separate from student roles" and "never rely only on hidden
 * navigation for authorisation."
 *
 * Membership of this table is the ONLY thing that grants administrative authority. It is not
 * a column on profiles, because a student-editable table must never be able to describe its
 * own privileges, and RLS on profiles permits a student to update their own row.
 *
 * No client — student or admin — can read this table. Authorisation is decided inside
 * SECURITY DEFINER functions and Edge Functions, so a compromised admin session cannot
 * enumerate the operator list.
 */
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.admin_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger admin_users_touch_updated_at
  before update on public.admin_users
  for each row execute function public.touch_updated_at();

comment on table public.admin_users is
  'Administrative authority (spec §15.2). Separate from profiles by design: a table a student
   can update must never describe that student''s privileges.';

-- ------------------------------------------------------------ admin_audit_logs

/**
 * §11.1: "Immutable administrative history." §13.1: "Admin actions authenticated, authorised
 * and audited." §11.2: "Status changes must be validated server-side and recorded in
 * admin_audit_logs."
 *
 * Immutability is enforced by a trigger rather than by convention — see
 * 20260813000200_m2_rls.sql. `reason` is the operator's own words and is never shown to the
 * subject; §15.2: "Rejected users do not see private moderator notes."
 */
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users (id) on delete restrict,
  action public.admin_action not null,
  target_user_id uuid references auth.users (id) on delete set null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  -- §15.2: "Sensitive actions require a reason." An empty string is not a reason.
  constraint admin_audit_reason_present check (char_length(btrim(reason)) between 3 and 2000)
);

create index admin_audit_logs_target_idx on public.admin_audit_logs (target_user_id, created_at desc);
create index admin_audit_logs_actor_idx on public.admin_audit_logs (actor_id, created_at desc);

comment on table public.admin_audit_logs is
  'Immutable administrative history (spec §11.1, §13.1). Append-only, enforced by trigger.
   `reason` is internal and never shown to the affected user (§15.2).';

comment on column public.admin_audit_logs.actor_id is
  'ON DELETE RESTRICT: an audit trail that can be erased by deleting the actor is not an
   audit trail.';
