import { StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme';
import { typography } from '../tokens/typography';

/**
 * Brand attribution. §2.2: "Powered by 1818, always secondary to KyaScene" — hence
 * `caption` type and the secondary text role, never the accent colour.
 */
export function PoweredBy1818({ testID }: { testID?: string }) {
  const theme = useTheme();
  return (
    <Text
      style={[typography.caption, styles.text, { color: theme.textSecondary }]}
      testID={testID}
      accessibilityRole="text"
    >
      Powered by 1818
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { textAlign: 'center', letterSpacing: 0.6 },
});
