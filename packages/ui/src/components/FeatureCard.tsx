import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';

export interface FeatureCardProps {
  title: string;
  description: string;
  /**
   * `available` — built and switched on, so it navigates.
   * `voting` — not built; the card asks whether you want it (§S18 feature voting).
   * `coming_soon` — not built and not up for a vote. Inert.
   */
  state: 'available' | 'voting' | 'coming_soon';
  /** Only meaningful in `voting`. Shows the vote already cast. */
  voted?: boolean;
  onPress?: () => void;
  testID?: string;
}

/**
 * A card on the beta home (§S18).
 *
 * §S18's acceptance criterion is one sentence and it is the whole reason this component
 * exists: **"No disabled feature looks tappable; enabled features are controlled by server
 * flags."**
 *
 * So a `coming_soon` card is not a `Pressable` with `disabled` set — it is a `View`. That
 * distinction is not cosmetic. A disabled Pressable still occupies the accessibility tree as
 * a button, so VoiceOver announces "Scene feed, button, dimmed" and someone navigating by
 * swipe is invited to activate something that will never respond. A View announces the text
 * and moves on, which is the truth: this is a notice, not a control.
 *
 * §1.2 is the reason the rule is strict — "do not implement future features shown in concept
 * artwork". The concept work shows a feed, discovery and events. Cards for those must read as
 * a promise, and a promise that can be tapped reads as a broken feature instead.
 */
export function FeatureCard({
  title,
  description,
  state,
  voted = false,
  onPress,
  testID,
}: FeatureCardProps) {
  const theme = useTheme();

  const body = (
    <>
      <View style={styles.header}>
        <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{title}</Text>

        {/**
         * §S18: future cards are "all clearly labelled Coming soon **unless enabled**" — so the
         * badge belongs on a voting card too, not only on an inert one. Being votable does not
         * make a feature available, and the first version of this screen said only "tap to
         * vote", which left each card silent about whether it existed.
         */}
        {state === 'available' ? null : (
          <View style={[styles.tag, { backgroundColor: theme.background }]}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Coming soon</Text>
          </View>
        )}

        {state === 'voting' && voted ? (
          <View style={[styles.tag, { backgroundColor: theme.positiveFill }]}>
            <Text style={[typography.caption, { color: theme.onPositiveFill }]}>Voted</Text>
          </View>
        ) : null}
      </View>

      <Text style={[typography.caption, { color: theme.textSecondary }]}>{description}</Text>

      {state === 'voting' ? (
        <Text style={[typography.caption, { color: theme.accentText }]}>
          {voted ? 'Tap to change your mind' : 'Want this next? Tap to vote'}
        </Text>
      ) : null}
    </>
  );

  const surface = {
    backgroundColor: theme.backgroundElevated,
    borderColor: theme.border,
  };

  /**
   * Not a disabled Pressable. See above — the difference is what a screen reader says, and
   * whether someone is invited to tap something that does nothing.
   */
  if (state === 'coming_soon') {
    return (
      <View
        style={[styles.card, surface, styles.inert]}
        accessibilityRole="summary"
        accessibilityLabel={`${title}. Coming soon. ${description}`}
        testID={testID}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        state === 'voting'
          ? `${title}. Coming soon. ${voted ? 'You voted for this' : 'Vote for this'}. ${description}`
          : `${title}. ${description}`
      }
      accessibilityState={{ selected: state === 'voting' ? voted : undefined }}
      testID={testID}
      style={({ pressed }) => [styles.card, surface, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: layout.cardPadding,
  },
  // Dimmed as well as inert, so it reads as unavailable to someone who cannot hear the role.
  inert: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tag: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
