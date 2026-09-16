import { scrubError, scrubText, scrubValue } from './scrub';

/**
 * Vendor-neutral error reporting (§4.3, §4.4, §21 Milestone 4's "crash monitoring").
 *
 * The same shape as `@kyascene/analytics`, for the same reason: §4.3 requires backend
 * capabilities to be reached "through typed service interfaces so individual vendors can be
 * changed later without rewriting screens", and §22 reserves the vendor itself for the founder
 * because it processes personal data.
 *
 * So this ships an interface, a console implementation and a no-op — and nothing sends
 * anywhere. Choosing Sentry later is then a configuration change plus one adapter file, not a
 * migration through every screen.
 *
 * **Scrubbing is not the adapter's business.** It happens in this module before an adapter is
 * called, so it cannot be forgotten by a new adapter, disabled in a vendor dashboard, or
 * skipped by a code path that reaches for the SDK directly. A vendor's own filtering runs
 * after the data has left the device, which is too late to matter.
 */
export type Severity = 'fatal' | 'error' | 'warning' | 'info';

export interface ReportContext {
  /** Where it happened — a screen id like 'S18'. Never a route with parameters in it. */
  screen?: string;
  /** A typed AppErrorCode, so reports group by cause rather than by message text. */
  code?: string;
  /** The §12.3 request id, which ties a report to a server log without naming anybody. */
  requestId?: string;
}

export interface Breadcrumb {
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface ErrorReporter {
  captureException(error: unknown, context?: ReportContext): void;
  captureMessage(message: string, severity: Severity, context?: ReportContext): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
  /**
   * Associates reports with an opaque, app-generated id — never an email address and never
   * the Supabase user id, which appears in URLs and in other people's data (§14.3, §S19).
   */
  identify(anonymousId: string | null): void;
}

/** Ships in production until a vendor is chosen. Reports nothing, by design. */
export class NoopErrorReporter implements ErrorReporter {
  captureException(): void {}
  captureMessage(): void {}
  addBreadcrumb(): void {}
  identify(): void {}
}

/**
 * Development implementation: prints, and keeps reports in memory so tests can assert on them.
 *
 * It stores what would have been **sent**, after scrubbing — not what was passed in. A test
 * asserting on the input would prove nothing about what leaves the device, which is the only
 * claim worth making here.
 */
export class ConsoleErrorReporter implements ErrorReporter {
  readonly reports: { message: string; severity: Severity; context?: ReportContext }[] = [];
  readonly breadcrumbs: Breadcrumb[] = [];

  captureException(error: unknown, context?: ReportContext): void {
    const scrubbed = scrubError(error);
    this.reports.push({
      message: `${scrubbed.name}: ${scrubbed.message}`,
      severity: 'error',
      ...(context === undefined ? {} : { context }),
    });
    // eslint-disable-next-line no-console
    console.log(`[error] ${scrubbed.name}: ${scrubbed.message}`, context ?? {});
  }

  captureMessage(message: string, severity: Severity, context?: ReportContext): void {
    const scrubbed = scrubText(message);
    this.reports.push({
      message: scrubbed,
      severity,
      ...(context === undefined ? {} : { context }),
    });
    // eslint-disable-next-line no-console
    console.log(`[${severity}] ${scrubbed}`, context ?? {});
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push({
      category: breadcrumb.category,
      message: scrubText(breadcrumb.message),
      ...(breadcrumb.data === undefined
        ? {}
        : { data: scrubValue(breadcrumb.data) as Record<string, unknown> }),
    });
  }

  identify(): void {}
}

/**
 * Re-exported so an adapter written later cannot bypass scrubbing by reaching for the vendor
 * SDK and forgetting this module exists. Whatever the adapter sends, it goes through these.
 */
export { scrubError, scrubText, scrubValue };
