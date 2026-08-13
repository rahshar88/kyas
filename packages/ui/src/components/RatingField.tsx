import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

export interface RatingFieldProps {
  label: string;
  value: number | undefined;
  onChange: (next: number) => void;
  testID?: string;
}

/** §S20's rating. Five points, each with words, because a bare number means nothing. */
const POINTS = [
  { value: 1, word: 'Poor' },
  { value: 2, word: 'Fair' },
  { value: 3, word: 'Okay' },
  { value: 4, word: 'Good' },
  { value: 5, word: 'Great' },
] as const;

/**
 * A one-to-five rating (§S20).
 *
 * Numbers with labels rather than stars. A star is an icon a screen reader has to be told
 * about, and "three stars" is a shape rather than a judgement — whereas "3, Okay" is what the
 * person meant. It also sidesteps the half-star question entirely.
 *
 * Each point is its own control with `accessibilityRole="radio"` and its own state, so
 * VoiceOver announces "Okay, radio button, selected, 3 of 5" instead of treating the row as
 * one unlabelled widget. §7.5 requires the minimum touch target, and five side-by-side
 * controls is precisely where that gets quietly broken, so each one is `minTouchTarget` square.
 *
 * The rating is optional in §S20 — someone reporting a bug should not have to score it — so
 * there is no default selection, and `value` stays undefined until a choice is made.
 */
export function RatingField({ label, value, onChange, testID }: RatingFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[typography.label, { color: theme.textSecondary }]}>{label}</Text>

      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {POINTS.map((point) => {
          const selected = value === point.value;

          return (
            <Pressable
              key={point.value}
              onPress={() => onChange(point.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={`${point.value}, ${point.word}`}
              testID={`${testID ?? 'rating'}-${point.value}`}
              style={({ pressed }) => [
                styles.point,
                {
                  backgroundColor: selected ? theme.accent : theme.backgroundElevated,
                  borderColor: selected ? theme.accent : theme.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  typography.bodyStrong,
                  { color: selected ? theme.onAccent : theme.textPrimary },
                ]}
              >
                {point.value}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: selected ? theme.onAccent : theme.textSecondary },
                ]}
              >
                {point.word}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  point: {
    flex: 1,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.75 },
});
