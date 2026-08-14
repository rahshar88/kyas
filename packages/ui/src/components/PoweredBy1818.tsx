import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { typography } from '../tokens/typography';

export interface PoweredBy1818Props {
  /**
   * A quiet identity line under the attribution — in practice, which JavaScript bundle this
   * phone is running. Optional and vendor-free on purpose: this package knows nothing about
   * expo-updates; the app decides what the string is and whether there is one at all
   * (production passes nothing).
   *
   * It lives here, of all places, because this footer is on every screen — including the ones
   * a stuck tester is actually looking at. Two multi-day debugging rounds in this project came
   * down to "which bundle is this phone on?", and the answer was buried where someone locked
   * out at sign-in could never reach it.
   */
  detail?: string | undefined;
  testID?: string;
}

/**
 * Brand attribution. §2.2: "Powered by 1818, always secondary to KyaScene" — hence
 * `caption` type and the secondary text role, never the accent colour.
 */
export function PoweredBy1818({ detail, testID }: PoweredBy1818Props) {
  const theme = useTheme();
  return (
    <View style={styles.container} testID={testID}>
      <Text
        style={[typography.caption, styles.text, { color: theme.textSecondary }]}
        accessibilityRole="text"
      >
        Powered by 1818
      </Text>
      {detail === undefined ? null : (
        <Text
          style={[styles.detail, { color: theme.textSecondary }]}
          testID={testID === undefined ? undefined : `${testID}-detail`}
        >
          {detail}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  text: { textAlign: 'center', letterSpacing: 0.6 },
  // Smaller than caption and slightly faded: present when needed, invisible when not.
  detail: { textAlign: 'center', fontSize: 10, lineHeight: 13, opacity: 0.65 },
});
