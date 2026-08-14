-- Return the new outcome. Separate from the `alter type` in 20260813000700 on purpose: a
-- value added to an enum cannot be used by statements in the same transaction, and Supabase
-- applies each migration file as one.

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
  -- §13.1: authorised, before anything else happens. Everything below this line is therefore
  -- talking to a confirmed operator, which is what makes the self-review outcome safe to name.
  if not public.is_admin(p_actor_id) then
    return 'not_permitted';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    return 'invalid_request';
  end if;

  if not p_approve and p_rejection_category is null then
    return 'invalid_request';
  end if;

  -- An operator reviewing their own registration is a conflict of interest, and the audit
  -- trail would record it as an ordinary decision. Still forbidden — but said out loud, so
  -- the operator knows to hand it to a colleague rather than doubting their own access.
  if p_actor_id = p_target_user_id then
    return 'own_registration';
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
   (spec §11.2, §13.1). p_reason is internal; p_rejection_category is what the student sees.
   Refuses a self-review with `own_registration`, distinct from `not_permitted`.';
