import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

export interface EmptyStateProps {
  title: string;
  /** What to do about it. Omit only when there is genuinely nothing to do. */
  body?: string;
  testID?: string;
}

/**
 * Nothing here yet (§7.4).
 *
 * §6.6 requires every screen to have a designed empty state, and §7.6 asks for "calm,
 * specific" language. The failure this prevents is a blank area that reads as a bug: a beta
 * home with no announcements and no explanation looks identical to a beta home that failed to
 * load them, and a tester cannot tell which.
 *
 * `accessibilityRole="summary"` rather than alert. Nothing has gone wrong, so it must not
 * interrupt what a screen reader is already saying.
 */
export function EmptyState({ title, body, testID }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={body === undefined ? title : `${title}. ${body}`}
      testID={testID}
    >
      <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{title}</Text>
      {body === undefined ? null : (
        <Text style={[typography.caption, { color: theme.textSecondary }]}>{body}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: layout.cardPadding,
  },
});
