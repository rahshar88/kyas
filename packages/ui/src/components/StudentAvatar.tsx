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
 * Not `name[0]`. A string index returns a UTF-16 code unit, which splits an emoji in half and
 * — more to the point for KyaScene — takes only the first half of a Devanagari or Gurmukhi
 * grapheme cluster, rendering something that is not a letter in that script. A community app
 * for students from India cannot get initials wrong.
 *
 * `Intl.Segmenter` is the correct tool and **is not implemented in Hermes**, which is the
 * engine this app actually runs on. The first version called it unconditionally, guarded only
 * by an early return for an empty name — so it was unreachable while every test account had a
 * null `display_name`, and the app worked. Setting one real name crashed it on launch, and a
 * rebuild could not fix it because the data had changed, not the code.
 *
 * Every unit test passed throughout: Node has `Intl.Segmenter`. The test below deletes it to
 * make the Jest environment tell the truth about the device.
 *
 * So: use it where it exists, and fall back to `Array.from`, which iterates by **code point**.
 * That still keeps an emoji or a surrogate pair whole, and for Indic scripts it yields the base
 * consonant without its matra — a correct initial, if not a complete cluster.
 */
function firstGrapheme(value: string): string {
  const segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;

  if (typeof segmenter === 'function') {
    const [first] = new segmenter(undefined, { granularity: 'grapheme' }).segment(value);
    if (first?.segment !== undefined) return first.segment;
  }

  return Array.from(value)[0] ?? value.slice(0, 1);
}

function initialOf(displayName: string | null): string {
  const trimmed = displayName?.trim() ?? '';
  if (trimmed === '') return '?';

  return firstGrapheme(trimmed).toLocaleUpperCase();
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
