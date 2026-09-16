import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

export type StatusTone = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
  testID?: string | undefined;
}

/**
 * Registration status (§S17, §7.4).
 *
 * §7.5 forbids communicating status by colour alone, so each tone carries a **symbol and a
 * word** as well as a fill. Read aloud, in monochrome, or by someone who cannot distinguish
 * the fills, the meaning survives — which matters most here, because this badge is how a
 * student learns whether they are in the beta.
 */
export function StatusBadge({ tone, label, testID }: StatusBadgeProps) {
  const theme = useTheme();

  const { background, foreground, symbol } = {
    pending: { background: theme.cautionFill, foreground: theme.onCautionFill, symbol: '•' },
    approved: { background: theme.positiveFill, foreground: theme.onPositiveFill, symbol: '✓' },
    rejected: { background: theme.dangerFill, foreground: theme.onDangerFill, symbol: '×' },
    suspended: { background: theme.dangerFill, foreground: theme.onDangerFill, symbol: '!' },
  }[tone];

  return (
    <View
      style={[styles.badge, { backgroundColor: background }]}
      accessibilityRole="text"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text style={[typography.bodyStrong, { color: foreground }]} accessible={false}>
        {symbol}
      </Text>
      <Text style={[typography.bodyStrong, { color: foreground }]} accessible={false}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
