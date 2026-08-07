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
