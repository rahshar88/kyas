import type { AccountStatus } from '@kyascene/domain';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { authRepository, type AuthSession } from '@/repositories/auth-repository';
import { registrationRepository } from '@/repositories/registration-repository';
import { analytics } from '@/services/analytics';

/**
 * Holds the authentication session (§6.3: "Authentication session: auth provider").
 *
 * The status deliberately comes from the server rather than being inferred locally, per
 * §8.2's "Route guards must be derived from server status, not only client state". A student
 * who was suspended between launches must not be admitted on the strength of a stale local
 * flag.
 */
interface AuthState {
  isRestoring: boolean;
  session: AuthSession | null;
  status: AccountStatus | null;
  signInWithCode: (email: string, code: string) => Promise<void>;
  requestCode: (email: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isRestoring, setIsRestoring] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);

  const loadStatus = useCallback(async (userId: string) => {
    const next = await registrationRepository.getStatus(userId);
    setStatus(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const restored = await authRepository.getSession();
        if (cancelled) return;

        setSession(restored);
        if (restored) await loadStatus(restored.userId);
      } catch {
        // S00 already handles the visible failure path; the provider only needs to settle.
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadStatus]);

  const requestCode = useCallback(async (email: string) => {
    analytics.track('otp_requested', { screen: 'S02' });
    try {
      await authRepository.requestCode(email);
    } catch (error) {
      // §14.3 forbids attaching the address to an event, so only the outcome is recorded.
      analytics.track('otp_request_failed', {
        screen: 'S02',
        outcomeCode: (error as { code?: string }).code ?? 'UNKNOWN',
      });
      throw error;
    }
  }, []);

  const signInWithCode = useCallback(
    async (email: string, code: string) => {
      try {
        const next = await authRepository.verifyCode(email, code);
        // §12.4: creating the profile row is idempotent, so a retried verification is safe.
        await registrationRepository.ensureProfile(next.userId);

        setSession(next);
        await loadStatus(next.userId);
        analytics.track('auth_completed', { screen: 'S03' });
      } catch (error) {
        analytics.track('auth_failed', {
          screen: 'S03',
          outcomeCode: (error as { code?: string }).code ?? 'UNKNOWN',
        });
        throw error;
      }
    },
    [loadStatus],
  );

  const refreshStatus = useCallback(async () => {
    if (!session) return;
    await loadStatus(session.userId);
  }, [loadStatus, session]);

  const signOut = useCallback(async () => {
    await authRepository.signOut();
    setSession(null);
    setStatus(null);
    analytics.reset();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ isRestoring, session, status, signInWithCode, requestCode, refreshStatus, signOut }),
    [isRestoring, session, status, signInWithCode, requestCode, refreshStatus, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
