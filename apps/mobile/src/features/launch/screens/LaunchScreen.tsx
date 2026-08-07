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
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { analytics } from '@/services/analytics';
import { WELCOME_ROUTE, resolveRouteGroup } from '@/navigation/route-groups';

import { SESSION_RESTORE_TIMEOUT_MS, restoreSession } from '../services/session';

type LaunchState = 'restoring' | 'timed-out';

/**
 * S00 — Launch and session restoration.
 *
 * The requirement that shapes this screen: "After a bounded timeout, show retry and
 * offline guidance. Never trap the user on a permanent splash screen." So the timeout and
 * the retry affordance are built now, in Milestone 0, while `restoreSession()` is still a
 * stub — the failure path is the part that is easy to forget once the happy path works.
 *
 * Analytics per §S00: app_opened, session_restore_succeeded, session_restore_failed.
 */
export function LaunchScreen() {
  const router = useRouter();
  const [state, setState] = useState<LaunchState>('restoring');
  const [attempt, setAttempt] = useState(0);

  const finish = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => {
      // Splash may already be hidden on a retry; nothing useful to do.
    });
  }, []);

  useEffect(() => {
    analytics.track('app_opened');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (cancelled) return;
      analytics.track('session_restore_failed', { screen: 'S00', outcomeCode: 'TIMEOUT' });
      setState('timed-out');
      finish();
    }, SESSION_RESTORE_TIMEOUT_MS);

    void restoreSession()
      .then((session) => {
        if (cancelled) return;
        clearTimeout(timeout);
        analytics.track('session_restore_succeeded', { screen: 'S00' });
        finish();

        if (session === null) {
          router.replace(WELCOME_ROUTE);
          return;
        }

        // Milestone 1 replaces this with a push into the resolved group's entry route.
        // Until those groups have screens, an existing session still starts at welcome.
        resolveRouteGroup(session.status);
        router.replace(WELCOME_ROUTE);
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timeout);
        analytics.track('session_restore_failed', { screen: 'S00', outcomeCode: 'UNKNOWN' });
        setState('timed-out');
        finish();
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [attempt, finish, router]);

  return (
    <AppScreen backgroundColor={colors.sceneEmerald} testID="launch-screen">
      <View style={styles.centre}>
        <KyaSceneWordmark testID="launch-wordmark" />

        {state === 'restoring' ? (
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
                setState('restoring');
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
