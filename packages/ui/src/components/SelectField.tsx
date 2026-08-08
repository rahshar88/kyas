import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';
import { InlineError } from './InlineError';
import { SecondaryButton } from './SecondaryButton';

export interface SelectOption {
  code: string;
  name: string;
}

export interface SelectFieldProps {
  label: string;
  value: string | undefined;
  options: SelectOption[];
  onChange: (code: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | undefined;
  /** §S06 needs a searchable provider list; §S08's 36 states are fine without one. */
  searchable?: boolean;
  searchPlaceholder?: string;
  testID?: string;
}

/**
 * A single-choice picker (§7.4 SelectField and SearchField, combined).
 *
 * A full-screen modal rather than a dropdown: on a phone, §S06's provider list and §S08's 36
 * states are long enough that an inline list either scrolls the form away or gets a cramped
 * popover. A sheet also gives the search box somewhere sensible to live.
 *
 * `SearchField` in §7.4's inventory is this component with `searchable`, rather than a
 * separate control — one keyboard-and-focus behaviour to get right instead of two.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose one',
  hint,
  error,
  searchable = false,
  searchPlaceholder = 'Search',
  testID,
}: SelectFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.code === value);
  const hasError = Boolean(error);

  const visible = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!searchable || trimmed === '') return options;
    return options.filter((option) => option.name.toLowerCase().includes(trimmed));
  }, [options, query, searchable]);

  return (
    <View style={styles.group}>
      <Text style={[typography.label, { color: theme.textSecondary }]}>{label}</Text>

      {hint === undefined ? null : (
        <Text style={[typography.caption, { color: theme.textSecondary }]}>{hint}</Text>
      )}

      <Pressable
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          hasError
            ? `${label}. ${selected?.name ?? placeholder}. ${error}`
            : `${label}. ${selected?.name ?? placeholder}`
        }
        accessibilityHint="Opens a list of options"
        testID={testID}
        style={({ pressed }) => [
          styles.control,
          {
            backgroundColor: theme.backgroundElevated,
            borderColor: hasError ? theme.dangerText : theme.border,
            borderWidth: hasError ? 2 : StyleSheet.hairlineWidth * 2,
          },
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            typography.body,
            { color: selected ? theme.textPrimary : theme.textSecondary },
            styles.controlText,
          ]}
          numberOfLines={1}
        >
          {selected?.name ?? placeholder}
        </Text>
      </Pressable>

      {hasError ? <InlineError message={error ?? ''} /> : null}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <Text
            accessibilityRole="header"
            style={[typography.heading, { color: theme.textPrimary }]}
          >
            {label}
          </Text>

          {searchable ? (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={`Search ${label}`}
              testID={testID === undefined ? undefined : `${testID}-search`}
              style={[
                typography.body,
                styles.search,
                {
                  color: theme.textPrimary,
                  backgroundColor: theme.backgroundElevated,
                  borderColor: theme.border,
                },
              ]}
            />
          ) : null}

          <FlatList
            data={visible}
            keyExtractor={(option) => option.code}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[typography.body, styles.empty, { color: theme.textSecondary }]}>
                Nothing matched “{query}”.
              </Text>
            }
            renderItem={({ item }) => {
              const isSelected = item.code === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.code);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected, checked: isSelected }}
                  testID={`${testID ?? label}-option-${item.code}`}
                  style={({ pressed }) => [
                    styles.option,
                    { borderBottomColor: theme.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      isSelected ? typography.bodyStrong : typography.body,
                      { color: isSelected ? theme.accent : theme.textPrimary },
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
          />

          <SecondaryButton label="Close" onPress={() => setOpen(false)} testID="select-close" />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  control: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  controlText: { flexShrink: 1 },
  pressed: { opacity: 0.75 },
  sheet: {
    flex: 1,
    padding: layout.screenPaddingHorizontal,
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  search: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
  },
  option: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: { paddingVertical: spacing.xl, textAlign: 'center' },
});
