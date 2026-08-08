import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';
import { TextButton } from './TextButton';

export interface AppHeaderProps {
  title: string;
  /** Sits above the title. Used for the step counter on registration screens. */
  eyebrow?: string | undefined;
  subtitle?: string | undefined;
  onBack?: () => void;
  testID?: string;
}

/**
 * The heading block on every registration screen (§7.4).
 *
 * The title carries `accessibilityRole="header"` so screen-reader users can jump straight to
 * it, which §7.5's "logical focus order" depends on in practice.
 */
export function AppHeader({ title, eyebrow, subtitle, onBack, testID }: AppHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.block} testID={testID}>
      {onBack === undefined ? null : (
        <View style={styles.backRow}>
          <TextButton label="Back" onPress={onBack} testID="header-back" />
        </View>
      )}

      {eyebrow === undefined ? null : (
        <Text style={[typography.caption, styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text>
      )}

      <Text accessibilityRole="header" style={[typography.title, { color: theme.textPrimary }]}>
        {title}
      </Text>

      {subtitle === undefined ? null : (
        <Text style={[typography.body, { color: theme.textSecondary }]}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  backRow: { alignSelf: 'flex-start', marginLeft: -spacing.sm },
  eyebrow: { letterSpacing: 1, textTransform: 'uppercase' },
});
