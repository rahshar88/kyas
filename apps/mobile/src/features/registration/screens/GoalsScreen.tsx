import { MAXIMUM_GOALS, REGISTRATION_STEP_COUNT, goalsSchema, stepNumber } from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
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
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDraft } from '@/features/registration/hooks/useDraft';
import { profileRepository } from '@/repositories/profile-repository';
import { analytics } from '@/services/analytics';

/**
 * S12 — Goals.
 *
 * §S12: "Select up to five and rank the top need."
 *
 * Ranking is by tap order rather than by drag. Drag-to-reorder is the obvious design and the
 * wrong one here: it is the least accessible interaction in a flow that §7.5 requires to work
 * with a screen reader and at large text sizes, and the ranking it produces is not
 * self-evident to the person doing it. Tapping in order of importance is explicit — each
 * selected goal shows its position, and the top one is called out by name.
 *
 * The array index *is* the rank, all the way to the database, so what is shown and what is
 * stored cannot drift.
 *
 * §S12: "Record category identifiers, not free-text personal information." Only codes reach
 * analytics — there is no free-text goal, and no "Other" row to invite one.
 */
export function GoalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, saveStep, isLoading } = useDraft();

  const catalogue = useQuery({
    queryKey: ['goals'],
    queryFn: () => profileRepository.listGoals(),
  });

  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S12' });
  }, []);

  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && draft !== null) {
    setHydrated(true);
    if (draft.goals) setCodes(draft.goals);
  }

  const labelFor = (code: string) =>
    catalogue.data?.find((entry) => entry.code === code)?.label ?? code;

  const toggle = (code: string) => {
    setError(undefined);
    setCodes((current) => {
      if (current.includes(code)) return current.filter((entry) => entry !== code);
      if (current.length >= MAXIMUM_GOALS) return current;
      return [...current, code];
    });
  };

  const onContinue = async () => {
    const parsed = goalsSchema.safeParse(codes);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Choose at least one');
      return;
    }

    setError(undefined);
    await saveStep('goals', { goals: parsed.data });
    analytics.track('onboarding_step_completed', { screen: 'S12' });
    router.push('/photo');
  };

  const atMaximum = codes.length >= MAXIMUM_GOALS;

  return (
    <AppScreen scrollable testID="goals-screen">
      <View style={styles.body}>
        <StepProgress current={stepNumber('goals')} total={REGISTRATION_STEP_COUNT} />

        <AppHeader
          eyebrow="Step 8 of 10"
          title="What do you need first?"
          subtitle="Tap in order of importance. The first one you tap is your top need."
          onBack={() => router.back()}
        />

        {catalogue.isError ? (
          <OfflineBanner message="We couldn't load the list. Check your connection." />
        ) : null}

        <Text
          style={[typography.caption, { color: theme.textSecondary }]}
          accessibilityLiveRegion="polite"
          testID="goals-count"
        >
          {codes.length === 0
            ? `Choose up to ${MAXIMUM_GOALS}`
            : `${codes.length} of ${MAXIMUM_GOALS} chosen — your top need is ${labelFor(codes[0] ?? '')}`}
        </Text>

        <View style={styles.list}>
          {(catalogue.data ?? []).map((entry) => {
            const position = codes.indexOf(entry.code);
            const selected = position >= 0;
            const blocked = !selected && atMaximum;

            return (
              <Pressable
                key={entry.code}
                onPress={() => toggle(entry.code)}
                disabled={blocked}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: blocked }}
                accessibilityLabel={
                  selected
                    ? `${entry.label}, ranked ${position + 1} of ${codes.length}`
                    : entry.label
                }
                accessibilityHint={
                  blocked ? `Maximum of ${MAXIMUM_GOALS} already chosen` : undefined
                }
                testID={`goals-${entry.code}`}
                style={({ pressed }) => [
                  styles.goal,
                  {
                    backgroundColor: theme.backgroundElevated,
                    borderColor: selected ? theme.accent : theme.border,
                    borderWidth: selected ? 2 : StyleSheet.hairlineWidth * 2,
                  },
                  blocked && styles.blocked,
                  pressed && styles.pressed,
                ]}
              >
                {/* The rank is a number on screen, not just a colour or an order in a list —
                    §7.5 forbids conveying meaning by colour alone, and a rank is meaning. */}
                <View
                  style={[
                    styles.rank,
                    {
                      backgroundColor: selected ? theme.accent : 'transparent',
                      borderColor: selected ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.bodyStrong,
                      { color: selected ? theme.onAccent : theme.textSecondary },
                    ]}
                    accessible={false}
                  >
                    {selected ? String(position + 1) : ''}
                  </Text>
                </View>

                <Text style={[typography.body, styles.goalLabel, { color: theme.textPrimary }]}>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error === undefined ? null : (
          <Text style={[typography.caption, { color: theme.dangerText }]} accessibilityRole="alert">
            {error}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Continue"
          onPress={() => void onContinue()}
          loading={isLoading}
          disabled={codes.length === 0}
          testID="goals-continue"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  list: { gap: spacing.sm },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalLabel: { flex: 1 },
  blocked: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
