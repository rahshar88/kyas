import type { AnalyticsEvent } from './events';
import type { AnalyticsContext, AnalyticsProperties } from './properties';

/**
 * Vendor-neutral analytics interface, per spec §4.4 ("Analytics: PostHog or equivalent
 * through an internal analytics adapter") and §4.3 (backend capabilities are reached
 * through typed service interfaces so vendors can change without rewriting screens).
 *
 * §22 reserves the actual vendor choice for the founder, so Milestone 0 ships this
 * interface and a console implementation and nothing else.
 */
export interface AnalyticsAdapter {
  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void;
  /**
   * Associates events with an opaque, app-generated id. Never an email address and never
   * a raw Supabase user id used elsewhere in a public surface (§14.3, §S19).
   */
  identify(anonymousId: string): void;
  /** Clears identity on sign-out and on account deletion (§11.4). */
  reset(): void;
  setContext(context: AnalyticsContext): void;
}

/**
 * Development implementation. Writes to the console and holds events in memory so tests
 * can assert on them. No network, no vendor SDK, no persistence.
 */
export class ConsoleAnalyticsAdapter implements AnalyticsAdapter {
  private context: AnalyticsContext | undefined;
  readonly recorded: { event: AnalyticsEvent; properties: AnalyticsProperties | undefined }[] = [];

  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
    this.recorded.push({ event, properties });
    // Informational dev output. Deliberately `log`, not `warn`: §14 events are frequent, and
    // colouring every one as a warning drowns out the real ones in the Metro console.
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, { ...properties, ...this.context });
  }

  identify(anonymousId: string): void {
    // eslint-disable-next-line no-console
    console.log(`[analytics] identify ${anonymousId}`);
  }

  reset(): void {
    this.recorded.length = 0;
  }

  setContext(context: AnalyticsContext): void {
    this.context = context;
  }
}

/** Used in tests and wherever analytics must be provably inert. */
export class NoopAnalyticsAdapter implements AnalyticsAdapter {
  track(): void {}
  identify(): void {}
  reset(): void {}
  setContext(): void {}
}
