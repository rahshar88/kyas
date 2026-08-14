import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

export interface KyaSceneWordmarkProps {
  size?: 'small' | 'large';
  testID?: string;
}

/**
 * The KyaScene wordmark.
 *
 * §7.2 is explicit that "the KyaScene wordmark is an asset, not a substitute font".
 * The real asset does not exist yet, so this renders type-set text as a stand-in and
 * carries a single `accessibilityRole="header"` with the brand name as its label — which
 * is what the final asset-backed version will expose too, so screen-reader behaviour will
 * not change when the artwork lands. Replacing this with `<Image>` in Milestone 4 is a
 * one-component edit; nothing else in the app references the letterforms.
 */
export function KyaSceneWordmark({ size = 'large', testID }: KyaSceneWordmarkProps) {
  const theme = useTheme();
  const style = size === 'large' ? typography.display : typography.heading;

  return (
    <View
      accessibilityRole="header"
      accessible
      accessibilityLabel="KyaScene"
      testID={testID}
      style={styles.row}
    >
      <Text style={[style, { color: theme.textPrimary }, styles.tight]} accessibilityElementsHidden>
        Kya
      </Text>
      {/**
       * `accent`, not `accentText`, and deliberately: this is the logotype. WCAG 1.4.3 exempts
       * brand marks from the contrast floor, and the Saffron half of the wordmark is the brand.
       * Every other accent-coloured *text* in the app moved to `accentText`, which is why this
       * one needs a reason written beside it.
       */}
      <Text style={[style, { color: theme.accent }, styles.tight]} accessibilityElementsHidden>
        Scene
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs / 2 },
  tight: { letterSpacing: -0.5 },
});
