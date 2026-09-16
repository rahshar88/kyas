import { AppScreen, PrimaryButton, spacing, typography, useTheme } from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { WELCOME_ROUTE } from '@/navigation/route-groups';

/**
 * Catches an unknown deep link. §S00's "never trap the user" principle applies here too —
 * a bad universal link must always offer a way back into the app.
 */
export default function NotFoundScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <AppScreen testID="not-found-screen">
      <View style={styles.centre}>
        <Text style={[typography.heading, styles.centred, { color: theme.textPrimary }]}>
          This link didn&apos;t lead anywhere.
        </Text>
        <Text style={[typography.body, styles.centred, { color: theme.textSecondary }]}>
          The page may have moved, or the invitation may have expired.
        </Text>
        <PrimaryButton
          label="Go to KyaScene"
          testID="not-found-home"
          onPress={() => router.replace(WELCOME_ROUTE)}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  centred: { textAlign: 'center' },
});
