import { AppError } from '@kyascene/domain';

import { getSupabase } from '@/services/supabase';

import { guard, toAppError } from './errors';

/**
 * Email one-time-code authentication (§4.6, §S02, §S03).
 *
 * §4.6: "Use email one-time codes for the first beta. Do not add Google authentication
 * without also evaluating Sign in with Apple requirements."
 *
 * A note on what is deliberately absent: there is no password anywhere in this file, and no
 * social provider. Adding either is a §22 founder decision, not an implementation detail.
 */
export interface AuthSession {
  userId: string;
  email: string;
  expiresAt: number | null;
}

export interface AuthRepository {
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<AuthSession>;
  getSession(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
}

export const authRepository: AuthRepository = {
  /**
   * §S02: sends the code. The address is normalised by the schema before it reaches here.
   *
   * `shouldCreateUser` is true because §S02's purpose is "Create or recover an account
   * without a password" — the same screen serves both, and telling the two apart in the UI
   * would leak whether an address is already registered.
   */
  async requestCode(email: string): Promise<void> {
    await guard(async () => {
      const { error } = await getSupabase().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
    }, 'UNKNOWN');
  },

  /** §S03: exchanges the six-digit code for a session. */
  async verifyCode(email: string, code: string): Promise<AuthSession> {
    return guard(async () => {
      const { data, error } = await getSupabase().auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });

      if (error) throw error;
      if (!data.session || !data.user) {
        throw new AppError('UNKNOWN', { message: 'verifyOtp returned no session' });
      }

      return {
        userId: data.user.id,
        email: data.user.email ?? email,
        expiresAt: data.session.expires_at ?? null,
      };
    }, 'VALIDATION_FAILED');
  },

  /** §S00: restore an existing session on launch. */
  async getSession(): Promise<AuthSession | null> {
    try {
      const { data, error } = await getSupabase().auth.getSession();
      if (error) throw error;
      if (!data.session?.user) return null;

      return {
        userId: data.session.user.id,
        email: data.session.user.email ?? '',
        expiresAt: data.session.expires_at ?? null,
      };
    } catch (error) {
      // A failed restore is not a failed launch. S00 routes to welcome and the tester signs
      // in again, rather than being shown an error they cannot act on.
      const appError = toAppError(error);
      if (appError.code === 'SESSION_EXPIRED') return null;
      throw appError;
    }
  },

  async signOut(): Promise<void> {
    await guard(async () => {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
    });
  },
};
