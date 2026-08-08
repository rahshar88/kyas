import { colors } from '@kyascene/ui';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Importing the env module here makes a misconfigured build fail at startup with the
// validation message rather than somewhere deep inside a feature (§5.3).
import '@/config/env';
import { AuthProvider } from '@/providers/AuthProvider';
import { QueryProvider } from '@/providers/QueryProvider';

// S00 hides the splash itself once session restoration settles or times out.
void SplashScreen.preventAutoHideAsync();

/**
 * Provider order matters: QueryProvider is outermost because AuthProvider's status lookup
 * goes through a repository that TanStack Query will eventually cache.
 */
export default function RootLayout() {
  return (
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
  );
}
