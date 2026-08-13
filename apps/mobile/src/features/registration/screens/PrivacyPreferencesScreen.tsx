import {
  DEFAULT_VISIBILITY,
  REGISTRATION_STEP_COUNT,
  VISIBILITY_ASSURANCE,
  VISIBILITY_LABELS,
  stepNumber,
  visibilitySchema,
  type VisibilityPreferences,
} from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  PrimaryButton,
  StepProgress,
  ToggleRow,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDraft } from '@/features/registration/hooks/useDraft';
import { analytics } from '@/services/analytics';

/**
 * S14 — Privacy preferences.
 *
 * §S14: "Give explicit control over what future approved users may see", with conservative
 * defaults, and the acceptance criterion that "preview updates immediately".
 *
 * The preview is the point of this screen. A list of six switches tells you what you have
 * toggled; it does not tell you what a stranger will see, and those are different questions.
 * The preview answers the second one directly, and it is built from the same object the
 * switches write, so it cannot show something the settings do not say.
 *
 * Everything defaults to off. §S14 asks for conservative defaults, and this is the direction
 * the bug should fall: a student who never reaches this screen shares nothing.
 */
export function PrivacyPreferencesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, saveStep, isLoading } = useDraft();

  const [preferences, setPreferences] = useState<VisibilityPreferences>(DEFAULT_VISIBILITY);

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S14' });
  }, []);

  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && draft !== null) {
    setHydrated(true);
    if (draft.visibility) setPreferences(draft.visibility);
  }

  const set = (key: keyof VisibilityPreferences, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const shared = (Object.keys(VISIBILITY_LABELS) as (keyof VisibilityPreferences)[]).filter(
    (key) => preferences[key],
  );

  const onContinue = async () => {
    const parsed = visibilitySchema.safeParse(preferences);
    if (!parsed.success) return;

    await saveStep('privacy', { visibility: parsed.data });
    analytics.track('onboarding_step_completed', { screen: 'S14' });
    router.push('/consent');
  };

  return (
    <AppScreen scrollable testID="privacy-screen">
      <View style={styles.body}>
        <StepProgress current={stepNumber('privacy')} total={REGISTRATION_STEP_COUNT} />

        <AppHeader
          eyebrow="Step 9 of 10"
          title="What can others see?"
          subtitle="Everything is hidden unless you turn it on. You can change this any time."
          onBack={() => router.back()}
        />

        <View style={styles.toggles}>
          {(Object.keys(VISIBILITY_LABELS) as (keyof VisibilityPreferences)[]).map((key) => (
            <ToggleRow
              key={key}
              label={VISIBILITY_LABELS[key]}
              value={preferences[key]}
              onValueChange={(next) => set(key, next)}
              testID={`privacy-${key}`}
            />
          ))}
        </View>

        {/* §S14 acceptance: "Preview updates immediately." */}
        <View
          style={[
            styles.preview,
            { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
          ]}
          accessibilityLiveRegion="polite"
          testID="privacy-preview"
        >
          <Text style={[typography.label, { color: theme.textSecondary }]}>
            What another student would see
          </Text>

          {shared.length === 0 ? (
            <Text style={[typography.body, { color: theme.textPrimary }]}>
              Just your name. Nothing else.
            </Text>
          ) : (
            <Text style={[typography.body, { color: theme.textPrimary }]}>
              Your name, plus {shared.map((key) => VISIBILITY_LABELS[key].toLowerCase()).join(', ')}
              .
            </Text>
          )}
        </View>

        {/* §S14: "Exact address and exact location are never shown." Held as a constant so the
            wording cannot quietly weaken, and so a test can assert it is actually on screen. */}
        <Text
          style={[typography.caption, { color: theme.textSecondary }]}
          testID="privacy-assurance"
        >
          {VISIBILITY_ASSURANCE}
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Continue"
          onPress={() => void onContinue()}
          loading={isLoading}
          testID="privacy-continue"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  toggles: { gap: spacing.sm },
  preview: {
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 18,
    padding: 16,
  },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
