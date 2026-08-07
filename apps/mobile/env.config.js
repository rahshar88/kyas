/**
 * Environment schema (spec §5.3), shared by `app.config.ts` and the app bundle.
 *
 * Why this file is CommonJS JavaScript rather than TypeScript: `@expo/config` evaluates
 * `app.config.ts` by transpiling that one file and `require`-ing the result. The require
 * hook does NOT extend to the config's own relative imports, so `app.config.ts` cannot
 * import a `.ts` module — it fails with "Cannot find module './src/config/env'". Keeping
 * the schema in plain CommonJS lets the config and the React Native bundle share exactly
 * one definition instead of drifting copies. Types live in `env.config.d.ts`.
 *
 * This module never reads `process.env` itself; callers pass the values in. That keeps the
 * literal `process.env.EXPO_PUBLIC_*` accesses in `src/config/env.ts`, where Babel can
 * statically inline them (see the comment there).
 */
const { z } = require('zod');

/** Spec §5.2 — three isolated environments. Never use production data in development. */
const APP_ENVIRONMENTS = ['development', 'beta', 'production'];

const baseSchema = z.object({
  EXPO_PUBLIC_ENVIRONMENT: z.enum(APP_ENVIRONMENTS),
  EXPO_PUBLIC_SUPABASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  EXPO_PUBLIC_SENTRY_DSN: z.url().optional(),
  EXPO_PUBLIC_ANALYTICS_KEY: z.string().min(1).optional(),
  // §S21 and §16.4: a build without live legal and support links cannot ship.
  EXPO_PUBLIC_SUPPORT_URL: z.url(),
  EXPO_PUBLIC_PRIVACY_URL: z.url(),
  EXPO_PUBLIC_TERMS_URL: z.url(),
});

/** The complete set of variables the mobile bundle may read (§5.3). */
const PUBLIC_ENV_KEYS = Object.keys(baseSchema.shape);

/**
 * Crash reporting and analytics are optional locally so a fresh clone runs without vendor
 * accounts, but mandatory anywhere a real tester exists — §20 requires that "crash
 * reporting, analytics and support workflows work in beta".
 */
const envSchema = baseSchema.superRefine((value, ctx) => {
  if (value.EXPO_PUBLIC_ENVIRONMENT === 'development') return;

  for (const key of ['EXPO_PUBLIC_SENTRY_DSN', 'EXPO_PUBLIC_ANALYTICS_KEY']) {
    if (!value[key]) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `is required in the ${value.EXPO_PUBLIC_ENVIRONMENT} environment`,
      });
    }
  }
});

class EnvValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validates the environment and fails loudly. Called at config time so a misconfigured
 * build breaks `expo config`, `expo prebuild`, `expo export` and every EAS build — rather
 * than showing a tester a white screen.
 */
function parseEnv(input) {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new EnvValidationError(
      `KyaScene environment configuration is invalid.\n\n${details}\n\n` +
        `Copy apps/mobile/.env.example to apps/mobile/.env and fill in the values.\n` +
        `See docs/architecture/environments.md for where each value comes from.`,
    );
  }

  return result.data;
}

module.exports = { APP_ENVIRONMENTS, EnvValidationError, PUBLIC_ENV_KEYS, parseEnv };
