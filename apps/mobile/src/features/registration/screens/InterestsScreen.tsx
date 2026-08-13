import {
  MINIMUM_INTERESTS,
  REGISTRATION_STEP_COUNT,
  interestsSchema,
  stepNumber,
} from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  MultiSelectChips,
  OfflineBanner,
  PrimaryButton,
  StepProgress,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDraft } from '@/features/registration/hooks/useDraft';
import { profileRepository } from '@/repositories/profile-repository';
import { analytics } from '@/services/analytics';

/**
 * S11 — Interests.
 *
 * §S11: "Require at least three for the beta" and, as the acceptance criterion, "selection
 * count and requirement are clear before continuing".
 *
 * The requirement is stated continuously by the chips component rather than revealed by a
 * failed Continue — discovering a minimum only after tapping is exactly the failure that
 * criterion describes. Continue stays disabled until it is met, so the two never disagree.
 */
export function InterestsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, saveStep, isLoading } = useDraft();

  const catalogue = useQuery({
    queryKey: ['interests'],
    queryFn: () => profileRepository.listInterests(),
  });

  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S11' });
  }, []);

  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && draft !== null) {
    setHydrated(true);
    if (draft.interests) setCodes(draft.interests);
  }

  const onContinue = async () => {
    const parsed = interestsSchema.safeParse(codes);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? `Choose at least ${MINIMUM_INTERESTS}`);
      return;
    }

    setError(undefined);
    await saveStep('interests', { interests: parsed.data });
    analytics.track('onboarding_step_completed', { screen: 'S11' });
    router.push('/goals');
  };

  return (
    <AppScreen scrollable testID="interests-screen">
      <View style={styles.body}>
        <StepProgress current={stepNumber('interests')} total={REGISTRATION_STEP_COUNT} />

        <AppHeader
          eyebrow="Step 7 of 10"
          title="What are you into?"
          subtitle={`Choose at least ${MINIMUM_INTERESTS}. This is how we find you people worth meeting.`}
          onBack={() => router.back()}
        />

        {catalogue.isError ? (
          <OfflineBanner message="We couldn't load the list. Check your connection." />
        ) : null}

        <MultiSelectChips
          options={(catalogue.data ?? []).map((entry) => ({
            value: entry.code,
            label: entry.label,
            group: entry.category,
          }))}
          selected={codes}
          onChange={(next) => {
            setCodes(next);
            setError(undefined);
          }}
          minimum={MINIMUM_INTERESTS}
          searchable
          searchPlaceholder="Search interests"
          error={error}
          testID="interests-chips"
        />

        <Text style={[typography.caption, { color: theme.textSecondary }]}>
          Pick what you would actually turn up for, not what sounds good.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Continue"
          onPress={() => void onContinue()}
          loading={isLoading}
          disabled={codes.length < MINIMUM_INTERESTS}
          testID="interests-continue"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
