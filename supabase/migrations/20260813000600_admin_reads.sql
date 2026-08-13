-- Administrative reads (spec §15.1)
--
-- The console needs to see data no client role can reach: other people's registrations, the
-- verification queue, and the audit log. Every one of these functions therefore does the same
-- three things in the same order — check `is_admin`, read, return — and none of them is
-- callable by a client role.
--
-- Why these are SQL functions rather than PostgREST queries with an "admins can read
-- everything" policy: such a policy would have to live on `profiles` and `student_profiles`,
-- widening the tables a *student's* session can read and making the isolation tests in
-- supabase/tests depend on the caller's role rather than on the policy. §20's guarantee is
-- easier to keep true when there is exactly one shape of client access — your own rows — and
-- everything else goes through a function that authorises explicitly.
--
-- §15.2: "Never rely only on hidden navigation for authorisation." A console that forgot to
-- render a button would still be unable to read anything here.

/**
 * The review queue (§15.1 "Registration queue").
 *
 * Deliberately thin: enough to triage, not the whole profile. An operator scanning a list has
 * no need for anyone's hometown, and §13.2's data minimisation applies to what we put on a
 * screen as much as to what we store.
 */
create or replace function public.admin_registration_queue(
  p_actor_id uuid,
  p_state public.verification_state default 'pending',
  p_search text default null,
  p_limit integer default 50
)
returns table (
  user_id uuid,
  display_name text,
  status public.account_status,
  submitted_at timestamptz,
  state public.verification_state,
  provider text,
  suburb text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(p_actor_id) then
    return;
  end if;

  return query
    select
      v.user_id,
      p.display_name,
      p.status,
      v.submitted_at,
      v.state,
      coalesce(e.name, s.provider_other) as provider,
      s.suburb
    from public.verification_requests v
    join public.profiles p on p.user_id = v.user_id
    left join public.student_profiles s on s.user_id = v.user_id
    left join public.education_providers e on e.code = s.provider
   where v.state = p_state
     and (
       p_search is null
       or p_search = ''
       or p.display_name ilike '%' || p_search || '%'
       or s.suburb ilike '%' || p_search || '%'
     )
   order by v.submitted_at asc
   limit least(greatest(p_limit, 1), 200);
end;
$$;

comment on function public.admin_registration_queue is
  'Review queue for the admin console (§15.1). Returns nothing at all to a non-admin.';

/**
 * One registration in full (§15.1 "Registration detail").
 *
 * Returned as a single jsonb document rather than a wide row, because the interesting parts —
 * languages, communities, interests, goals — are one-to-many and would otherwise need four
 * more round trips or a row-multiplying join the console has to unpick.
 *
 * The email comes from `auth.users`, which is why this has to be SECURITY DEFINER: an
 * operator needs it to recognise a duplicate account, and no client role can read that schema.
 */
create or replace function public.admin_registration_detail(
  p_actor_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin(p_actor_id) then
    return null;
  end if;

  select jsonb_build_object(
    'userId', p.user_id,
    'displayName', p.display_name,
    'email', u.email,
    'status', p.status,
    'createdAt', p.created_at,
    'study', jsonb_build_object(
      'provider', coalesce(e.name, s.provider_other),
      'campus', s.campus,
      'course', s.course,
      'level', s.study_level,
      'intake', s.intake_month || '/' || s.intake_year,
      'completion', s.completion_month || '/' || s.completion_year,
      'studentEmail', s.student_email
    ),
    'location', jsonb_build_object(
      'suburb', s.suburb,
      'postcode', s.postcode,
      'arrival', s.arrival_status
    ),
    'india', jsonb_build_object(
      'state', i.name,
      'hometown', s.hometown
    ),
    'languages', coalesce((
      select jsonb_agg(jsonb_build_object('label', l.name, 'proficiency', pl.proficiency)
                       order by pl.proficiency)
        from public.profile_languages pl
        join public.languages l on l.code = pl.language_code
       where pl.user_id = p.user_id
    ), '[]'::jsonb),
    'communities', case
      when s.communities_not_specified then '["Prefer not to specify"]'::jsonb
      else coalesce((
        select jsonb_agg(c.label order by c.sort_order)
          from public.profile_communities pc
          join public.communities c on c.code = pc.community_code
         where pc.user_id = p.user_id
      ), '[]'::jsonb)
    end,
    'interests', coalesce((
      select jsonb_agg(t.label order by t.sort_order)
        from public.profile_interests pi
        join public.interests t on t.code = pi.interest_code
       where pi.user_id = p.user_id
    ), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(g.label order by pg.rank)
        from public.profile_goals pg
        join public.goals g on g.code = pg.goal_code
       where pg.user_id = p.user_id
    ), '[]'::jsonb),
    'consents', coalesce((
      select jsonb_agg(jsonb_build_object(
               'policy', co.policy_type, 'version', co.version,
               'accepted', co.accepted, 'at', co.accepted_at)
             order by co.accepted_at)
        from public.consents co
       where co.user_id = p.user_id
    ), '[]'::jsonb),
    'review', (
      select jsonb_build_object(
               'state', v.state, 'submittedAt', v.submitted_at,
               'reviewedAt', v.reviewed_at, 'rejectionCategory', v.rejection_category)
        from public.verification_requests v
       where v.user_id = p.user_id
       order by v.submitted_at desc
       limit 1
    ),
    /**
     * §S19: "Do not reveal referred users until they independently consent." An operator sees
     * only that an invitation was redeemed and which campaign it belonged to — never who
     * issued it. Whether an operator should be able to see that at all is a policy question,
     * and the safe default until it is answered is no.
     */
    'invite', (
      select jsonb_build_object('campaign', inv.campaign, 'redeemedAt', ir.redeemed_at)
        from public.invite_redemptions ir
        join public.invites inv on inv.id = ir.invite_id
       where ir.user_id = p.user_id
    )
  )
    into v_result
    from public.profiles p
    join auth.users u on u.id = p.user_id
    left join public.student_profiles s on s.user_id = p.user_id
    left join public.education_providers e on e.code = s.provider
    left join public.india_states i on i.code = s.india_state_code
   where p.user_id = p_user_id;

  return v_result;
end;
$$;

comment on function public.admin_registration_detail is
  'One registration in full for the admin console (§15.1). Never names the inviter (§S19).';

/**
 * User search across every status (§15.1 "User search and status").
 *
 * Separate from the queue because they answer different questions: the queue is "what is
 * waiting for me", this is "what happened to this person". Conflating them produces a filter
 * UI that is wrong for both.
 */
create or replace function public.admin_user_search(
  p_actor_id uuid,
  p_search text,
  p_limit integer default 25
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  status public.account_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(p_actor_id) then
    return;
  end if;

  -- An empty search returning every user is how an accidental full export happens (§15.2:
  -- "Exports are restricted"). A search term is required.
  if p_search is null or char_length(btrim(p_search)) < 2 then
    return;
  end if;

  return query
    select p.user_id, p.display_name, u.email::text, p.status, p.created_at
      from public.profiles p
      join auth.users u on u.id = p.user_id
     where p.display_name ilike '%' || btrim(p_search) || '%'
        or u.email ilike '%' || btrim(p_search) || '%'
     order by p.created_at desc
     limit least(greatest(p_limit, 1), 100);
end;
$$;

comment on function public.admin_user_search is
  'User search for the admin console (§15.1). Requires a search term — an empty query returns
   nothing rather than everybody, so a full export cannot happen by accident (§15.2).';

/**
 * The audit log (§15.1 "Audit log").
 *
 * Visible to operators, which is the point: an audit trail nobody can read deters nothing.
 * It stays append-only regardless — the triggers in 20260813000200_m2_rls.sql refuse an
 * update or delete even from the service role.
 */
create or replace function public.admin_audit_log(
  p_actor_id uuid,
  p_target_user_id uuid default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  actor_email text,
  action public.admin_action,
  target_user_id uuid,
  target_name text,
  reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(p_actor_id) then
    return;
  end if;

  return query
    select
      a.id,
      actor.email::text,
      a.action,
      a.target_user_id,
      target.display_name,
      a.reason,
      a.created_at
    from public.admin_audit_logs a
    join auth.users actor on actor.id = a.actor_id
    left join public.profiles target on target.user_id = a.target_user_id
   where p_target_user_id is null or a.target_user_id = p_target_user_id
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500);
end;
$$;

comment on function public.admin_audit_log is
  'Administrative history for the console (§15.1). Readable by operators; still append-only.';

/** Whether the signed-in user may open the console at all. */
create or replace function public.admin_whoami(p_actor_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'isAdmin', public.is_admin(p_actor_id),
    'role', (select role from public.admin_users where user_id = p_actor_id and active)
  );
$$;

-- Service role only. Every one of these takes the actor as an argument, so a client able to
-- call them directly could name an administrator and read the whole database.
revoke all on function public.admin_registration_queue(uuid, public.verification_state, text, integer)
  from public, anon, authenticated;
revoke all on function public.admin_registration_detail(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_user_search(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.admin_audit_log(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_whoami(uuid) from public, anon, authenticated;

grant execute on function public.admin_registration_queue(uuid, public.verification_state, text, integer)
  to service_role;
grant execute on function public.admin_registration_detail(uuid, uuid) to service_role;
grant execute on function public.admin_user_search(uuid, text, integer) to service_role;
grant execute on function public.admin_audit_log(uuid, uuid, integer) to service_role;
grant execute on function public.admin_whoami(uuid) to service_role;
