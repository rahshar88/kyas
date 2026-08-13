import {
  CONSENT_LABELS,
  CURRENT_POLICY_VERSION,
  OPTIONAL_CONSENTS,
  REQUIRED_CONSENTS,
  hasAllRequiredConsents,
  type ConsentChoice,
  type ConsentPolicyType,
} from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  ConsentCheckbox,
  PrimaryButton,
  StepProgress,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { useDraft } from '@/features/registration/hooks/useDraft';
import { env } from '@/config/env';
import { analytics } from '@/services/analytics';

/**
 * S15 — Terms, privacy and beta consent.
 *
 * §S15: "Required and optional consent must never be bundled."
 *
 * There is no "accept all" control on this screen, and adding one would be the single easiest
 * way to break that rule. Each policy is its own checkbox over its own state; marketing is
 * rendered from a separate list so it cannot be swept into a loop over the required ones by
 * a future edit that looks harmless.
 *
 * §S15 also requires the version to be recorded. Every choice is stamped with
 * `CURRENT_POLICY_VERSION`, and the server checks consent at that same version before
 * accepting a submission — a script keeps the app, the Edge Function and the SQL agreeing on
 * what "current" means.
 */
const POLICY_LINKS: Partial<Record<ConsentPolicyType, { label: string; url: string }>> = {
  terms: { label: 'Read the Terms of Use', url: env.EXPO_PUBLIC_TERMS_URL },
  privacy: { label: 'Read the Privacy Policy', url: env.EXPO_PUBLIC_PRIVACY_URL },
};

export function ConsentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, saveStep, isLoading } = useDraft();

  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S15' });
  }, []);

  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && draft !== null) {
    setHydrated(true);
    if (draft.consents) {
      setAccepted(
        Object.fromEntries(
          draft.consents
            .filter((choice) => choice.version === CURRENT_POLICY_VERSION)
            .map((choice) => [choice.policyType, choice.accepted]),
        ),
      );
    }
  }

  const choices: ConsentChoice[] = [...REQUIRED_CONSENTS, ...OPTIONAL_CONSENTS].map(
    (policyType) => ({
      policyType,
      version: CURRENT_POLICY_VERSION,
      accepted: accepted[policyType] === true,
    }),
  );

  const canContinue = hasAllRequiredConsents(choices);

  const onContinue = async () => {
    if (!canContinue) return;

    await saveStep('consent', { consents: choices });
    analytics.track('onboarding_step_completed', { screen: 'S15' });
    router.push('/review');
  };

  return (
    <AppScreen scrollable testID="consent-screen">
      <View style={styles.body}>
        <StepProgress current={10} total={10} />

        <AppHeader
          eyebrow="Step 10 of 10"
          title="Before you join"
          subtitle="Four things to agree to, and one that is entirely up to you."
          onBack={() => router.back()}
        />

        <View style={styles.group}>
          {REQUIRED_CONSENTS.map((policyType) => {
            const link = POLICY_LINKS[policyType];
            return (
              <ConsentCheckbox
                key={policyType}
                label={CONSENT_LABELS[policyType]}
                checked={accepted[policyType] === true}
                onChange={(next) => setAccepted((current) => ({ ...current, [policyType]: next }))}
                required
                linkLabel={link?.label}
                onPressLink={link === undefined ? undefined : () => void Linking.openURL(link.url)}
                testID={`consent-${policyType}`}
              />
            );
          })}
        </View>

        {/* Rendered from its own list, and visually separated, so "optional" is a fact about
            the screen rather than a word buried in a row that looks like the others. */}
        <View style={styles.group}>
          <Text style={[typography.label, { color: theme.textSecondary }]}>Up to you</Text>

          {OPTIONAL_CONSENTS.map((policyType) => (
            <ConsentCheckbox
              key={policyType}
              label={CONSENT_LABELS[policyType]}
              checked={accepted[policyType] === true}
              onChange={(next) => setAccepted((current) => ({ ...current, [policyType]: next }))}
              testID={`consent-${policyType}`}
            />
          ))}

          <Text style={[typography.caption, { color: theme.textSecondary }]}>
            Saying no here does not affect your application.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Continue"
          onPress={() => void onContinue()}
          loading={isLoading}
          disabled={!canContinue}
          testID="consent-continue"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  group: { gap: spacing.sm },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
