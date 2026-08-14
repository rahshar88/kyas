import * as Updates from 'expo-updates';

import { env } from '@/config/env';

/**
 * One line saying which JavaScript this phone is running, shown under the 1818 mark on every
 * screen via `PoweredBy1818`'s `detail` prop.
 *
 * The reason it is global rather than tucked into Settings: the moments this answer matters
 * are the moments Settings is unreachable — a tester stuck at sign-in, a screen that errors
 * on open. Two multi-day debugging rounds here were spent guessing at symptoms of code that
 * was not on the device, and both happened on screens with a 1818 footer in plain sight.
 *
 * `updateId` null means the embedded bundle — the JavaScript the build shipped with, before
 * any update applied — which is its own diagnosis. Hidden in production: bundle forensics are
 * for people debugging the app, and §2.2 wants this corner of the screen quiet.
 *
 * Evaluated once at import. The value cannot change without a relaunch, and the ISO slice
 * avoids locale formatting — Hermes' Intl support is exactly the assumption that already cost
 * a day here.
 */
export const bundleIdentity: string | undefined = (() => {
  if (env.EXPO_PUBLIC_ENVIRONMENT === 'production') return undefined;

  try {
    if (Updates.updateId == null) return 'embedded bundle';

    const published =
      Updates.createdAt == null ? '' : ` · ${Updates.createdAt.toISOString().slice(0, 16)}Z`;
    return `${Updates.updateId.slice(0, 8)}${published}`;
  } catch {
    return 'embedded bundle';
  }
})();
