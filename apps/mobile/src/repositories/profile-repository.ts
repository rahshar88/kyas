import {
  CURRENT_POLICY_VERSION,
  isMissingStep,
  type CommunitySelection,
  type ConsentChoice,
  type LanguageChoice,
  type MissingStep,
  type RejectionCategory,
  type VisibilityPreferences,
} from '@kyascene/domain';

import { getSupabase } from '@/services/supabase';

import { guard, toAppError } from './errors';

/**
 * The signed-in student's own profile detail — S09 through S17.
 *
 * Everything here is safe under Row Level Security, so it goes direct from the client (§12.1).
 * The one exception is `submit`, which changes account status: that is a privileged
 * transition, so it goes through the submit-registration Edge Function and this module only
 * translates the outcome.
 *
 * The selection tables are written **replace-then-insert inside one call** rather than
 * diffed. A diff is more code, more round trips, and gets the ordering wrong on a flaky
 * connection; the set is at most a dozen rows and the screen already holds the whole
 * intended state.
 */
export interface CatalogueEntry {
  code: string;
  label: string;
  category?: string;
}

export interface ReviewState {
  state: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  submittedAt: string;
  reviewedAt: string | null;
  rejectionCategory: RejectionCategory | null;
}

export type SubmitOutcome =
  | { outcome: 'submitted' }
  | { outcome: 'already_submitted' }
  | { outcome: 'incomplete'; missing: MissingStep[] }
  | { outcome: 'not_permitted' };

export interface ProfileRepository {
  listLanguages(): Promise<CatalogueEntry[]>;
  listCommunities(): Promise<CatalogueEntry[]>;
  listInterests(): Promise<CatalogueEntry[]>;
  listGoals(): Promise<CatalogueEntry[]>;
  saveDisplayName(userId: string, displayName: string): Promise<void>;
  listChosenGoals(userId: string): Promise<string[]>;
  saveLanguages(userId: string, choices: LanguageChoice[]): Promise<void>;
  saveCommunities(userId: string, selection: CommunitySelection): Promise<void>;
  saveInterests(userId: string, codes: string[]): Promise<void>;
  saveGoals(userId: string, codes: string[]): Promise<void>;
  saveVisibility(userId: string, preferences: VisibilityPreferences): Promise<void>;
  saveConsents(userId: string, choices: ConsentChoice[]): Promise<void>;
  getReviewState(userId: string): Promise<ReviewState | null>;
  submit(): Promise<SubmitOutcome>;
}

/** Catalogues are ordered by the server; the client never re-sorts and never filters. */
async function readCatalogue(
  table: 'communities' | 'interests' | 'goals',
): Promise<CatalogueEntry[]> {
  return guard(async () => {
    const { data, error } = await getSupabase()
      .from(table)
      .select('code, label, active, sort_order')
      .eq('active', true)
      .order('sort_order');

    if (error) throw error;
    return (data ?? []).map((row) => ({ code: row.code, label: row.label }));
  });
}

export const profileRepository: ProfileRepository = {
  async listLanguages(): Promise<CatalogueEntry[]> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('languages')
        .select('code, name, active, sort_order')
        .eq('active', true)
        .order('sort_order');

      if (error) throw error;
      return (data ?? []).map((row) => ({ code: row.code, label: row.name }));
    });
  },

  async listCommunities(): Promise<CatalogueEntry[]> {
    return readCatalogue('communities');
  },

  async listInterests(): Promise<CatalogueEntry[]> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('interests')
        .select('code, label, category, active, sort_order')
        .eq('active', true)
        .order('sort_order');

      if (error) throw error;
      return (data ?? []).map((row) => ({
        code: row.code,
        label: row.label,
        category: row.category,
      }));
    });
  },

  async listGoals(): Promise<CatalogueEntry[]> {
    return readCatalogue('goals');
  },

  /**
   * §S13. The one profile column a student may write about how they appear to others.
   *
   * `status` sits on the same row and is server-controlled, so this is an `update` of a
   * single named column rather than an upsert — the privileged-column guard would refuse
   * anything wider, and being refused by a trigger is a worse way to learn that than not
   * writing it in the first place.
   */
  /**
   * §S18 shows "top selected goals" back to the person who chose them.
   *
   * Ordered by rank, which is the order they put them in on S12 — the index *is* the rank, so
   * reordering the query would silently misreport what someone said they needed most.
   */
  async listChosenGoals(userId: string): Promise<string[]> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('profile_goals')
        .select('goal_code, rank')
        .eq('user_id', userId)
        .order('rank', { ascending: true });
      if (error) throw error;

      return (data ?? []).map((row) => row.goal_code);
    });
  },

  async saveDisplayName(userId: string, displayName: string): Promise<void> {
    await guard(async () => {
      const { error } = await getSupabase()
        .from('profiles')
        .update({ display_name: displayName })
        .eq('user_id', userId);
      if (error) throw error;
    });
  },

  async saveLanguages(userId: string, choices: LanguageChoice[]): Promise<void> {
    await guard(async () => {
      const supabase = getSupabase();

      const { error: clearError } = await supabase
        .from('profile_languages')
        .delete()
        .eq('user_id', userId);
      if (clearError) throw clearError;

      if (choices.length === 0) return;

      const { error } = await supabase.from('profile_languages').insert(
        choices.map((choice) => ({
          user_id: userId,
          language_code: choice.code,
          proficiency: choice.proficiency,
        })),
      );
      if (error) throw error;
    });
  },

  /**
   * §S10: "Prefer not to specify clears other selections."
   *
   * The flag is written **after** the rows, not before. The database trigger clears
   * `profile_communities` when the flag is set, so setting the flag last means the clearing
   * happens once, at the end, and cannot be undone by an insert arriving afterwards.
   */
  async saveCommunities(userId: string, selection: CommunitySelection): Promise<void> {
    await guard(async () => {
      const supabase = getSupabase();

      const { error: clearError } = await supabase
        .from('profile_communities')
        .delete()
        .eq('user_id', userId);
      if (clearError) throw clearError;

      if (!selection.notSpecified && selection.codes.length > 0) {
        const { error } = await supabase
          .from('profile_communities')
          .insert(selection.codes.map((code) => ({ user_id: userId, community_code: code })));
        if (error) throw error;
      }

      const { error: flagError } = await supabase
        .from('student_profiles')
        .update({ communities_not_specified: selection.notSpecified })
        .eq('user_id', userId);
      if (flagError) throw flagError;
    });
  },

  async saveInterests(userId: string, codes: string[]): Promise<void> {
    await guard(async () => {
      const supabase = getSupabase();

      const { error: clearError } = await supabase
        .from('profile_interests')
        .delete()
        .eq('user_id', userId);
      if (clearError) throw clearError;

      if (codes.length === 0) return;

      const { error } = await supabase
        .from('profile_interests')
        .insert(codes.map((code) => ({ user_id: userId, interest_code: code })));
      if (error) throw error;
    });
  },

  /**
   * §S12: "Select up to five and rank the top need."
   *
   * The array index is the rank, so what the student sees on screen and what the database
   * stores cannot drift. Rows are cleared first because the unique rank constraint is
   * immediate — writing a new rank 1 over an existing one would collide.
   */
  async saveGoals(userId: string, codes: string[]): Promise<void> {
    await guard(async () => {
      const supabase = getSupabase();

      const { error: clearError } = await supabase
        .from('profile_goals')
        .delete()
        .eq('user_id', userId);
      if (clearError) throw clearError;

      if (codes.length === 0) return;

      const { error } = await supabase
        .from('profile_goals')
        .insert(
          codes.map((code, index) => ({ user_id: userId, goal_code: code, rank: index + 1 })),
        );
      if (error) throw error;
    });
  },

  async saveVisibility(userId: string, preferences: VisibilityPreferences): Promise<void> {
    await guard(async () => {
      const { error } = await getSupabase().from('profile_visibility').upsert(
        {
          user_id: userId,
          show_suburb: preferences.showSuburb,
          show_india_state: preferences.showIndiaState,
          show_hometown: preferences.showHometown,
          show_languages: preferences.showLanguages,
          show_communities: preferences.showCommunities,
          show_study: preferences.showStudy,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
    });
  },

  /**
   * §S15 evidence, written once per policy version.
   *
   * `consents` has no update policy — an acceptance cannot be rewritten — so a re-submission
   * at the same version would violate the unique constraint. `ignoreDuplicates` makes the
   * write idempotent (§12.4) without needing permission the table deliberately withholds.
   */
  async saveConsents(userId: string, choices: ConsentChoice[]): Promise<void> {
    await guard(async () => {
      if (choices.length === 0) return;

      const { error } = await getSupabase()
        .from('consents')
        .upsert(
          choices.map((choice) => ({
            user_id: userId,
            policy_type: choice.policyType,
            version: choice.version,
            accepted: choice.accepted,
          })),
          { onConflict: 'user_id,policy_type,version', ignoreDuplicates: true },
        );
      if (error) throw error;
    });
  },

  async getReviewState(userId: string): Promise<ReviewState | null> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('verification_requests')
        .select('state, submitted_at, reviewed_at, rejection_category')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        state: data.state,
        submittedAt: data.submitted_at,
        reviewedAt: data.reviewed_at,
        rejectionCategory: data.rejection_category,
      };
    });
  },

  /**
   * §S16 submission. Privileged, so it goes through the Edge Function (§12.1) — a client
   * cannot move its own status to `pending_review`.
   *
   * The `incomplete` case is not an error to show and forget: it carries the list of steps
   * the server found missing, which the screen turns into navigation. That is why this
   * returns a discriminated union rather than throwing.
   */
  async submit(): Promise<SubmitOutcome> {
    try {
      const { data, error } = await getSupabase().functions.invoke('submit-registration', {
        body: { policyVersion: CURRENT_POLICY_VERSION },
      });

      if (error) {
        /**
         * `functions.invoke` reports any non-2xx as an error, so the useful part — our §12.3
         * envelope — is inside `error.context`, not in `data`. Without reading it, a
         * perfectly actionable "you still need three interests" would surface as UNKNOWN.
         */
        const body = await readEnvelope(error);

        if (body?.error?.code === 'REGISTRATION_ALREADY_SUBMITTED') {
          return { outcome: 'already_submitted' };
        }
        if (body?.error?.code === 'ACCOUNT_SUSPENDED') {
          return { outcome: 'not_permitted' };
        }
        if (Array.isArray(body?.error?.missing)) {
          return { outcome: 'incomplete', missing: body.error.missing.filter(isMissingStep) };
        }
        throw error;
      }

      if (data?.error) throw new Error(data.error.code);
      return { outcome: 'submitted' };
    } catch (error) {
      throw toAppError(error, 'UNKNOWN');
    }
  },
};

interface Envelope {
  error?: { code?: string; message?: string; missing?: unknown };
}

/** Pulls the §12.3 envelope out of a FunctionsHttpError without assuming its shape. */
async function readEnvelope(error: unknown): Promise<Envelope | null> {
  const context = (error as { context?: unknown }).context;
  if (context === null || typeof context !== 'object') return null;

  const response = context as { json?: () => Promise<unknown> };
  if (typeof response.json !== 'function') return null;

  try {
    return (await response.json()) as Envelope;
  } catch {
    return null;
  }
}
