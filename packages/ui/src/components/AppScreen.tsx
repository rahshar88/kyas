import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { layout, spacing } from '../tokens/layout';

export interface AppScreenProps {
  children: ReactNode;
  /**
   * Scrollable content. §7.5 requires keyboard-safe forms and no clipped content under
   * Dynamic Type, so any screen with more than a few lines should scroll.
   */
  scrollable?: boolean | undefined;
  /** Which safe-area edges to inset. §7.3 requires bottom navigation be safe-area aware. */
  edges?: readonly Edge[] | undefined;
  /** Overrides the themed background — used by the launch screen, which is always brand dark. */
  backgroundColor?: string | undefined;
  contentContainerStyle?: ViewStyle | undefined;
  /**
   * Pull-to-refresh. §S17 requires it, and it only has meaning on a scrollable screen — hence
   * a prop on the container rather than each screen assembling its own ScrollView, which is
   * how the safe-area insets and §7.3 padding get quietly lost.
   */
  refreshControl?: ScrollViewProps['refreshControl'];
  testID?: string | undefined;
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
  refreshControl,
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
      // Bouncing has to be allowed when a RefreshControl is present, or the pull gesture that
      // triggers it cannot happen.
      alwaysBounceVertical={refreshControl !== undefined}
      {...(refreshControl === undefined ? {} : { refreshControl })}
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
