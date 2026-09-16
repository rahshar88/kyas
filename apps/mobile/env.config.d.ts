/** Types for `env.config.js`. See that file for why the schema is CommonJS. */

export declare const APP_ENVIRONMENTS: readonly ['development', 'beta', 'production'];

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export interface Env {
  EXPO_PUBLIC_ENVIRONMENT: AppEnvironment;
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  EXPO_PUBLIC_SENTRY_DSN?: string;
  EXPO_PUBLIC_ANALYTICS_KEY?: string;
  EXPO_PUBLIC_SUPPORT_URL: string;
  EXPO_PUBLIC_PRIVACY_URL: string;
  EXPO_PUBLIC_TERMS_URL: string;
}

/** Every variable the mobile bundle may read (§5.3). Derived from the schema shape. */
export declare const PUBLIC_ENV_KEYS: readonly string[];

export declare class EnvValidationError extends Error {
  constructor(message: string);
}

export declare function parseEnv(input: Record<string, string | undefined>): Env;
