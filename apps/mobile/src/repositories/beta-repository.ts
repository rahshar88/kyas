import { DEFAULT_FEATURE_FLAGS, type FeatureFlagKey, type FeatureFlags } from '@kyascene/domain';

import { getSupabase } from '@/services/supabase';

import { guard, toAppError } from './errors';

/**
 * Everything behind approval — S18 through S22.
 *
 * The same split as `profile-repository`: anything Row Level Security can protect goes direct
 * from the client (§12.1), and the two operations that change what a client is not allowed to
 * change go through Edge Functions. Those two are minting a referral invitation, which writes
 * to the invite ledger, and requesting deletion, which moves account status.
 */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

export interface ReferralSummary {
  code: string;
  capacity: number;
  redeemedCount: number;
  /** Never negative, even if capacity is lowered after codes are handed out. */
  remaining: number;
}

export interface FeedbackReceipt {
  reference: string;
}

export const FEEDBACK_CATEGORIES = [
  'bug',
  'confusing',
  'missing_feature',
  'safety_concern',
  'general',
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export interface FeedbackDraft {
  category: FeedbackCategory;
  comment: string;
  rating?: number | undefined;
  screenshotPath?: string | undefined;
}

export interface BetaRepository {
  loadFlags(): Promise<FeatureFlags>;
  listAnnouncements(): Promise<Announcement[]>;
  listVotes(userId: string): Promise<string[]>;
  toggleVote(userId: string, featureKey: string, voted: boolean): Promise<void>;
  ensureReferral(): Promise<void>;
  loadReferral(userId: string): Promise<ReferralSummary | null>;
  submitFeedback(userId: string, draft: FeedbackDraft): Promise<FeedbackReceipt>;
  registerPushToken(userId: string, token: string, platform: 'ios' | 'android'): Promise<void>;
  requestDeletion(reason: string | undefined): Promise<void>;
}

export const betaRepository: BetaRepository = {
  /**
   * §6.5's flags, merged over the all-false defaults rather than replacing them.
   *
   * A key the server has never heard of stays false, which is what makes shipping a screen
   * before its flag exists safe. The provider that calls this also falls back to the same
   * defaults on failure, so there are two independent reasons an unbuilt feature cannot
   * appear — a fetch that fails, and a fetch that succeeds but omits the key.
   */
  async loadFlags(): Promise<FeatureFlags> {
    return guard(async () => {
      const { data, error } = await getSupabase().from('feature_flags').select('key, enabled');
      if (error) throw error;

      const flags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
      for (const row of data ?? []) {
        if (Object.hasOwn(flags, row.key)) {
          flags[row.key as FeatureFlagKey] = row.enabled;
        }
      }

      return flags;
    });
  },

  /** §S18 "beta announcements". Only the live ones are readable at all — see the RLS policy. */
  async listAnnouncements(): Promise<Announcement[]> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('announcements')
        .select('id, title, body, published_at')
        .order('published_at', { ascending: false })
        .limit(10);
      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        publishedAt: row.published_at,
      }));
    });
  },

  async listVotes(userId: string): Promise<string[]> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('feature_votes')
        .select('feature_key')
        .eq('user_id', userId);
      if (error) throw error;

      return (data ?? []).map((row) => row.feature_key);
    });
  },

  /**
   * `voted` is the state being moved *to*, not the current one.
   *
   * A caller that passed the current value would have to read it first, and two taps in quick
   * succession would then race to the same conclusion. The primary key makes a duplicate
   * insert an error rather than a second vote, so the worst case is a refused tap.
   */
  async toggleVote(userId: string, featureKey: string, voted: boolean): Promise<void> {
    await guard(async () => {
      const supabase = getSupabase();

      if (voted) {
        const { error } = await supabase
          .from('feature_votes')
          .upsert(
            { user_id: userId, feature_key: featureKey },
            { onConflict: 'user_id,feature_key', ignoreDuplicates: true },
          );
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('feature_votes')
        .delete()
        .eq('user_id', userId)
        .eq('feature_key', featureKey);
      if (error) throw error;
    });
  },

  /** §S19. Privileged — it writes to the invite ledger — so it goes through the function. */
  async ensureReferral(): Promise<void> {
    await guard(async () => {
      const { error } = await getSupabase().functions.invoke('ensure-referral-code', { body: {} });
      if (error) throw error;
    }, 'VALIDATION_FAILED');
  },

  /**
   * The code itself is read here, not returned by the function that minted it — one path to a
   * referral code, one policy deciding who may see it.
   *
   * Returns null rather than throwing when there is no code yet. An account that has just been
   * approved and has not opened S19 is in a perfectly ordinary state, and a screen that has to
   * catch an exception to render its first-visit case will eventually forget to.
   */
  async loadReferral(userId: string): Promise<ReferralSummary | null> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('invites')
        .select('code_plain, capacity, redeemed_count')
        .eq('owner_user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.code_plain) return null;

      return {
        code: data.code_plain,
        capacity: data.capacity,
        redeemedCount: data.redeemed_count,
        remaining: Math.max(0, data.capacity - data.redeemed_count),
      };
    });
  },

  /**
   * §S20 acceptance: "Submission works without an email client and returns a reference
   * number." The reference is assigned by a database trigger and selected straight back, so
   * the value shown to the person is the value stored — not one the client made up and hoped
   * matched.
   */
  async submitFeedback(userId: string, draft: FeedbackDraft): Promise<FeedbackReceipt> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('feedback')
        .insert({
          user_id: userId,
          category: draft.category,
          comment: draft.comment.trim(),
          rating: draft.rating ?? null,
          screenshot_path: draft.screenshotPath ?? null,
        })
        .select('reference')
        .single();
      if (error) throw error;

      return { reference: data.reference };
    }, 'VALIDATION_FAILED');
  },

  /**
   * The §21.5 push foundation: registration only, nothing is sent in Milestone 3.
   *
   * Conflict is on the token, not the user. One person has several devices, and a device can
   * change hands — reassigning `user_id` on conflict is what stops a notification following a
   * phone to its new owner.
   */
  async registerPushToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android',
  ): Promise<void> {
    await guard(async () => {
      const { error } = await getSupabase()
        .from('push_tokens')
        .upsert(
          { token, user_id: userId, platform, last_seen_at: new Date().toISOString() },
          { onConflict: 'token' },
        );
      if (error) throw error;
    });
  },

  /** §S22. Moves account status, so it is privileged by definition (§11.2). */
  async requestDeletion(reason: string | undefined): Promise<void> {
    await guard(async () => {
      const { error } = await getSupabase().functions.invoke('request-account-deletion', {
        body: reason === undefined ? {} : { reason },
      });
      if (error) throw toAppError(error, 'VALIDATION_FAILED');
    }, 'VALIDATION_FAILED');
  },
};
