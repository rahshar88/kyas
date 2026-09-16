import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

export interface ToggleRowProps {
  label: string;
  description?: string | undefined;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean | undefined;
  testID?: string | undefined;
}

/**
 * A labelled switch (§S08, §S14).
 *
 * Not one of §7.4's 26 named components, but S14 needs six of these on one screen and S08
 * already had two written inline. Six hand-built rows is six chances for the label and the
 * `accessibilityLabel` to drift apart, at which point a screen-reader user is toggling
 * something other than what they were told.
 *
 * The whole row is the accessible element rather than the switch alone, so the announcement
 * carries the label and the description together.
 */
export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  testID,
}: ToggleRowProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.row,
        { borderColor: theme.border, backgroundColor: theme.backgroundElevated },
        disabled && styles.disabled,
      ]}
      testID={testID}
    >
      <View style={styles.text}>
        <Text style={[typography.body, { color: theme.textPrimary }]}>{label}</Text>
        {description === undefined ? null : (
          <Text style={[typography.caption, { color: theme.textSecondary }]}>{description}</Text>
        )}
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={description === undefined ? label : `${label}. ${description}`}
        accessibilityState={{ checked: value, disabled }}
        testID={testID === undefined ? undefined : `${testID}-switch`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTouchTarget,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    padding: layout.cardPadding,
  },
  text: { flex: 1, gap: 2 },
  disabled: { opacity: 0.5 },
});
