import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

/**
 * Shown when a save could not reach the server (§7.4, §16.2).
 *
 * §16.2 requires an end-to-end test that "offline save failure preserves local answers", and
 * §7.6 asks for calm error language — hence the reassurance rather than an apology. The
 * default copy is taken almost verbatim from §7.6's own example.
 */
export function OfflineBanner({
  message = "We couldn't save this yet. Your answers are still on this phone.",
  testID,
}: {
  message?: string;
  testID?: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={[styles.banner, { backgroundColor: theme.cautionFill }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <Text style={[typography.caption, { color: theme.onCautionFill }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
