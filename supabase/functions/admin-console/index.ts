/**
 * admin-console (spec §15.1)
 *
 * The console's read surface: who am I, the queue, one registration, user search, audit log.
 *
 * **Why one function with an `action` rather than five functions.** Every route here shares
 * the same preamble — verify the JWT, and hand the caller's id to a SECURITY DEFINER function
 * that decides whether they are an operator. Splitting that across five deployments means five
 * chances for one of them to drift, and the drifted one is a hole. §15.2 puts authorisation in
 * exactly one place; this keeps the code shaped the same way.
 *
 * Writes deliberately do NOT live here. `admin-review-registration` stays its own function
 * because a decision that changes someone's status is worth being able to read, deploy and
 * reason about on its own.
 *
 * Nothing in this file decides who is an administrator. It passes the verified user id to the
 * database and the database decides — so a bug here fails closed, returning empty results
 * rather than someone else's data.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { failure, requestId, success } from '../_shared/response.ts';

type Action = 'whoami' | 'queue' | 'detail' | 'search' | 'audit';

const ACTIONS: readonly Action[] = ['whoami', 'queue', 'detail', 'search', 'audit'];

function isAction(value: unknown): value is Action {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);
}

const QUEUE_STATES = ['pending', 'approved', 'rejected', 'withdrawn'] as const;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

Deno.serve(async (request: Request): Promise<Response> => {
  const id = requestId();

  if (request.method !== 'POST') {
    return failure('VALIDATION_FAILED', 'This request could not be understood.', { id });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return failure('SESSION_EXPIRED', 'Sign in again.', { id });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const asService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: userResult, error: userError } = await asCaller.auth.getUser();
  if (userError || !userResult.user) {
    return failure('SESSION_EXPIRED', 'Sign in again.', { id });
  }

  const actorId = userResult.user.id;

  let body: { action?: unknown; userId?: unknown; search?: unknown; state?: unknown };
  try {
    body = await request.json();
  } catch {
    return failure('VALIDATION_FAILED', 'This request could not be understood.', { id });
  }

  if (!isAction(body.action)) {
    return failure('VALIDATION_FAILED', 'Unknown action.', { id });
  }

  try {
    switch (body.action) {
      case 'whoami': {
        const { data, error } = await asService.rpc('admin_whoami', { p_actor_id: actorId });
        if (error) throw error;
        return success(data, id);
      }

      case 'queue': {
        const state =
          typeof body.state === 'string' && (QUEUE_STATES as readonly string[]).includes(body.state)
            ? body.state
            : 'pending';

        const { data, error } = await asService.rpc('admin_registration_queue', {
          p_actor_id: actorId,
          p_state: state,
          p_search: typeof body.search === 'string' ? body.search : null,
        });
        if (error) throw error;
        return success(data ?? [], id);
      }

      case 'detail': {
        if (!isUuid(body.userId)) {
          return failure('VALIDATION_FAILED', 'That user could not be identified.', { id });
        }

        const { data, error } = await asService.rpc('admin_registration_detail', {
          p_actor_id: actorId,
          p_user_id: body.userId,
        });
        if (error) throw error;

        // Null means either "not an operator" or "no such user". The console cannot tell the
        // difference, which is correct — distinguishing them would confirm an account exists
        // to someone with no right to know.
        if (data === null) {
          return failure('SESSION_EXPIRED', 'You do not have permission to do that.', { id });
        }
        return success(data, id);
      }

      case 'search': {
        const { data, error } = await asService.rpc('admin_user_search', {
          p_actor_id: actorId,
          p_search: typeof body.search === 'string' ? body.search : '',
        });
        if (error) throw error;
        return success(data ?? [], id);
      }

      case 'audit': {
        const { data, error } = await asService.rpc('admin_audit_log', {
          p_actor_id: actorId,
          p_target_user_id: isUuid(body.userId) ? body.userId : null,
        });
        if (error) throw error;
        return success(data ?? [], id);
      }
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        requestId: id,
        fn: 'admin-console',
        action: body.action,
        pgCode: (error as { code?: string }).code,
      }),
    );
    return failure('UNKNOWN', 'Something went wrong. Please try again.', { id });
  }
});
