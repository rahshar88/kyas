import { REGISTRATION_STEP_COUNT, communitiesSchema, stepNumber } from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  MultiSelectChips,
  OfflineBanner,
  PrimaryButton,
  StepProgress,
  ToggleRow,
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
 * S10 — Cultural communities.
 *
 * §S10: "Optional, multi-select and never inferred from state, language or religion."
 *
 * That last clause shapes the whole screen. Nothing here reads the answers from S08 or S09 —
 * a Punjabi speaker from Punjab is not pre-selected as Punjabi, because identity is claimed,
 * not derived. There is no religion option and §13.2 forbids one in P0.
 *
 * §S10's acceptance is that "prefer not to specify clears other selections". Turning it on
 * empties the selection here, the repository writes the flag last, and a database trigger
 * pair enforces the same rule for anything that never touches this screen. Three layers for
 * one small rule, because the failure — a profile that says both "I decline to say" and
 * "Punjabi, Goan" — is a contradiction about someone's identity.
 */
export function CommunitiesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, saveStep, isLoading } = useDraft();

  const catalogue = useQuery({
    queryKey: ['communities'],
    queryFn: () => profileRepository.listCommunities(),
  });

  const [codes, setCodes] = useState<string[]>([]);
  const [notSpecified, setNotSpecified] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S10' });
  }, []);

  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && draft !== null) {
    setHydrated(true);
    if (draft.communities) {
      setCodes(draft.communities.codes);
      setNotSpecified(draft.communities.notSpecified);
    }
  }

  const onNotSpecifiedChange = (next: boolean) => {
    setNotSpecified(next);
    // Clears immediately rather than at save time, so the screen never shows the
    // contradiction the acceptance criterion exists to prevent.
    if (next) setCodes([]);
    setError(undefined);
  };

  const onSelectionChange = (next: string[]) => {
    setCodes(next);
    // The inverse direction: choosing a community means you have not declined to answer.
    if (next.length > 0) setNotSpecified(false);
    setError(undefined);
  };

  const onContinue = async () => {
    const parsed = communitiesSchema.safeParse({ codes, notSpecified });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your selection');
      return;
    }

    setError(undefined);
    await saveStep('communities', { communities: parsed.data });
    analytics.track('onboarding_step_completed', { screen: 'S10' });
    router.push('/interests');
  };

  return (
    <AppScreen scrollable testID="communities-screen">
      <View style={styles.body}>
        <StepProgress current={stepNumber('communities')} total={REGISTRATION_STEP_COUNT} />

        <AppHeader
          eyebrow="Step 6 of 10"
          title="Which communities do you belong to?"
          subtitle="Pick as many as feel right, or none at all. This is yours to define."
          onBack={() => router.back()}
        />

        {catalogue.isError ? (
          <OfflineBanner message="We couldn't load the list. Check your connection." />
        ) : null}

        <MultiSelectChips
          options={(catalogue.data ?? []).map((entry) => ({
            value: entry.code,
            label: entry.label,
          }))}
          selected={codes}
          onChange={onSelectionChange}
          searchable
          searchPlaceholder="Search communities"
          disabled={notSpecified}
          error={error}
          testID="communities-chips"
        />

        <ToggleRow
          label="Prefer not to specify"
          description="Turning this on clears anything selected above."
          value={notSpecified}
          onValueChange={onNotSpecifiedChange}
          testID="communities-not-specified"
        />

        <Text style={[typography.caption, { color: theme.textSecondary }]}>
          This is never guessed from your state, your language or anything else. You can change it
          later.
        </Text>
      </View>

      <View style={styles.actions}>
        {/* §S10 makes this optional, so Continue is never blocked — including when nothing is
            selected and "prefer not to specify" is off, which simply means "not yet". */}
        <PrimaryButton
          label="Continue"
          onPress={() => void onContinue()}
          loading={isLoading}
          testID="communities-continue"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
