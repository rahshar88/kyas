import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

export interface SummaryItem {
  label: string;
  /** Rendered as "Not provided" when absent, so a gap is visible rather than silent. */
  value?: string | undefined;
}

export interface ProfileSummaryCardProps {
  title: string;
  items: readonly SummaryItem[];
  /** §S16: "grouped sections with Edit actions". */
  onEdit?: (() => void) | undefined;
  editLabel?: string | undefined;
  testID?: string | undefined;
}

/**
 * One grouped section of the S16 review (§7.4 `ProfileSummaryCard`).
 *
 * §S16's purpose is that a student can "inspect and correct all submitted information", which
 * puts two requirements on this card. Every field appears even when empty — a missing row
 * looks like a field that does not exist rather than one left blank — and the Edit action is
 * attached to the section rather than the screen, so correcting a suburb does not mean
 * walking the whole flow again.
 */
export function ProfileSummaryCard({
  title,
  items,
  onEdit,
  editLabel,
  testID,
}: ProfileSummaryCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
      ]}
      testID={testID}
    >
      <View style={styles.header}>
        <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{title}</Text>

        {onEdit === undefined ? null : (
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            // Names the section, so a screen reader does not announce six identical "Edit"
            // buttons with no way to tell which is which.
            accessibilityLabel={editLabel ?? `Edit ${title.toLowerCase()}`}
            testID={testID === undefined ? undefined : `${testID}-edit`}
            style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
          >
            <Text style={[typography.body, { color: theme.accent }]}>Edit</Text>
          </Pressable>
        )}
      </View>

      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          <Text style={[typography.caption, { color: theme.textSecondary }]}>{item.label}</Text>
          <Text
            style={[
              typography.body,
              { color: item.value === undefined ? theme.textSecondary : theme.textPrimary },
            ]}
          >
            {item.value ?? 'Not provided'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    padding: layout.cardPadding,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  edit: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  pressed: { opacity: 0.75 },
  item: { gap: 2 },
});
