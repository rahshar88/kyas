import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

// `env.config.js` is CommonJS on purpose: @expo/config transpiles ONLY this file before
// requiring it, so a relative import of a .ts module fails to resolve. See env.config.js.
import { parseEnv, type AppEnvironment } from './env.config';

/**
 * Loads `.env` when something upstream has not.
 *
 * Expo's CLI reads `.env` automatically; EAS CLI does not — it sets `EXPO_NO_DOTENV=1` so
 * build environments come from `eas.json` profiles rather than a developer's local file.
 * That is right for a build, but it also applies when EAS merely *reads* the config, as
 * `eas init` does, so validation failed on a machine where `.env` was sitting right there.
 * EAS reports that as `expo/bin/cli config --json exited with non-zero code: 1` — an exit
 * code with no error text, from a command the developer never typed.
 *
 * This lives in app.config.ts rather than env.config.js because env.config.js is also
 * bundled into the React Native app, where `node:fs` cannot be resolved at all.
 *
 * Anything already in the environment wins, so `eas.json` profiles, CI and shell overrides
 * stay authoritative — this only fills gaps. On EAS Build servers there is no `.env` (it is
 * gitignored), so it is a no-op and the profile supplies everything. A genuinely missing
 * variable still fails the build, which is the point of ADR-0003.
 */
function loadDotEnv(): void {
  /**
   * The one way to switch this off.
   *
   * It cannot key on `EXPO_NO_DOTENV`, because EAS CLI sets that on every invocation and
   * suppressing the load there is the bug this function exists to fix. But something has to
   * be able to opt out, or a developer's local `.env` silently masks a build profile that is
   * missing variables — which is exactly how a broken `preview` profile reached the build
   * queue. `scripts/verify-eas-build-env.mjs` sets this to reproduce a build server faithfully
   * on a machine that has a `.env` sitting right there.
   */
  if (process.env.KYASCENE_IGNORE_DOTENV === '1') return;

  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match?.[1] === undefined) continue;
    if (process.env[match[1]] !== undefined) continue;

    // Strip one layer of matching quotes, the way dotenv does.
    const raw = (match[2] ?? '').trim();
    process.env[match[1]] = /^(['"]).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
  }
}

loadDotEnv();

// Validates at config time. A missing or malformed variable fails `expo config`,
// `expo prebuild`, `expo export` and every EAS build — loudly, before a tester sees it.
const env = parseEnv(process.env as Record<string, string | undefined>);
const appEnv: AppEnvironment = env.EXPO_PUBLIC_ENVIRONMENT;

/**
 * Identity per spec §4.5.
 *
 * Production is `app.kyascene`; beta identifiers are `app.kyascene.beta`. Development
 * deliberately reuses the beta identifier rather than introducing a third one — a third
 * bundle id would have to be registered in both Apple Developer and Play Console for a
 * benefit that does not exist until there is a real TestFlight build to sit beside.
 * Revisit at Milestone 4; see docs/decisions/0002-monorepo-and-tooling.md.
 *
 * §4.5 also requires confirming identifier availability in Apple Developer and Google Play
 * Console before committing the first signed build. That has NOT been done yet.
 */
const IDENTITY: Record<AppEnvironment, { id: string; name: string }> = {
  development: { id: 'app.kyascene.beta', name: 'KyaScene Beta' },
  beta: { id: 'app.kyascene.beta', name: 'KyaScene Beta' },
  production: { id: 'app.kyascene', name: 'KyaScene' },
};

/** Scene Emerald (§7.1) — the launch and welcome surface. */
const SCENE_EMERALD = '#032C24';

/** Universal / app link host (§4.5). */
const LINK_HOST = 'kyascene.app';

/**
 * The Expo account that owns the EAS project (§22 — an account-ownership decision, recorded
 * in docs/decisions/0004-eas-project-ownership.md).
 *
 * Naming it here rather than relying on whoever is logged in matters because the founder's
 * Expo login can access more than one account: without `owner`, EAS resolves the project
 * against the personal account and reports a project that does not exist there.
 */
const EAS_OWNER = process.env.EAS_OWNER ?? 'nighthawk-productions-pty-ltd';

/**
 * EAS project id — https://expo.dev/accounts/nighthawk-productions-pty-ltd/projects/kyascene.
 *
 * Not a secret: it appears in every update URL the app fetches. It is committed rather than
 * supplied by the environment because EAS Build servers evaluate this config from a clean
 * checkout with no `.env`, so an id that lived only in a local file would leave the build
 * with no project to attach to.
 *
 * `eas init` created the project but could not write the id back — a dynamic `app.config.ts`
 * is not machine-editable, and the CLI reports that as an unrelated-looking
 * "Cannot read properties of undefined (reading 'CommonJS')". Pasting the id from the
 * dashboard is the supported path; see docs/runbooks/device-builds.md.
 *
 * The environment override exists so a fork can point at its own EAS project without editing
 * source. When empty, over-the-air updates are simply not configured and everything else
 * works unchanged, so a fresh clone is never blocked on having an Expo account.
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? 'd1f7b10c-c114-4d66-8f34-fe0892d0bec9';

export default ({ config }: ConfigContext): ExpoConfig => {
  const identity = IDENTITY[appEnv];
  const isReleaseLike = appEnv !== 'development';

  return {
    ...config,
    name: identity.name,
    slug: 'kyascene',
    version: '0.1.0',
    scheme: 'kyascene',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    backgroundColor: SCENE_EMERALD,
    // §4.7: no consumer web application. Omitting 'web' keeps react-native-web out of the
    // dependency graph and stops anyone accidentally shipping a browser build.
    platforms: ['ios', 'android'],
    // No `newArchEnabled` flag: the New Architecture is the only architecture from SDK 54
    // / React Native 0.80 onward, so the option was removed from ExpoConfig.
    icon: './assets/icon.png',

    ios: {
      bundleIdentifier: identity.id,
      supportsTablet: false,
      // Universal links only point at the real host once there is a real host to point at.
      associatedDomains: isReleaseLike ? [`applinks:${LINK_HOST}`] : [],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // No camera or photo-library usage descriptions yet. The first permission request
        // is S13 in Milestone 2; declaring unused permission strings invites App Store
        // review questions we cannot answer (§18).
      },
    },

    android: {
      package: identity.id,
      // Edge-to-edge is unconditional from SDK 54 onward, so there is no flag to set —
      // §19's "check edge-to-edge layout and safe insets" is a QA task, handled by
      // AppScreen's safe-area edges.
      //
      // Predictive back stays off until §19's "validate system back behaviour on every
      // nested route and modal" has actually been done on a device; enabling it before
      // then would ship an animation over untested navigation.
      predictiveBackGestureEnabled: false,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        monochromeImage: './assets/adaptive-icon-monochrome.png',
        backgroundColor: SCENE_EMERALD,
      },
      permissions: [],
      /**
       * §13.2 data minimisation, enforced at the manifest rather than by policy: no exact
       * GPS or background location in P0, and no contact-book upload. A transitive
       * dependency that quietly requests one of these will be stripped, and
       * scripts/verify-native-output.mjs fails CI if any reappears.
       */
      blockedPermissions: [
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.READ_CONTACTS',
        'android.permission.WRITE_CONTACTS',
        /**
         * expo-dev-client contributes SYSTEM_ALERT_WINDOW (its floating dev menu) to the
         * MAIN manifest, not just the debug one, so it would otherwise ship to Play and
         * have to be justified in Data Safety (§19) for a capability the product does not
         * use. Blocked everywhere except development, where the dev menu needs it.
         */
        ...(isReleaseLike ? ['android.permission.SYSTEM_ALERT_WINDOW'] : []),
      ],
      intentFilters: isReleaseLike
        ? [
            {
              action: 'VIEW',
              autoVerify: true,
              data: [{ scheme: 'https', host: LINK_HOST }],
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ]
        : [],
    },

    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          backgroundColor: SCENE_EMERALD,
          imageWidth: 180,
        },
      ],
    ],

    /**
     * Over-the-air updates (§4.2 lists EAS Update in the baseline).
     *
     * The `fingerprint` runtime version is the important part: it hashes the native project,
     * so a JavaScript-only change ships over the air, while a change touching native code
     * requires a new build instead of silently shipping an update the installed binary
     * cannot run.
     */
    ...(EAS_PROJECT_ID === ''
      ? {}
      : {
          owner: EAS_OWNER,
          updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` },
          runtimeVersion: { policy: 'fingerprint' as const },
        }),

    experiments: { typedRoutes: true },

    extra: {
      environment: appEnv,
      poweredBy: '1818',
      ...(EAS_PROJECT_ID === '' ? {} : { eas: { projectId: EAS_PROJECT_ID } }),
    },
  };
};
