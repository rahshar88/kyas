import {
  ConsoleErrorReporter,
  NoopErrorReporter,
  scrubError,
  type ErrorReporter,
} from '@kyascene/observability';

import { appEnvironment } from '@/config/env';
import { recordFatal } from '@/services/crash-log';

/**
 * The app's single error-reporting entry point (§21 Milestone 4: "crash monitoring").
 *
 * Same shape as `analytics.ts`, for the same reason — §4.3's typed service interfaces, and §22
 * reserving the vendor for the founder. Choosing Sentry later replaces one expression here;
 * nothing at any call site changes.
 *
 * Nothing is sent anywhere today. That is the honest state, and it is what
 * `docs/product/privacy-disclosures.md` currently declares to Apple and Google.
 */
export const errorReporter: ErrorReporter =
  appEnvironment === 'development' ? new ConsoleErrorReporter() : new NoopErrorReporter();

/**
 * Catches what would otherwise be a silent crash.
 *
 * React Native routes uncaught errors through `ErrorUtils`. Without a handler a fatal error
 * closes the app with no record anywhere — which is precisely the report worth having, and the
 * one a tester describes as "it just shut". §18 asks for crash monitoring before TestFlight for
 * this reason: an external tester will not reproduce a crash on request, so if the first
 * occurrence is not captured, it may never be understood.
 *
 * The default handler is still called. Replacing it would suppress the red screen in
 * development and change what the OS reports in production — this observes, it does not
 * intervene.
 *
 * Safe to call more than once: the previous handler is captured and chained, and a second call
 * is a no-op rather than a second link in the chain.
 */
let installed = false;

export function installGlobalErrorHandler(): void {
  if (installed) return;

  const errorUtils = (
    globalThis as unknown as {
      ErrorUtils?: {
        getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
      };
    }
  ).ErrorUtils;

  // Absent under Jest and in any non-React-Native runtime. Not an error — there is simply
  // nothing to hook, and throwing here would break every test that imports a screen.
  if (errorUtils === undefined) return;

  installed = true;
  const previous = errorUtils.getGlobalHandler();

  errorUtils.setGlobalHandler((error, isFatal) => {
    // Scrubbed before it reaches the reporter, and again inside it. Belt and braces on the one
    // surface where a leak would be invisible to review.
    const safe = scrubError(error);

    /**
     * Written down before anything else, because this is usually the last code that runs.
     *
     * With no crash vendor configured (§22) a fatal error otherwise leaves no trace at all —
     * the process ends and a tester can only report "it opens and shuts". That sentence cost
     * two wrong diagnoses and a rebuild. The next launch reads this back and shows it.
     */
    recordFatal(error, isFatal === true ? 'while starting up' : 'in the background');

    errorReporter.captureException(error, { code: safe.name });
    errorReporter.captureMessage(
      isFatal === true ? 'fatal crash' : 'uncaught error',
      isFatal === true ? 'fatal' : 'error',
    );

    previous(error, isFatal);
  });
}
