-- Row Level Security tests (spec §20)
--
-- > "Row Level Security tests prove that one user cannot read another user's private
-- >  records."
--
-- Each block impersonates a real signed-in user by setting `request.jwt.claim.sub`, exactly
-- as PostgREST does for a live request, and raises an exception if the policy behaves wrongly.
-- The whole file runs in one transaction that is rolled back, so it leaves no residue.
--
-- Run with: pnpm run test:rls

\set ON_ERROR_STOP on

begin;

-- Two students who must never be able to see each other, and an operator-owned invite.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'asha@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'rohan@example.test');

insert into public.profiles (user_id, display_name, status) values
  ('11111111-1111-1111-1111-111111111111', 'Asha', 'onboarding'),
  ('22222222-2222-2222-2222-222222222222', 'Rohan', 'approved');

insert into public.student_profiles (user_id, suburb, hometown) values
  ('11111111-1111-1111-1111-111111111111', 'Ultimo', 'Kochi'),
  ('22222222-2222-2222-2222-222222222222', 'Parramatta', 'Ludhiana');

insert into public.invites (id, code_hash, capacity, redeemed_count) values
  ('33333333-3333-3333-3333-333333333333', 'digest-of-a-secret-code', 5, 1);

insert into public.invite_redemptions (invite_id, user_id) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222');

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

-- Impersonate Asha for every check below.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  visible integer;
begin
  raise notice 'profiles';

  select count(*) into visible from public.profiles;
  perform pg_temp.assert(visible = 1, 'a student sees exactly one profile row — their own');

  select count(*) into visible
    from public.profiles where user_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.assert(visible = 0, 'a student cannot read another student''s profile');

  raise notice 'student_profiles (private data, §11.1)';

  select count(*) into visible from public.student_profiles;
  perform pg_temp.assert(visible = 1, 'a student sees only their own private record');

  select count(*) into visible
    from public.student_profiles where hometown = 'Ludhiana';
  perform pg_temp.assert(visible = 0, 'another student''s hometown is not readable');

  select count(*) into visible
    from public.student_profiles where suburb = 'Parramatta';
  perform pg_temp.assert(visible = 0, 'another student''s suburb is not readable (§13.2)');
end
$$;

-- §11.2 / §20: status is server-controlled. A student must not be able to approve themselves.
do $$
declare
  blocked boolean := false;
begin
  raise notice 'privileged columns';

  begin
    update public.profiles
      set status = 'approved'
      where user_id = '11111111-1111-1111-1111-111111111111';
  exception
    when insufficient_privilege then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'a student cannot promote their own status to approved');

  blocked := false;
  begin
    update public.profiles
      set onboarding_version = 99
      where user_id = '11111111-1111-1111-1111-111111111111';
  exception
    when insufficient_privilege then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'a student cannot change their own onboarding_version');
end
$$;

do $$
declare
  changed integer;
begin
  -- The permitted edit still works, or the policy would be uselessly strict.
  update public.profiles
    set display_name = 'Asha K'
    where user_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics changed = row_count;
  perform pg_temp.assert(changed = 1, 'a student can still edit their own display name');

  update public.profiles
    set display_name = 'hijacked'
    where user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics changed = row_count;
  perform pg_temp.assert(changed = 0, 'a student cannot edit another student''s profile');
end
$$;

-- §S04 / §S19: the invite ledger is not client-readable at all.
do $$
declare
  denied boolean := false;
  visible integer;
begin
  raise notice 'invites';

  begin
    select count(*) into visible from public.invites;
    -- If SELECT is permitted at all, the ledger must still be empty to this student. Either
    -- outcome is acceptable; a readable row is not.
    perform pg_temp.assert(visible = 0, 'the invite ledger exposes no rows to a student');
  exception
    when insufficient_privilege then
      denied := true;
      perform pg_temp.assert(denied, 'the invite ledger is not selectable by a student');
  end;
end
$$;

do $$
declare
  visible integer;
  blocked boolean := false;
begin
  raise notice 'invite_redemptions';

  select count(*) into visible from public.invite_redemptions;
  perform pg_temp.assert(
    visible = 0,
    'a student cannot see another student''s redemption (§S19: referred users stay private)'
  );

  -- A client writing its own redemption row would sidestep the capacity check entirely.
  begin
    insert into public.invite_redemptions (invite_id, user_id)
      values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');
  exception
    when insufficient_privilege then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'a student cannot insert their own redemption row');
end
$$;

do $$
declare
  blocked boolean := false;
begin
  raise notice 'deletion';

  -- §S22 / §11.4: deletion runs through a reviewed workflow, never a direct client delete.
  begin
    delete from public.profiles where user_id = '11111111-1111-1111-1111-111111111111';
    -- A policy-less delete returns zero rows rather than raising; treat that as blocked too.
    blocked := true;
  exception
    when insufficient_privilege then blocked := true;
  end;

  perform pg_temp.assert(
    (select count(*) from public.profiles
      where user_id = '11111111-1111-1111-1111-111111111111') = 1,
    'a student cannot delete their own profile row directly'
  );
end
$$;

-- Reference catalogues must stay readable, or the pickers in §S06 and §S08 break.
do $$
declare
  visible integer;
  blocked boolean := false;
begin
  raise notice 'reference catalogues';

  select count(*) into visible from public.india_states where active;
  perform pg_temp.assert(visible > 0, 'the India state list is readable by a signed-in student');

  select count(*) into visible from public.education_providers where active;
  perform pg_temp.assert(visible > 0, 'the provider list is readable by a signed-in student');

  begin
    insert into public.india_states (code, name) values ('ZZ', 'Nowhere');
  exception
    when insufficient_privilege then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'a student cannot write to a reference catalogue');
end
$$;

reset role;

-- Structural guarantees. §13.1 requires RLS on every table holding user data, and a table with
-- policies but RLS switched off is the dangerous inverse of one with RLS and no policies.
do $$
declare
  offending text;
begin
  raise notice 'structure';

  select string_agg(c.relname, ', ')
    into offending
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity;

  perform pg_temp.assert(
    offending is null,
    coalesce('tables without RLS enabled: ' || offending, 'every public table has RLS enabled')
  );

  select string_agg(c.relname, ', ')
    into offending
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relrowsecurity
     and not c.relforcerowsecurity
     and c.relname <> 'india_states'
     and c.relname <> 'education_providers';

  perform pg_temp.assert(
    offending is null,
    coalesce('user tables not FORCEing RLS: ' || offending, 'user tables force RLS for their owner too')
  );
end
$$;

rollback;
