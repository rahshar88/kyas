-- Milestone 5: the Scene — public read, and nothing but read (ADR-0007)
--
-- Three claims, each a boundary:
--
--   * A stranger with no session reads the directory: active places and categories.
--   * The same stranger cannot see retired rows, and cannot write anything at all.
--   * Restoring schema usage to `anon` opened ONLY the directory — every person-shaped
--     table still refuses anon at the grant layer, before RLS is even consulted.
--
-- Runs in one transaction that is rolled back. Run with: pnpm run test:rls

\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert(condition boolean, description text)
returns void
language plpgsql
as $$
begin
  if condition then
    raise notice '  ok   %', description;
  else
    raise exception 'FAILED: %', description;
  end if;
end;
$$;

-- A retired place and a retired category, which the public must not see.
insert into public.place_categories (code, label, active) values
  ('retired_cat', 'Closed category', false);
insert into public.places (name, category_code, suburb, active) values
  ('Shut Shop', 'grocery', 'Nowhere', false);

-- ------------------------------------------------------------ anonymous read

set local role anon;

do $$
declare
  visible integer;
begin
  raise notice 'the Scene reads without an account (ADR-0007)';

  select count(*) into visible from public.places where active;
  perform pg_temp.assert(visible >= 8, 'a stranger reads the active directory');

  select count(*) into visible from public.place_categories;
  perform pg_temp.assert(visible >= 4, 'a stranger reads the categories');

  select count(*) into visible from public.places where name = 'Shut Shop';
  perform pg_temp.assert(visible = 0, 'a retired place is invisible, not merely unlisted');

  select count(*) into visible from public.place_categories where code = 'retired_cat';
  perform pg_temp.assert(visible = 0, 'a retired category is invisible too');
end
$$;

-- ----------------------------------------------------------- anonymous write

do $$
declare
  blocked boolean := false;
begin
  begin
    insert into public.places (name, category_code, suburb) values ('Graffiti', 'grocery', 'Nope');
  exception
    when insufficient_privilege then blocked := true;
  end;
  perform pg_temp.assert(blocked, 'a stranger cannot add a place');

  blocked := false;
  begin
    update public.places set name = 'Defaced' where true;
  exception
    when insufficient_privilege then blocked := true;
  end;
  perform pg_temp.assert(blocked, 'a stranger cannot rewrite the directory');

  blocked := false;
  begin
    delete from public.places where true;
  exception
    when insufficient_privilege then blocked := true;
  end;
  perform pg_temp.assert(blocked, 'a stranger cannot empty the directory');
end
$$;

-- ------------------------------------------------- the boundary that matters
--
-- Schema usage was restored to `anon` for the directory. Prove the blast radius is two
-- tables: every table that references a person still refuses anon before RLS is consulted.

do $$
declare
  tbl text;
  blocked boolean;
begin
  raise notice 'people are never public (ADR-0007)';

  foreach tbl in array array[
    'profiles', 'student_profiles', 'profile_languages', 'profile_communities',
    'profile_interests', 'profile_goals', 'profile_visibility', 'consents',
    'verification_requests', 'invites', 'invite_redemptions', 'feature_votes',
    'feedback', 'push_tokens', 'deletion_requests', 'announcements'
  ]
  loop
    blocked := false;
    begin
      execute format('select count(*) from public.%I', tbl);
    exception
      when insufficient_privilege then blocked := true;
    end;
    perform pg_temp.assert(
      blocked,
      format('anon is refused at the grant layer on public.%s', tbl)
    );
  end loop;
end
$$;

-- -------------------------------------------------------- signed-in students

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  visible integer;
  blocked boolean := false;
begin
  raise notice 'students read the same Scene';

  select count(*) into visible from public.places where active;
  perform pg_temp.assert(visible >= 8, 'a signed-in student reads the directory too');

  begin
    insert into public.places (name, category_code, suburb) values ('Mine', 'grocery', 'Nope');
  exception
    when insufficient_privilege then blocked := true;
  end;
  perform pg_temp.assert(blocked, 'a student cannot write the directory either');
end
$$;

reset role;

rollback;
