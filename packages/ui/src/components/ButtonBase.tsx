import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

export interface ButtonBaseProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /**
   * Overrides the announced label. Use when the visible text is not self-describing out
   * of context — §7.5 requires screen-reader labels for non-text controls.
   */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

interface InternalProps extends ButtonBaseProps {
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  /** Text buttons have no fill and should not reserve a full-width block. */
  variant: 'filled' | 'outlined' | 'bare';
}

/**
 * Shared pressable behaviour for every KyaScene button.
 *
 * Three things every variant gets for free, because §7.4 requires loading/disabled/focus/
 * pressed states and §7.3 requires a 48×48 minimum target:
 *  - `minHeight: 48` and an expanded `hitSlop` on the bare variant
 *  - `accessibilityState` carrying both `disabled` and `busy`, so a screen reader
 *    announces a submitting button rather than a silent one
 *  - press is swallowed while loading, which is what makes S16's "repeated taps cannot
 *    create duplicate registration records" true at the UI layer as well as the server
 */
export function ButtonBase({
  label,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
  backgroundColor,
  textColor,
  borderColor,
  variant,
}: InternalProps) {
  const isInteractive = !disabled && !loading;

  return (
    <Pressable
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      {...(accessibilityHint === undefined ? {} : { accessibilityHint })}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      hitSlop={variant === 'bare' ? spacing.md : undefined}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variant === 'bare' ? styles.bare : styles.block,
        {
          backgroundColor,
          borderColor: borderColor ?? 'transparent',
          borderWidth: variant === 'outlined' ? StyleSheet.hairlineWidth * 2 : 0,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            color={textColor}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : (
          <Text style={[typography.bodyStrong, { color: textColor }]} numberOfLines={1}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  block: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
  },
  bare: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    alignSelf: 'center',
    minWidth: layout.minTouchTarget,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
});
