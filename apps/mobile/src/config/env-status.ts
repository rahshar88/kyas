/**
 * Whether this bundle is configured, asked without dying if the answer is no.
 *
 * `env.ts` calls `parseEnv` at module scope and throws when a value is missing. That is right
 * for a **build**: the throw happens on EAS at the "Read app config" phase, which names every
 * missing key, and it has caught real problems.
 *
 * On an **over-the-air update** the same throw lands somewhere else entirely. Nothing reads
 * the config before publishing, so the first thing to evaluate it is the phone — during the
 * import at the top of `_layout.tsx`, before anything has rendered. The app closes instantly.
 * No message, no error screen, nothing in a screenshot. A tester can only report "it opens and
 * shuts", and that is what they reported.
 *
 * So the import is wrapped, once, here. The validation is unchanged and still strict; what
 * changes is that a failure becomes a value the root layout can render (§6.6 requires a
 * designed state for every failure) rather than an exception nobody sees.
 *
 * This is the same shape as `apps/admin/src/supabase.ts`, which exports `configurationError`
 * for exactly the same reason: a blank page taught us nothing either.
 */
import type { Env } from './env';

interface EnvStatus {
  env: Env | undefined;
  /** Present when the bundle cannot run. Already human-readable — `parseEnv` names each key. */
  error: string | undefined;
}

function read(): EnvStatus {
  try {
    /**
     * `require`, not `import`, so the throw is catchable. A static import is hoisted and
     * evaluated before any statement in this file, which would put the failure back where it
     * started — outside anything that can handle it.
     */
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('./env') as { env: Env };
    return { env: module.env, error: undefined };
  } catch (error) {
    return {
      env: undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const status = read();

export const configurationError = status.error;
export const isConfigured = status.error === undefined;
