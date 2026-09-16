/**
 * Environment for component tests.
 *
 * `src/config/env.ts` validates at import time, so tests need a valid environment before
 * any module under test is loaded. These are obviously-fake development values — they must
 * never resemble a real project (§5.2: never use production data in local development).
 */
process.env.EXPO_PUBLIC_ENVIRONMENT ??= 'development';
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://test-project-ref.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'test-publishable-key-not-a-real-secret';
process.env.EXPO_PUBLIC_SUPPORT_URL ??= 'https://kyascene.app/support';
process.env.EXPO_PUBLIC_PRIVACY_URL ??= 'https://kyascene.app/privacy';
process.env.EXPO_PUBLIC_TERMS_URL ??= 'https://kyascene.app/terms';

export {};
