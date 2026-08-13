import {
  AppScreen,
  KyaSceneWordmark,
  PoweredBy1818,
  PrimaryButton,
  colors,
  semanticColors,
  spacing,
  typography,
} from '@kyascene/ui';
import { usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { resolveDestination } from '@/navigation/destination';
import { WELCOME_ROUTE } from '@/navigation/route-groups';
import { useAuth } from '@/providers/AuthProvider';
import { draftRepository } from '@/repositories/draft-repository';
import { registrationRepository } from '@/repositories/registration-repository';
import { analytics } from '@/services/analytics';

import { SESSION_RESTORE_TIMEOUT_MS } from '../services/session';

/**
 * S00 — Launch and session restoration.
 *
 * §S00: "After a bounded timeout, show retry and offline guidance. Never trap the user on a
 * permanent splash screen." The timeout and the retry path are the parts that are easy to
 * forget once the happy path works, so they are load-bearing here rather than added later.
 *
 * §10.2 defines what happens after restoration: _"Launch → Restore session → Fetch status →
 * Resume last valid registration step."_ Milestone 0 shipped a placeholder that sent every
 * signed-in user to the welcome screen, with a comment saying Milestone 1 would replace it.
 * It did not — so a tester mid-registration was greeted with "Join the beta", and a submitted
 * tester never saw their own status. `resolveDestination` is that missing piece, kept as a
 * pure function so §8.2's rules are testable without a navigator.
 *
 * Analytics per §S00: app_opened, session_restore_succeeded, session_restore_failed.
 */
export function LaunchScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { isRestoring, session, status } = useAuth();

  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const hideSplash = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => {
      // Already hidden on a retry; nothing useful to do.
    });
  }, []);

  useEffect(() => {
    analytics.track('app_opened');
  }, []);

  /**
   * The bounded timeout. It covers restoration *and* the two lookups below, because from the
   * user's point of view they are one wait — a session that restores instantly followed by a
   * query that hangs is still a phone showing a splash screen forever.
   */
  useEffect(() => {
    if (timedOut) return;

    const timer = setTimeout(() => {
      analytics.track('session_restore_failed', { screen: 'S00', outcomeCode: 'TIMEOUT' });
      setTimedOut(true);
      hideSplash();
    }, SESSION_RESTORE_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [attempt, hideSplash, timedOut]);

  useEffect(() => {
    if (isRestoring || timedOut) return;

    /**
     * Only route from the launch screen when the launch screen is what the user is looking at.
     *
     * This component stays mounted as the stack's anchor, so its `replace` fires even when a
     * deep link has already opened another route — and wins, because it runs after the link is
     * applied. Opening `kyascene://verify-email` therefore launched the app and appeared to do
     * nothing: the screen was reached and immediately replaced.
     *
     * §4.5 puts universal links on `kyascene.app` for beta, so this would have broken every
     * one of them the moment they were switched on, in a way that looks like the link is
     * wrong rather than the app.
     */
    if (pathname !== '/') return;

    let cancelled = false;

    void (async () => {
      try {
        if (session === null) {
          if (cancelled) return;
          analytics.track('session_restore_succeeded', { screen: 'S00' });
          hideSplash();
          router.replace(WELCOME_ROUTE);
          return;
        }

        /**
         * Both facts are needed before anywhere can be chosen: status alone cannot distinguish
         * "needs to redeem an invitation" from "mid-registration", and the draft says which
         * step. Fetched together rather than in sequence — this is the wait the user is
         * watching a splash screen for.
         */
        const [hasRedeemedInvite, draft] = await Promise.all([
          registrationRepository.hasRedeemedInvite(session.userId),
          draftRepository.load(session.userId),
        ]);

        if (cancelled) return;

        analytics.track('session_restore_succeeded', { screen: 'S00' });
        hideSplash();
        router.replace(resolveDestination({ status, hasRedeemedInvite, draft }));
      } catch (error) {
        if (cancelled) return;
        analytics.track('session_restore_failed', {
          screen: 'S00',
          outcomeCode: (error as { code?: string }).code ?? 'UNKNOWN',
        });
        setTimedOut(true);
        hideSplash();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt, hideSplash, isRestoring, pathname, router, session, status, timedOut]);

  return (
    <AppScreen backgroundColor={colors.sceneEmerald} testID="launch-screen">
      <View style={styles.centre}>
        <KyaSceneWordmark testID="launch-wordmark" />

        {!timedOut ? (
          <ActivityIndicator
            color={colors.sceneSaffron}
            style={styles.spinner}
            accessibilityLabel="Starting KyaScene"
          />
        ) : (
          <View style={styles.retry}>
            <Text style={[typography.body, styles.message]} testID="launch-timeout-message">
              We couldn&apos;t start KyaScene. Check your connection and try again.
            </Text>
            <PrimaryButton
              label="Try again"
              testID="launch-retry"
              onPress={() => {
                setTimedOut(false);
                setAttempt((value) => value + 1);
              }}
            />
          </View>
        )}
      </View>

      <PoweredBy1818 />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  spinner: { marginTop: spacing.lg },
  retry: { alignSelf: 'stretch', gap: spacing.lg, alignItems: 'center' },
  // This screen forces the brand dark surface regardless of system scheme, so it reads the
  // dark palette directly rather than through useTheme().
  message: { color: semanticColors.dark.textSecondary, textAlign: 'center' },
});
