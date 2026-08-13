import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

export interface ConsentCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Renders the "Required" marker. §S15 needs required and optional visibly distinct. */
  required?: boolean | undefined;
  /** An inline link to the policy being consented to, when there is one to read. */
  linkLabel?: string | undefined;
  onPressLink?: (() => void) | undefined;
  testID?: string | undefined;
}

/**
 * A single consent (§S15).
 *
 * §S15: "Required and optional consent must never be bundled." That rule is usually broken by
 * a single "I agree to everything" checkbox, so this component only ever represents **one**
 * policy — there is no `checkAll` and no group variant, deliberately. A screen wanting four
 * consents renders four of these, and the user can decline any of them.
 *
 * Required and optional are distinguished by a visible word, not by position or styling
 * alone, so the difference survives a screen reader and a colour-blind reader both.
 */
export function ConsentCheckbox({
  label,
  checked,
  onChange,
  required = false,
  linkLabel,
  onPressLink,
  testID,
}: ConsentCheckboxProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={required ? `${label}. Required.` : `${label}. Optional.`}
        testID={testID}
        style={({ pressed }) => [
          styles.row,
          { borderColor: checked ? theme.accent : theme.border },
          pressed && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.box,
            { borderColor: checked ? theme.accent : theme.border },
            checked && { backgroundColor: theme.accent },
          ]}
        >
          {checked ? (
            <Text style={[styles.tick, { color: theme.onAccent }]} accessible={false}>
              ✓
            </Text>
          ) : null}
        </View>

        <View style={styles.text}>
          <Text style={[typography.body, { color: theme.textPrimary }]}>{label}</Text>
          <Text style={[typography.caption, { color: theme.textSecondary }]}>
            {required ? 'Required' : 'Optional'}
          </Text>
        </View>
      </Pressable>

      {linkLabel === undefined || onPressLink === undefined ? null : (
        <Pressable
          onPress={onPressLink}
          accessibilityRole="link"
          accessibilityLabel={linkLabel}
          testID={testID === undefined ? undefined : `${testID}-link`}
          style={styles.link}
        >
          <Text style={[typography.caption, { color: theme.accent }]}>{linkLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: layout.minTouchTarget,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    padding: layout.cardPadding,
  },
  pressed: { opacity: 0.75 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  text: { flex: 1, gap: 2 },
  link: { minHeight: layout.minTouchTarget, justifyContent: 'center', paddingLeft: spacing.xxl },
});
