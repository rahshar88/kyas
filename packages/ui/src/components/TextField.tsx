import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';
import { InlineError } from './InlineError';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /**
   * Shown beneath the label. Use for the "why we need this" note §S02 asks for.
   *
   * Explicitly `| undefined` because the workspace enables `exactOptionalPropertyTypes`, and
   * callers legitimately compute this conditionally.
   */
  hint?: string | undefined;
  error?: string | undefined;
  placeholder?: string | undefined;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  maxLength?: number;
  multiline?: boolean;
  editable?: boolean;
  onBlur?: () => void;
  testID?: string;
}

/**
 * The base text input.
 *
 * §7.5 requires that "form errors [are] announced and associated with their fields". React
 * Native has no `aria-describedby`, so association is achieved by putting the error text
 * inside the same accessible group as the input and folding it into the input's
 * accessibility label — which is what a screen reader will actually read out.
 */
export function TextField({
  label,
  value,
  onChangeText,
  hint,
  error,
  placeholder,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  maxLength,
  multiline = false,
  editable = true,
  onBlur,
  testID,
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={styles.group}>
      <Text style={[typography.label, { color: theme.textSecondary }]} nativeID={`${label}-label`}>
        {label}
      </Text>

      {hint === undefined ? null : (
        <Text style={[typography.caption, { color: theme.textSecondary }]}>{hint}</Text>
      )}

      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        textContentType={textContentType}
        maxLength={maxLength}
        multiline={multiline}
        editable={editable}
        testID={testID}
        accessibilityLabel={hasError ? `${label}. ${error}` : label}
        accessibilityState={{ disabled: !editable }}
        style={[
          typography.body,
          styles.input,
          {
            color: theme.textPrimary,
            backgroundColor: theme.backgroundElevated,
            // §7.5 forbids colour-only status, so the error state also thickens the border
            // and is always accompanied by the InlineError text below.
            borderColor: hasError ? theme.dangerText : focused ? theme.accent : theme.border,
            borderWidth: hasError || focused ? 2 : StyleSheet.hairlineWidth * 2,
          },
          multiline && styles.multiline,
          !editable && styles.disabled,
        ]}
      />

      {hasError ? <InlineError message={error ?? ''} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  input: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  multiline: { minHeight: layout.minTouchTarget * 2, textAlignVertical: 'top' },
  disabled: { opacity: 0.5 },
});
