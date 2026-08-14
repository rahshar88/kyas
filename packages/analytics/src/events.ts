/**
 * Approved P0 analytics events, per spec §14.2, plus the screen-level events named in
 * the §9 screen specifications (S00 session restore, S02 OTP request failure).
 *
 * Spec §14.1: lowercase snake case, each event has a typed schema and an owner.
 * Adding an event here is a deliberate act — §16.4 makes "analytics containing personal
 * data" a release blocker, so every new event must be reviewed against §14.3.
 */
export const ANALYTICS_EVENTS = [
  // Session and launch (S00)
  'app_opened',
  'session_restore_succeeded',
  'session_restore_failed',

  // Welcome and authentication (S01–S03)
  'welcome_viewed',
  'auth_started',
  'otp_requested',
  'otp_request_failed',
  'auth_completed',
  'auth_failed',

  // Invitation and eligibility (S04–S05)
  'invite_viewed',
  'invite_redeemed',
  'eligibility_completed',
  'eligibility_failed',

  // Registration (S06–S17)
  'onboarding_step_viewed',
  'onboarding_step_completed',
  'onboarding_resumed',
  'registration_submitted',
  'registration_approved',
  'registration_rejected',

  // Beta home, referrals and feedback (S18–S22)
  'beta_home_viewed',
  'feature_vote_submitted',
  'referral_viewed',
  'referral_shared',
  'feedback_submitted',
  'profile_updated',
  'privacy_updated',
  'account_deletion_started',
  'account_deletion_requested',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
