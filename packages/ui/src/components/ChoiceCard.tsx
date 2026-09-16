import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

export interface ChoiceCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** Radio semantics for one-of-many, checkbox for many-of-many. */
  mode?: 'radio' | 'checkbox';
  testID?: string;
}

/**
 * A large tappable option (§7.4), used for eligibility answers, study level and arrival
 * status.
 *
 * The role changes with `mode` because a screen reader announces "selected" differently for
 * a radio than a checkbox, and getting it wrong misleads about whether picking a second
 * option will replace the first.
 *
 * Selection is shown by a border, a filled marker AND the accessibility state — never by
 * colour alone (§7.5).
 */
export function ChoiceCard({
  label,
  description,
  selected,
  onPress,
  mode = 'radio',
  testID,
}: ChoiceCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={mode}
      accessibilityLabel={description === undefined ? label : `${label}. ${description}`}
      accessibilityState={{ selected, checked: selected }}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundElevated,
          borderColor: selected ? theme.accent : theme.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth * 2,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.marker,
          mode === 'radio' ? styles.markerRound : styles.markerSquare,
          { borderColor: selected ? theme.accent : theme.border },
          selected && { backgroundColor: theme.accent },
        ]}
      />

      <View style={styles.text}>
        <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{label}</Text>
        {description === undefined ? null : (
          <Text style={[typography.caption, { color: theme.textSecondary }]}>{description}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTouchTarget,
    borderRadius: radius.md,
    padding: layout.cardPadding,
  },
  pressed: { opacity: 0.75 },
  marker: { width: 22, height: 22, borderWidth: 2 },
  markerRound: { borderRadius: 11 },
  markerSquare: { borderRadius: 6 },
  text: { flex: 1, gap: 2 },
});
