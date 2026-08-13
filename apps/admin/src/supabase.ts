import { createClient } from '@supabase/supabase-js';

/**
 * The console's only connection to Supabase.
 *
 * The publishable key is the same one the mobile app ships, and it grants nothing on its own:
 * Row Level Security decides what a session can read, and this console reads almost nothing
 * directly. Everything an operator sees comes back from an Edge Function that checked
 * `admin_users` first.
 *
 * §5.3 forbids privileged values in a client bundle, and Vite inlines anything prefixed
 * `VITE_` into the built JavaScript — so the prefix is the boundary, and only publishable
 * values may cross it.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.\n' +
      'Copy apps/admin/.env.example to apps/admin/.env and fill it in.',
  );
}

export const supabase = createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export interface QueueRow {
  user_id: string;
  display_name: string | null;
  status: string;
  submitted_at: string;
  state: string;
  provider: string | null;
  suburb: string | null;
}

export interface AuditRow {
  id: string;
  actor_email: string;
  action: string;
  target_user_id: string | null;
  target_name: string | null;
  reason: string;
  created_at: string;
}

export interface SearchRow {
  user_id: string;
  display_name: string | null;
  email: string;
  status: string;
  created_at: string;
}

/**
 * Calls the console's read endpoint.
 *
 * `functions.invoke` reports a non-2xx as an error with the body tucked inside `error.context`,
 * so a message we deliberately wrote — "you do not have permission" — would otherwise surface
 * as a generic failure. Unwrapping it here means every caller gets the real reason.
 */
export async function adminCall<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-console', { body });

  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (context?.json) {
      try {
        const envelope = (await context.json()) as { error?: { message?: string } };
        throw new Error(envelope.error?.message ?? 'Request failed.');
      } catch (parsed) {
        if (parsed instanceof Error && parsed.message !== 'Request failed.') throw parsed;
      }
    }
    throw new Error('Request failed.');
  }

  return (data as { data: T }).data;
}

export async function reviewRegistration(input: {
  userId: string;
  approve: boolean;
  reason: string;
  category?: string;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-review-registration', { body: input });

  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (context?.json) {
      const envelope = (await context.json()) as { error?: { message?: string } };
      throw new Error(envelope.error?.message ?? 'That decision could not be recorded.');
    }
    throw new Error('That decision could not be recorded.');
  }
}
