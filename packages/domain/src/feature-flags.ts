/**
 * Server-managed feature flags, per spec §6.5.
 *
 * "Default every future flag to false." The beta home and every future module is gated
 * here, so a half-built feature can never look functional to a tester (§3.3).
 */
export const FEATURE_FLAG_KEYS = [
  'registration_open',
  'invite_required',
  'profile_photo_enabled',
  'referrals_enabled',
  'feedback_enabled',
  'discovery_enabled',
  'scene_feed_enabled',
  'messaging_enabled',
  'kya_enabled',
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

/**
 * Fail-closed defaults. The client uses these until the server responds, so a failed
 * flag fetch hides features rather than revealing unfinished ones.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  registration_open: false,
  invite_required: false,
  profile_photo_enabled: false,
  referrals_enabled: false,
  feedback_enabled: false,
  discovery_enabled: false,
  scene_feed_enabled: false,
  messaging_enabled: false,
  kya_enabled: false,
};
