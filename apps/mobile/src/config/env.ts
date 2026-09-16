import { parseEnv, type AppEnvironment, type Env } from '../../env.config';

export {
  APP_ENVIRONMENTS,
  EnvValidationError,
  PUBLIC_ENV_KEYS,
  parseEnv,
  type AppEnvironment,
  type Env,
} from '../../env.config';

/**
 * Raw environment access for the React Native bundle.
 *
 * Every key MUST be written as a literal `process.env.EXPO_PUBLIC_*` member expression.
 * `babel-preset-expo` inlines these at build time by static analysis; a dynamic lookup
 * such as `process.env[key]` is NOT inlined and silently evaluates to `undefined` in a
 * release bundle. That failure mode is invisible in development, so the longhand below is
 * deliberate — do not "simplify" it into a loop.
 *
 * Spec §5.3: only publishable values may use the EXPO_PUBLIC_ prefix. Service-role keys,
 * signing credentials and provider secrets must never be included in the mobile bundle.
 */
const rawEnv: Record<string, string | undefined> = {
  EXPO_PUBLIC_ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  EXPO_PUBLIC_ANALYTICS_KEY: process.env.EXPO_PUBLIC_ANALYTICS_KEY,
  EXPO_PUBLIC_SUPPORT_URL: process.env.EXPO_PUBLIC_SUPPORT_URL,
  EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
};

export const env: Env = parseEnv(rawEnv);
export const appEnvironment: AppEnvironment = env.EXPO_PUBLIC_ENVIRONMENT;
export const isProduction = appEnvironment === 'production';
