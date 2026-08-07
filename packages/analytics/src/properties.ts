/**
 * The complete allowlist of analytics properties, per spec §14.3.
 *
 * This type is the enforcement mechanism for §13.2 and §16.4. Because `track()` accepts
 * only these keys, attaching an email address, a name, a phone number, free-text feedback
 * or a raw location is a TypeScript error at the call site rather than something a
 * reviewer has to notice. Widening this interface is a privacy decision, not a chore.
 */
export interface AnalyticsProperties {
  /** Screen or onboarding step identifier, e.g. 'S06' or 'study_details'. */
  screen?: string;
  /** Opaque invite campaign identifier. Never the inviter's user id (§S19). */
  campaignId?: string;
  /** Broad goal identifiers from the catalogue (§11.1) — codes, never free text. */
  goalCodes?: readonly string[];
  /** Broad interest identifiers from the catalogue (§11.1) — codes, never free text. */
  interestCodes?: readonly string[];
  /** Machine-readable success/failure code, e.g. an AppErrorCode. */
  outcomeCode?: string;
  /**
   * Bucketed duration, never a raw millisecond timestamp — §14.3 allows a "duration
   * bucket" only, because precise timings can re-identify a small beta cohort.
   */
  durationBucket?: DurationBucket;
}

export const DURATION_BUCKETS = [
  'under_5s',
  '5s_to_15s',
  '15s_to_60s',
  '1m_to_3m',
  'over_3m',
] as const;

export type DurationBucket = (typeof DURATION_BUCKETS)[number];

export function toDurationBucket(milliseconds: number): DurationBucket {
  if (milliseconds < 5_000) return 'under_5s';
  if (milliseconds < 15_000) return '5s_to_15s';
  if (milliseconds < 60_000) return '15s_to_60s';
  if (milliseconds < 180_000) return '1m_to_3m';
  return 'over_3m';
}

/**
 * Context attached to every event by the adapter, not by call sites (§14.3: app version
 * and build, platform and OS major version, environment).
 */
export interface AnalyticsContext {
  appVersion: string;
  buildNumber: string;
  platform: 'ios' | 'android';
  osMajorVersion: string;
  environment: 'development' | 'beta' | 'production';
}
