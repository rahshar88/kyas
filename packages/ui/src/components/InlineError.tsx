import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

/**
 * A field-level error (§7.4, §7.5).
 *
 * `accessibilityLiveRegion="polite"` and `accessibilityRole="alert"` are what satisfy §7.5's
 * "form errors announced and associated with their fields" — without them a screen-reader
 * user simply never learns the field was rejected.
 *
 * The leading marker means the error is not communicated by colour alone, which §7.5 forbids.
 */
export function InlineError({ message, testID }: { message: string; testID?: string }) {
  const theme = useTheme();

  return (
    <View
      style={styles.row}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <Text style={[typography.caption, { color: theme.dangerText }]}>!</Text>
      <Text style={[typography.caption, styles.message, { color: theme.dangerText }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  message: { flex: 1 },
});
