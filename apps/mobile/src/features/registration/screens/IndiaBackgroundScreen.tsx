import { indiaBackgroundSchema } from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  OfflineBanner,
  PrimaryButton,
  SelectField,
  StepProgress,
  TextField,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { useDraft } from '@/features/registration/hooks/useDraft';
import { registrationRepository } from '@/repositories/registration-repository';
import { analytics } from '@/services/analytics';

/**
 * S08 — India background.
 *
 * §S08: "Represent origin accurately without stereotyping."
 *
 * Two decisions carry that. State comes from a maintained list rather than free text, so
 * §2.3's "India is plural" is respected rather than flattened into one box. And hometown is
 * genuinely optional — §S08 acceptance requires that "a user may decline the city field
 * without blocking registration", so nothing here gates on it.
 *
 * Nothing on this screen infers anything. §S10 forbids deriving cultural community from
 * state, and no code here does; the community question arrives separately in Milestone 2.
 */
export function IndiaBackgroundScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, saveStep, isLoading } = useDraft();

  const states = useQuery({
    queryKey: ['india-states'],
    queryFn: () => registrationRepository.listIndiaStates(),
  });

  const [stateCode, setStateCode] = useState<string | undefined>();
  const [hometown, setHometown] = useState('');
  const [stateVisible, setStateVisible] = useState(false);
  const [hometownVisible, setHometownVisible] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S08' });
  }, []);

  /**
   * Hydrate once from the resumed draft.
   *
   * Adjusting state during render behind a guard is React's documented pattern for "derive
   * state when an input changes" — an effect here would set state synchronously on mount and
   * trigger a cascading render, which the compiler correctly rejects.
   */
  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && draft !== null) {
    setHydrated(true);
    const saved = draft.indiaBackground;
    if (saved) {
      setStateCode(saved.stateCode);
      setHometown(saved.hometown ?? '');
      setStateVisible(saved.stateVisible);
      setHometownVisible(saved.hometownVisible);
    }
  }

  const onContinue = async () => {
    const parsed = indiaBackgroundSchema.safeParse({
      stateCode,
      hometown: hometown.trim() === '' ? undefined : hometown.trim(),
      stateVisible,
      hometownVisible,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Choose your state or union territory');
      return;
    }

    setError(undefined);
    await saveStep('india-background', { indiaBackground: parsed.data });
    analytics.track('onboarding_step_completed', { screen: 'S08' });
    // Milestone 2 continues to languages (S09). Until then this is the end of the flow.
    router.replace('/');
  };

  return (
    <AppScreen scrollable testID="background-screen">
      <View style={styles.body}>
        <StepProgress current={4} total={4} />

        <AppHeader
          eyebrow="Step 4 of 4"
          title="Where in India are you from?"
          subtitle="India is plural. Tell us your part of it."
          onBack={() => router.back()}
        />

        {states.isError ? (
          <OfflineBanner message="We couldn't load the list of states. Check your connection." />
        ) : null}

        <SelectField
          label="State or union territory"
          value={stateCode}
          options={states.data ?? []}
          onChange={setStateCode}
          searchable
          searchPlaceholder="Search states"
          error={error}
          testID="background-state"
        />

        <TextField
          label="Hometown (optional)"
          hint="Skip this if you would rather not say."
          value={hometown}
          onChangeText={setHometown}
          placeholder="e.g. Kochi"
          autoCapitalize="words"
          maxLength={80}
          testID="background-hometown"
        />

        {/* §S08: "Both fields have independent profile-visibility controls." */}
        <View style={styles.visibility}>
          <Text style={[typography.label, { color: theme.textSecondary }]}>Who can see this</Text>

          <View style={[styles.toggle, { borderColor: theme.border }]}>
            <Text style={[typography.body, styles.toggleText, { color: theme.textPrimary }]}>
              Show my state to other students
            </Text>
            <Switch
              value={stateVisible}
              onValueChange={setStateVisible}
              accessibilityLabel="Show my state to other students"
              testID="background-state-visible"
            />
          </View>

          <View style={[styles.toggle, { borderColor: theme.border }]}>
            <Text style={[typography.body, styles.toggleText, { color: theme.textPrimary }]}>
              Show my hometown to other students
            </Text>
            <Switch
              value={hometownVisible}
              onValueChange={setHometownVisible}
              accessibilityLabel="Show my hometown to other students"
              testID="background-hometown-visible"
            />
          </View>

          <Text style={[typography.caption, { color: theme.textSecondary }]}>
            Both are off unless you turn them on, and you can change them later.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Save and finish"
          onPress={() => void onContinue()}
          loading={isLoading}
          testID="background-continue"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  visibility: { gap: spacing.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 18,
    padding: 16,
  },
  toggleText: { flex: 1 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
