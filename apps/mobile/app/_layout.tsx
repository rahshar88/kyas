import { colors } from '@kyascene/ui';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * The environment is read here rather than imported for its side effect (§5.3).
 *
 * `env.ts` validates at module scope and throws when a value is missing. On a build that is
 * exactly right — EAS fails at "Read app config" and names every missing key. On an
 * over-the-air update nothing reads the config first, so the same throw happened during this
 * file's imports, before anything rendered, and the app closed instantly: no message, nothing
 * to screenshot, nothing to report but "it opens and shuts".
 *
 * `env-status` catches it so the failure can be rendered instead.
 */
import { configurationError } from '@/config/env-status';
import { ConfigurationErrorScreen } from '@/features/launch/screens/ConfigurationErrorScreen';
import { LastCrashScreen } from '@/features/launch/screens/LastCrashScreen';
import { RootErrorBoundary } from '@/features/launch/screens/RootErrorBoundary';
import { AuthProvider } from '@/providers/AuthProvider';
import { clearLastFatal, readLastFatal, type StoredCrash } from '@/services/crash-log';
import { QueryProvider } from '@/providers/QueryProvider';
import { installGlobalErrorHandler } from '@/services/error-reporting';

// S00 hides the splash itself once session restoration settles or times out.
void SplashScreen.preventAutoHideAsync();

// Before the first render, so a crash during startup is still captured. Without this a fatal
// error closes the app leaving no record anywhere — the report a tester describes as
// "it just shut", and the one an external tester will never reproduce on request.
installGlobalErrorHandler();

/**
 * Provider order matters: QueryProvider is outermost because AuthProvider's status lookup
 * goes through a repository that TanStack Query will eventually cache.
 */
export default function RootLayout() {
  const [lastCrash, setLastCrash] = useState<StoredCrash | null>(null);

  useEffect(() => {
    // Read once, after mount, so a storage failure cannot stop the app from starting.
    void readLastFatal().then(setLastCrash);
  }, []);

  /**
   * Before the providers, because every one of them reads configuration this bundle does not
   * have. Rendering them first would replace a legible message with a second crash.
   */
  if (configurationError !== undefined) {
    void SplashScreen.hideAsync();
    return <ConfigurationErrorScreen message={configurationError} />;
  }

  /**
   * An error that killed a previous launch, shown once.
   *
   * A crash during module evaluation or the first render never reaches an error boundary —
   * the process is gone before one exists. The global handler writes it down instead, and
   * this is where it surfaces, so "it opens and shuts" becomes something readable.
   */
  if (lastCrash !== null) {
    void SplashScreen.hideAsync();
    return (
      <LastCrashScreen
        crash={lastCrash}
        onDismiss={() => {
          void clearLastFatal();
          setLastCrash(null);
        }}
      />
    );
  }

  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryProvider>
            <AuthProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.sceneEmerald },
                }}
              />
            </AuthProvider>
          </QueryProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </RootErrorBoundary>
  );
}
