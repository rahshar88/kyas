import {
  isEligible,
  ineligibilityReason,
  type EligibilityAnswers,
  type IneligibilityReason,
} from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  ChoiceCard,
  PrimaryButton,
  SecondaryButton,
  StepProgress,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDraft } from '@/features/registration/hooks/useDraft';
import { analytics } from '@/services/analytics';

/** The four questions from §S05, in the spec's own order. */
const QUESTIONS: { key: keyof EligibilityAnswers; label: string; description: string }[] = [
  {
    key: 'isEighteenOrOlder',
    label: "I'm 18 or older",
    description: 'The beta is for adults only.',
  },
  {
    key: 'isFromIndia',
    label: "I'm from India",
    description: 'KyaScene is made for students from India.',
  },
  {
    key: 'isStudyingOrOffered',
    label: "I'm studying in Australia, or I have an offer",
    description: 'A confirmed upcoming course counts.',
  },
  {
    key: 'hasSydneyConnection',
    label: "I'm in Sydney, or heading there",
    description: 'Sydney is our first city. More are coming.',
  },
];

/** §S05: "Ineligible users receive a respectful explanation." */
const REFUSAL_COPY: Record<IneligibilityReason, string> = {
  under_18:
    'KyaScene is for students aged 18 and over right now. We would love to see you when you turn 18.',
  not_from_india:
    'KyaScene is built specifically for students from India. That focus is the whole point of it, so we are keeping it that way for now.',
  not_studying:
    'KyaScene is for students studying in Australia, or holding a confirmed offer. Come back when your offer arrives.',
  not_sydney:
    'Sydney is our first city. We are opening more as we grow — tell us where you are and we will let you know.',
};

/**
 * S05 — Eligibility.
 *
 * §S05 acceptance: "No user can bypass eligibility through direct navigation." The check is
 * `isEligible` from the domain package, a pure function over the answers, so the same rule
 * can guard the route as well as this screen. §S05 also says "Store only the answers needed
 * to record the decision" — hence four booleans and nothing else.
 */
export function EligibilityScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, saveStep, isLoading } = useDraft();

  const [answers, setAnswers] = useState<EligibilityAnswers>({
    isEighteenOrOlder: false,
    isFromIndia: false,
    isStudyingOrOffered: false,
    hasSydneyConnection: false,
  });
  const [refused, setRefused] = useState<IneligibilityReason | null>(null);

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S05' });
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
    if (draft.eligibility) setAnswers(draft.eligibility);
  }

  const toggle = (key: keyof EligibilityAnswers) => {
    setAnswers((current) => ({ ...current, [key]: !current[key] }));
    setRefused(null);
  };

  const onContinue = async () => {
    if (!isEligible(answers)) {
      const reason = ineligibilityReason(answers);
      setRefused(reason);
      analytics.track('eligibility_failed', {
        screen: 'S05',
        outcomeCode: reason ?? 'unknown',
      });
      return;
    }

    await saveStep('eligibility', { eligibility: answers });
    analytics.track('eligibility_completed', { screen: 'S05' });
    router.push('/(registration)/study');
  };

  if (refused !== null) {
    return (
      <AppScreen scrollable testID="eligibility-refused">
        <View style={styles.body}>
          <AppHeader
            title="Not just yet"
            onBack={() => setRefused(null)}
            subtitle={REFUSAL_COPY[refused]}
          />
          <Text style={[typography.caption, { color: theme.textSecondary }]}>
            If you think we have this wrong, change your answers and try again.
          </Text>
        </View>

        <View style={styles.actions}>
          <SecondaryButton
            label="Change my answers"
            onPress={() => setRefused(null)}
            testID="eligibility-reconsider"
          />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scrollable testID="eligibility-screen">
      <View style={styles.body}>
        <StepProgress current={1} total={4} testID="eligibility-progress" />

        <AppHeader
          eyebrow="Step 1 of 4"
          title="First, the basics"
          subtitle="Tick everything that's true. All four are needed for the Sydney beta."
        />

        <View style={styles.questions}>
          {QUESTIONS.map((question) => (
            <ChoiceCard
              key={question.key}
              mode="checkbox"
              label={question.label}
              description={question.description}
              selected={answers[question.key]}
              onPress={() => toggle(question.key)}
              testID={`eligibility-${question.key}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Continue"
          onPress={() => void onContinue()}
          loading={isLoading}
          testID="eligibility-continue"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, flexGrow: 1 },
  questions: { gap: spacing.md },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
