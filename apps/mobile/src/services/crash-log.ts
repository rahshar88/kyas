import AsyncStorage from '@react-native-async-storage/async-storage';
import { scrubError, scrubText } from '@kyascene/observability';

/**
 * Keeps the last fatal error so it can be shown after the app restarts.
 *
 * A crash during module evaluation or the first render kills the process before anything can
 * be drawn. There is no error boundary above it, no screen to put a message on, and — with no
 * crash vendor configured (§22) — nowhere for it to go. What a tester can report is "it opens
 * and shuts", which is what happened, twice, and cost two wrong diagnoses and a rebuild.
 *
 * So the error is written to storage as it happens and read back on the next launch. The app
 * still dies; it just stops dying silently.
 *
 * This is a development and beta facility. It is not a crash-reporting product: one error, on
 * this device, readable by the person holding it. When a vendor is chosen it replaces this.
 *
 * Everything is scrubbed on the way in, by the same rules as `@kyascene/observability` — a
 * stack trace is the likeliest place for an email or a suburb to appear, and a screen someone
 * photographs and sends to us is exactly the wrong place for it to surface.
 */
const KEY = 'kyascene.lastFatal.v1';

export interface StoredCrash {
  message: string;
  stack: string | undefined;
  at: string;
}

/**
 * Fire-and-forget on purpose. This runs from the global error handler while the process is
 * already failing; awaiting a write there would be a promise nobody lives to see resolve.
 */
export function recordFatal(error: unknown, at: string): void {
  const scrubbed = scrubError(error);

  const payload: StoredCrash = {
    message: `${scrubbed.name}: ${scrubbed.message}`,
    stack: scrubbed.stack === undefined ? undefined : scrubText(scrubbed.stack).slice(0, 4000),
    at,
  };

  void AsyncStorage.setItem(KEY, JSON.stringify(payload)).catch(() => undefined);
}

export async function readLastFatal(): Promise<StoredCrash | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === null) return null;
    return JSON.parse(raw) as StoredCrash;
  } catch {
    // A corrupt record must not itself become the reason the app will not start.
    return null;
  }
}

export async function clearLastFatal(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
