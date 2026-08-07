import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { layout, spacing } from '../tokens/layout';

export interface AppScreenProps {
  children: ReactNode;
  /**
   * Scrollable content. §7.5 requires keyboard-safe forms and no clipped content under
   * Dynamic Type, so any screen with more than a few lines should scroll.
   */
  scrollable?: boolean;
  /** Which safe-area edges to inset. §7.3 requires bottom navigation be safe-area aware. */
  edges?: readonly Edge[];
  /** Overrides the themed background — used by the launch screen, which is always brand dark. */
  backgroundColor?: string;
  contentContainerStyle?: ViewStyle;
  testID?: string;
}

/**
 * The standard screen container: safe-area insets, brand background and the §7.3
 * horizontal padding of 20. Every P0 screen sits inside one of these.
 */
export function AppScreen({
  children,
  scrollable = false,
  edges = ['top', 'bottom', 'left', 'right'],
  backgroundColor,
  contentContainerStyle,
  testID,
}: AppScreenProps) {
  const theme = useTheme();
  const background = backgroundColor ?? theme.background;

  const content = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      // Respects the OS "reduce motion" setting indirectly by avoiding bounce-driven motion.
      alwaysBounceVertical={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: background }]}
      edges={edges}
      testID={testID}
    >
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingVertical: spacing.xl,
  },
});
