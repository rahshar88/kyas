import { colors } from '@kyascene/ui';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Importing the env module here makes a misconfigured build fail at startup with the
// validation message rather than somewhere deep inside a feature (§5.3).
import '@/config/env';

// S00 hides the splash itself once session restoration settles or times out.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.sceneEmerald },
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
