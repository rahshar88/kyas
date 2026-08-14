import {
  ConsoleAnalyticsAdapter,
  NoopAnalyticsAdapter,
  type AnalyticsAdapter,
} from '@kyascene/analytics';

import { appEnvironment } from '@/config/env';

/**
 * The app's single analytics entry point.
 *
 * §4.4 requires a vendor to sit behind "an internal analytics adapter", and §22 reserves
 * the vendor choice for the founder — so Milestone 0 ships the seam and no vendor SDK.
 * Milestone 4 swaps the implementation here; call sites never change.
 *
 * Console output in development only. In beta and production this is inert rather than
 * chatty, because §14.3 forbids attaching contact information or free text to events and a
 * console fallback is the easiest way for that rule to be broken accidentally.
 */
export const analytics: AnalyticsAdapter =
  appEnvironment === 'development' ? new ConsoleAnalyticsAdapter() : new NoopAnalyticsAdapter();
