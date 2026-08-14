import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

export interface ChipOption {
  value: string;
  label: string;
  /** Optional grouping heading, used by S11 to keep a fourteen-item list scannable. */
  group?: string | undefined;
}

export interface MultiSelectChipsProps {
  options: readonly ChipOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  /** §S11 requires the requirement to be "clear before continuing". */
  minimum?: number | undefined;
  maximum?: number | undefined;
  searchable?: boolean | undefined;
  searchPlaceholder?: string | undefined;
  /** Disables every unselected chip — S10 uses it for "prefer not to specify". */
  disabled?: boolean | undefined;
  label?: string | undefined;
  error?: string | undefined;
  testID?: string | undefined;
}

/**
 * Multi-select chips (§7.4), used by S10 communities and S11 interests.
 *
 * Three things this does that a plain list of toggles does not:
 *
 * 1. **States the requirement and the count continuously**, not on submit. §S11's acceptance
 *    is that "selection count and requirement are clear before continuing" — discovering the
 *    minimum only after tapping Continue is the failure that criterion describes.
 * 2. **Blocks the maximum at the point of tapping** rather than showing an error afterwards,
 *    so the limit reads as a property of the control instead of a punishment.
 * 3. **Never signals selection by colour alone** (§7.5): a chip carries a border, a filled
 *    background and `accessibilityState.selected` together.
 */
export function MultiSelectChips({
  options,
  selected,
  onChange,
  minimum,
  maximum,
  searchable = false,
  searchPlaceholder = 'Search',
  disabled = false,
  label,
  error,
  testID,
}: MultiSelectChipsProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const atMaximum = maximum !== undefined && selected.length >= maximum;

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((entry) => entry !== value));
      return;
    }
    if (atMaximum) return;
    onChange([...selected, value]);
  };

  /**
   * One line that answers "how many have I picked, and is that enough?" without the user
   * having to count chips. Phrased as remaining-to-go while short, and as a plain count once
   * satisfied, because "1 more to go" is actionable and "2 of 3" is arithmetic.
   */
  const requirement = (() => {
    if (minimum !== undefined && selected.length < minimum) {
      const remaining = minimum - selected.length;
      return `Choose ${remaining} more (at least ${minimum})`;
    }
    if (maximum !== undefined) return `${selected.length} of ${maximum} chosen`;
    return `${selected.length} chosen`;
  })();

  const requirementMet = minimum === undefined || selected.length >= minimum;

  return (
    <View style={styles.container} testID={testID}>
      {label === undefined ? null : (
        <Text style={[typography.label, { color: theme.textSecondary }]}>{label}</Text>
      )}

      {searchable ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={searchPlaceholder}
          editable={!disabled}
          style={[
            styles.search,
            typography.body,
            {
              color: theme.textPrimary,
              backgroundColor: theme.backgroundElevated,
              borderColor: theme.border,
            },
          ]}
          testID={testID === undefined ? undefined : `${testID}-search`}
        />
      ) : null}

      <Text
        style={[typography.caption, { color: requirementMet ? theme.textSecondary : theme.accent }]}
        // Announced as it changes, so a screen-reader user learns they have met the minimum
        // at the moment they do, rather than on reaching the disabled Continue button.
        accessibilityLiveRegion="polite"
        testID={testID === undefined ? undefined : `${testID}-requirement`}
      >
        {requirement}
      </Text>

      <View style={styles.chips}>
        {visible.map((option) => {
          const isSelected = selected.includes(option.value);
          const isBlocked = disabled || (!isSelected && atMaximum);

          return (
            <Pressable
              key={option.value}
              onPress={() => toggle(option.value)}
              disabled={isBlocked}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled: isBlocked }}
              accessibilityLabel={option.label}
              accessibilityHint={
                isBlocked && !disabled ? `Maximum of ${maximum ?? 0} already chosen` : undefined
              }
              testID={`${testID ?? 'chips'}-${option.value}`}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isSelected ? theme.accent : theme.backgroundElevated,
                  borderColor: isSelected ? theme.accent : theme.border,
                },
                isBlocked && styles.blocked,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  typography.body,
                  { color: isSelected ? theme.onAccent : theme.textPrimary },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {visible.length === 0 ? (
        <Text style={[typography.caption, { color: theme.textSecondary }]}>
          Nothing matches “{query.trim()}”.
        </Text>
      ) : null}

      {error === undefined ? null : (
        <Text style={[typography.caption, { color: theme.dangerText }]} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  search: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
  },
  blocked: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});
