import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EnvValidationError, PUBLIC_ENV_KEYS, parseEnv } from '../env';

const VALID = {
  EXPO_PUBLIC_ENVIRONMENT: 'development',
  EXPO_PUBLIC_SUPABASE_URL: 'https://test-project-ref.supabase.co',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key-not-a-real-secret',
  EXPO_PUBLIC_SUPPORT_URL: 'https://kyascene.app/support',
  EXPO_PUBLIC_PRIVACY_URL: 'https://kyascene.app/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://kyascene.app/terms',
} as const;

describe('environment validation (spec §5.3)', () => {
  it('accepts a complete development environment', () => {
    expect(parseEnv({ ...VALID }).EXPO_PUBLIC_ENVIRONMENT).toBe('development');
  });

  it('fails loudly when the Supabase URL is missing, naming the file to copy', () => {
    const { EXPO_PUBLIC_SUPABASE_URL: _omitted, ...withoutUrl } = VALID;

    expect(() => parseEnv({ ...withoutUrl })).toThrow(EnvValidationError);
    expect(() => parseEnv({ ...withoutUrl })).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
    expect(() => parseEnv({ ...withoutUrl })).toThrow(/\.env\.example/);
  });

  it('rejects a malformed URL rather than passing it through to a fetch', () => {
    expect(() => parseEnv({ ...VALID, EXPO_PUBLIC_SUPABASE_URL: 'not-a-url' })).toThrow(
      EnvValidationError,
    );
  });

  it('rejects an unknown environment name', () => {
    expect(() => parseEnv({ ...VALID, EXPO_PUBLIC_ENVIRONMENT: 'staging' })).toThrow(
      EnvValidationError,
    );
  });

  it('reports every problem at once instead of one per run', () => {
    let message = '';
    try {
      parseEnv({ EXPO_PUBLIC_ENVIRONMENT: 'development' });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(message).toContain('EXPO_PUBLIC_PRIVACY_URL');
    expect(message).toContain('EXPO_PUBLIC_TERMS_URL');
  });

  /**
   * A `.env` file spells "not set" as `KEY=`, which dotenv reads as an empty string rather
   * than undefined. Copying `.env.example` verbatim is the first thing anyone does with a
   * fresh clone, so it must work.
   */
  describe('blank values are treated as absent', () => {
    it('accepts empty optional keys, the way a .env file writes them', () => {
      expect(() =>
        parseEnv({ ...VALID, EXPO_PUBLIC_SENTRY_DSN: '', EXPO_PUBLIC_ANALYTICS_KEY: '' }),
      ).not.toThrow();
    });

    it('trims stray whitespace rather than failing on an invisible space', () => {
      const parsed = parseEnv({ ...VALID, EXPO_PUBLIC_SUPABASE_URL: '  https://x.supabase.co  ' });
      expect(parsed.EXPO_PUBLIC_SUPABASE_URL).toBe('https://x.supabase.co');
    });

    it('still rejects a blank REQUIRED value', () => {
      expect(() => parseEnv({ ...VALID, EXPO_PUBLIC_SUPABASE_URL: '   ' })).toThrow(
        /EXPO_PUBLIC_SUPABASE_URL/,
      );
    });

    /**
     * The README tells a new developer to copy this file and fill in the Supabase values.
     * This asserts that doing exactly that produces a working development environment, so
     * the onboarding instruction cannot drift away from the schema.
     */
    it('validates the shipped .env.example once Supabase values are filled in', () => {
      const raw = readFileSync(join(__dirname, '..', '..', '..', '.env.example'), 'utf8');

      const parsed: Record<string, string> = {};
      for (const line of raw.split('\n')) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
        if (match?.[1] !== undefined) parsed[match[1]] = match[2] ?? '';
      }

      expect(Object.keys(parsed).sort()).toEqual([...PUBLIC_ENV_KEYS].sort());

      expect(() =>
        parseEnv({
          ...parsed,
          // The only two placeholders the README asks a developer to replace.
          EXPO_PUBLIC_SUPABASE_URL: 'https://real-project-ref.supabase.co',
          EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'a-real-publishable-anon-key-value',
        }),
      ).not.toThrow();
    });
  });

  describe('crash reporting and analytics (§20)', () => {
    it('lets development run without vendor accounts', () => {
      expect(() => parseEnv({ ...VALID })).not.toThrow();
    });

    it.each(['beta', 'production'])('requires a Sentry DSN in %s', (environment) => {
      expect(() => parseEnv({ ...VALID, EXPO_PUBLIC_ENVIRONMENT: environment })).toThrow(
        /EXPO_PUBLIC_SENTRY_DSN/,
      );
    });

    it('accepts beta once crash reporting and analytics are configured', () => {
      expect(() =>
        parseEnv({
          ...VALID,
          EXPO_PUBLIC_ENVIRONMENT: 'beta',
          EXPO_PUBLIC_SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1',
          EXPO_PUBLIC_ANALYTICS_KEY: 'analytics-key',
        }),
      ).not.toThrow();
    });
  });

  /**
   * §5.3 and §13.1: no service-role key, signing credential or provider secret may reach
   * the mobile bundle. Anything with the EXPO_PUBLIC_ prefix is readable by anyone who
   * downloads the app, so this guards the shape of the allowlist itself — adding a
   * privileged-sounding variable fails here rather than in a security review.
   */
  describe('no privileged value can enter the bundle', () => {
    it('exposes only EXPO_PUBLIC_ variables', () => {
      for (const key of PUBLIC_ENV_KEYS) {
        expect(key).toMatch(/^EXPO_PUBLIC_/);
      }
    });

    it('contains no key that names a secret', () => {
      const forbidden = /SERVICE_ROLE|SECRET|PRIVATE_KEY|PASSWORD|SIGNING/i;
      expect(PUBLIC_ENV_KEYS.filter((key) => forbidden.test(key))).toEqual([]);
    });
  });
});
