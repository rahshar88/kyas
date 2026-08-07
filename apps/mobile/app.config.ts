import type { ConfigContext, ExpoConfig } from 'expo/config';

// `env.config.js` is CommonJS on purpose: @expo/config transpiles ONLY this file before
// requiring it, so a relative import of a .ts module fails to resolve. See env.config.js.
import { parseEnv, type AppEnvironment } from './env.config';

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

    experiments: { typedRoutes: true },

    extra: {
      environment: appEnv,
      poweredBy: '1818',
    },
  };
};
