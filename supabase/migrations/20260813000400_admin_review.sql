-- Administrative review (spec §12.2, §13.1, §15.2, §11.2)
--
-- §11.2: "Status changes must be validated server-side and recorded in admin_audit_logs."
-- §13.1: "Admin actions authenticated, authorised and audited."
-- §15.2: "Sensitive actions require a reason."
--
-- The decision and its audit record are written in one statement. Doing them as two calls from
-- the Edge Function would allow a status change with no audit row whenever the second call
-- fails — and an audit trail with gaps is worse than none, because it is trusted.

/**
 * Whether a user holds administrative authority.
 *
 * SECURITY DEFINER so it can read admin_users, which no client role can reach (§15.2:
 * authorisation must not depend on hidden navigation). Callers get a boolean and never the
 * operator list itself.
 */
create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.admin_users
     where user_id = p_user_id and active
  );
$$;

comment on function public.is_admin is
  'Administrative authority check (spec §15.2). Returns a boolean only — the operator list is
   never exposed to any client.';

create type public.admin_review_outcome as enum (
  'approved',
  'rejected',
  'not_permitted',
  'no_pending_request',
  'invalid_request'
);

/**
 * Approve or reject a pending registration.
 *
 * `p_reason` is the operator's own words. It goes into admin_audit_logs and is never returned
 * to the student — §S17: "Avoid exposing internal moderation notes", §15.2: "Rejected users do
 * not see private moderator notes." What the student sees is `p_rejection_category`, a closed
 * enum, which is why the two are separate arguments rather than one free-text field.
 */
create or replace function public.admin_review_registration(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_approve boolean,
  p_reason text,
  p_rejection_category public.rejection_category default null
)
returns public.admin_review_outcome
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.verification_requests%rowtype;
begin
  -- §13.1: authorised, before anything else happens.
  if not public.is_admin(p_actor_id) then
    return 'not_permitted';
  end if;

  -- §15.2: "Sensitive actions require a reason." Checked here as well as by the audit table's
  -- constraint, so the refusal is a clean outcome rather than a raised exception the Edge
  -- Function has to interpret.
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    return 'invalid_request';
  end if;

  -- A rejection with no category would leave the student with nothing actionable on S17.
  if not p_approve and p_rejection_category is null then
    return 'invalid_request';
  end if;

  -- An operator reviewing their own registration is a conflict of interest, and the audit
  -- trail would show it as legitimate. Cheap to forbid, awkward to explain later.
  if p_actor_id = p_target_user_id then
    return 'not_permitted';
  end if;

  select * into v_request
    from public.verification_requests
   where user_id = p_target_user_id and state = 'pending'
     for update;

  if not found then
    return 'no_pending_request';
  end if;

  update public.verification_requests
     set state = case
           when p_approve then 'approved'::public.verification_state
           else 'rejected'::public.verification_state
         end,
         reviewed_at = now(),
         reviewer_id = p_actor_id,
         rejection_category = case when p_approve then null else p_rejection_category end
   where id = v_request.id;

  update public.profiles
     set status = case
           when p_approve then 'approved'::public.account_status
           else 'rejected'::public.account_status
         end
   where user_id = p_target_user_id;

  insert into public.admin_audit_logs (actor_id, action, target_user_id, reason, metadata)
    values (
      p_actor_id,
      case
        when p_approve then 'registration_approved'::public.admin_action
        else 'registration_rejected'::public.admin_action
      end,
      p_target_user_id,
      btrim(p_reason),
      jsonb_build_object(
        'verification_request_id', v_request.id,
        'rejection_category', p_rejection_category
      )
    );

  return case
    when p_approve then 'approved'::public.admin_review_outcome
    else 'rejected'::public.admin_review_outcome
  end;
end;
$$;

comment on function public.admin_review_registration is
  'Approve or reject a registration, with the audit record written in the same statement
   (spec §11.2, §13.1). p_reason is internal; p_rejection_category is what the student sees.';

/**
 * §13.3: "Administrators need controls to hide an avatar, edit/reject unsafe content, suspend
 * an account and record a reason." Suspension is the one with teeth, so it gets the same
 * decision-plus-audit treatment.
 */
create or replace function public.admin_set_suspension(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_suspend boolean,
  p_reason text
)
returns public.admin_review_outcome
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.account_status;
begin
  if not public.is_admin(p_actor_id) then
    return 'not_permitted';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    return 'invalid_request';
  end if;

  if p_actor_id = p_target_user_id then
    return 'not_permitted';
  end if;

  select status into v_status
    from public.profiles where user_id = p_target_user_id for update;

  if not found then
    return 'invalid_request';
  end if;

  -- Suspension must not resurrect an account that is on its way out (§11.4).
  if v_status in ('deletion_pending', 'deleted') then
    return 'not_permitted';
  end if;

  -- Reinstating returns the account to review rather than straight to approved: the reason it
  -- was suspended may well bear on whether it should be in the beta at all.
  update public.profiles
     set status = case
       when p_suspend then 'suspended'::public.account_status
       else 'pending_review'::public.account_status
     end
   where user_id = p_target_user_id;

  insert into public.admin_audit_logs (actor_id, action, target_user_id, reason)
    values (
      p_actor_id,
      case
        when p_suspend then 'user_suspended'::public.admin_action
        else 'user_reinstated'::public.admin_action
      end,
      p_target_user_id,
      btrim(p_reason)
    );

  return case
    when p_suspend then 'rejected'::public.admin_review_outcome
    else 'approved'::public.admin_review_outcome
  end;
end;
$$;

comment on function public.admin_set_suspension is
  'Suspend or reinstate an account with a mandatory reason (spec §13.3, §15.2). Reinstating
   returns the account to pending_review, not straight to approved.';

/**
 * §13.3: "controls to hide an avatar" and clear an unsafe display name. Profile names and
 * photographs are user-generated content even before a feed exists.
 */
create or replace function public.admin_moderate_profile(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_hide_avatar boolean,
  p_clear_display_name boolean,
  p_reason text
)
returns public.admin_review_outcome
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(p_actor_id) then
    return 'not_permitted';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    return 'invalid_request';
  end if;

  if not p_hide_avatar and not p_clear_display_name then
    return 'invalid_request';
  end if;

  if not exists (select 1 from public.profiles where user_id = p_target_user_id) then
    return 'invalid_request';
  end if;

  if p_hide_avatar then
    update public.profiles set avatar_path = null where user_id = p_target_user_id;
    insert into public.admin_audit_logs (actor_id, action, target_user_id, reason)
      values (p_actor_id, 'avatar_hidden'::public.admin_action, p_target_user_id, btrim(p_reason));
  end if;

  if p_clear_display_name then
    update public.profiles set display_name = null where user_id = p_target_user_id;
    insert into public.admin_audit_logs (actor_id, action, target_user_id, reason)
      values (p_actor_id, 'display_name_cleared'::public.admin_action, p_target_user_id, btrim(p_reason));
  end if;

  return 'approved';
end;
$$;

comment on function public.admin_moderate_profile is
  'Hide an avatar or clear a display name with a mandatory reason (spec §13.3).';

-- None of these may be called with a user's own session: the actor id is an argument, so a
-- client could name someone else as the actor and forge an audit trail. Service role only.
revoke all on function public.is_admin(uuid) from public, anon, authenticated;
revoke all on function public.admin_review_registration(uuid, uuid, boolean, text, public.rejection_category)
  from public, anon, authenticated;
revoke all on function public.admin_set_suspension(uuid, uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.admin_moderate_profile(uuid, uuid, boolean, boolean, text)
  from public, anon, authenticated;

grant execute on function public.is_admin(uuid) to service_role;
grant execute on function public.admin_review_registration(uuid, uuid, boolean, text, public.rejection_category)
  to service_role;
grant execute on function public.admin_set_suspension(uuid, uuid, boolean, text) to service_role;
grant execute on function public.admin_moderate_profile(uuid, uuid, boolean, boolean, text)
  to service_role;
