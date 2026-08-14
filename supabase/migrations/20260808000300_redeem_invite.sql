-- Atomic invite redemption (spec §S04, §12.2, §12.4)
--
-- §S04: "Redemption must be atomic." and
--       "A code cannot be redeemed beyond its allowance under concurrent requests."
--
-- The logic lives in a SECURITY DEFINER function rather than in the Edge Function's
-- TypeScript, so that atomicity is a property of a single database statement instead of a
-- read-then-write race across the network. The Edge Function is a thin wrapper that hashes
-- the code and calls this (§12.1: privileged checks belong server-side).
--
-- Concurrency is handled by `for update` on the invite row: two simultaneous redemptions of
-- the last remaining seat serialise, and the second sees redeemed_count already incremented.
-- The `redeemed_within_capacity` check constraint is the backstop if this logic is ever wrong.

create type public.redeem_invite_outcome as enum (
  'redeemed',
  'already_redeemed',
  'invite_invalid',
  'invite_exhausted'
);

create or replace function public.redeem_invite(
  p_user_id uuid,
  p_code_hash text
)
returns public.redeem_invite_outcome
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites%rowtype;
  v_existing public.invite_redemptions%rowtype;
begin
  -- §12.4: redemption must tolerate retries. A repeated call with the same code returns
  -- 'already_redeemed' rather than consuming a second seat or raising.
  select * into v_existing
    from public.invite_redemptions
   where user_id = p_user_id;

  if found then
    if exists (
      select 1 from public.invites
       where id = v_existing.invite_id and code_hash = p_code_hash
    ) then
      return 'already_redeemed';
    end if;
    -- The user already used a different invitation. §11.1 allows one per user.
    return 'invite_invalid';
  end if;

  -- `for update` is what makes this atomic: concurrent callers queue here rather than both
  -- reading the same redeemed_count.
  select * into v_invite
    from public.invites
   where code_hash = p_code_hash
     for update;

  if not found then
    return 'invite_invalid';
  end if;

  if v_invite.status = 'revoked' then
    return 'invite_invalid';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    update public.invites set status = 'expired' where id = v_invite.id;
    return 'invite_invalid';
  end if;

  if v_invite.redeemed_count >= v_invite.capacity then
    update public.invites set status = 'exhausted' where id = v_invite.id;
    return 'invite_exhausted';
  end if;

  insert into public.invite_redemptions (invite_id, user_id)
    values (v_invite.id, p_user_id);

  update public.invites
     set redeemed_count = redeemed_count + 1,
         status = case
           when redeemed_count + 1 >= capacity then 'exhausted'::public.invite_status
           else status
         end
   where id = v_invite.id;

  return 'redeemed';
end;
$$;

comment on function public.redeem_invite is
  'Atomic invite redemption (spec §S04). Called only by the redeem-invite Edge Function.';

-- Clients must never call this directly — they would supply their own p_user_id and redeem
-- on someone else''s behalf. Only the service role, which Edge Functions use, may execute it.
revoke all on function public.redeem_invite(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_invite(uuid, text) to service_role;
