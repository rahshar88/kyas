import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { typography } from '../tokens/typography';

export interface StudentAvatarProps {
  displayName: string | null;
  uri?: string | undefined;
  size?: number;
  testID?: string;
}

/**
 * A person, as a circle (§7.4).
 *
 * §S13 keeps the photograph optional, so the no-photo case is the normal one, not a fallback.
 * It shows an initial rather than a generic silhouette: an initial says "this is Asha", a
 * silhouette says "something is missing", and most people here will have chosen not to add a
 * photo rather than failed to.
 *
 * `Intl.Segmenter` rather than `name[0]`. A JavaScript string index returns a UTF-16 code
 * unit, which splits an emoji in half and — more to the point for KyaScene — takes only the
 * first half of a Devanagari or Gurmukhi grapheme cluster, rendering something that is not a
 * letter in that script. A community app for students from India cannot get initials wrong.
 */
function initialOf(displayName: string | null): string {
  const trimmed = displayName?.trim() ?? '';
  if (trimmed === '') return '?';

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const [first] = segmenter.segment(trimmed);

  return (first?.segment ?? trimmed.slice(0, 1)).toLocaleUpperCase();
}

export function StudentAvatar({ displayName, uri, size = 48, testID }: StudentAvatarProps) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };

  // Announced as one thing either way. Two nodes saying "Asha" and "Asha's photo" is noise.
  const label = displayName === null ? 'Your profile' : `${displayName}'s profile picture`;

  if (uri !== undefined) {
    return (
      <Image
        source={{ uri }}
        style={[shape, { borderColor: theme.border }, styles.image]}
        accessibilityLabel={label}
        testID={testID}
      />
    );
  }

  return (
    <View
      style={[shape, styles.fallback, { backgroundColor: theme.accent }]}
      accessibilityLabel={label}
      testID={testID}
    >
      <Text
        style={[typography.title, { color: theme.onAccent, fontSize: size * 0.4 }]}
        // The initial is decoration once the container is labelled; reading it separately
        // would announce "A" after "Asha's profile picture".
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {initialOf(displayName)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { borderWidth: StyleSheet.hairlineWidth * 2 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
