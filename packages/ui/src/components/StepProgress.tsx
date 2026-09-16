import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, spacing } from '../tokens/layout';

export interface StepProgressProps {
  current: number;
  total: number;
  testID?: string;
}

/**
 * Registration progress (§7.4, §S05).
 *
 * A single accessible element rather than N announced bars: a screen reader reading out
 * "filled, filled, empty, empty" is noise, whereas "Step 3 of 4" is the information. §7.5's
 * ban on colour-only status is why the label exists at all — the bars alone convey nothing
 * to someone who cannot see them.
 */
export function StepProgress({ current, total, testID }: StepProgressProps) {
  const theme = useTheme();
  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(current, 0), safeTotal);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${safeCurrent} of ${safeTotal}`}
      accessibilityValue={{ min: 0, max: safeTotal, now: safeCurrent }}
      testID={testID}
    >
      {Array.from({ length: safeTotal }, (_, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            { backgroundColor: index < safeCurrent ? theme.accent : theme.border },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  bar: { flex: 1, height: 4, borderRadius: radius.pill },
});
