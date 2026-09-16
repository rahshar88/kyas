import {
  ARRIVAL_STATUSES,
  ARRIVAL_STATUS_LABELS,
  REGISTRATION_STEP_COUNT,
  stepNumber,
  sydneyLocationSchema,
  type ArrivalStatus,
} from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  ChoiceCard,
  PrimaryButton,
  StepProgress,
  TextField,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { useDraft } from '@/features/registration/hooks/useDraft';
import { analytics } from '@/services/analytics';

/**
 * S07 — Sydney location.
 *
 * §S07: "Enable suburb-level relevance without exact tracking" and, explicitly, "Do not
 * request device location in P0. Do not collect street address or coordinates."
 *
 * So there is no `expo-location` import here and no permission prompt anywhere in the app.
 * The absence is the feature — a reviewer checking §13.2 should find nothing to remove.
 */
export function SydneyLocationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, saveStep, isLoading } = useDraft();

  const [suburb, setSuburb] = useState('');
  const [postcode, setPostcode] = useState('');
  const [arrivalStatus, setArrivalStatus] = useState<ArrivalStatus | undefined>();
  const [suburbVisible, setSuburbVisible] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S07' });
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
    const saved = draft.sydneyLocation;
    if (saved) {
      setSuburb(saved.suburb);
      setPostcode(saved.postcode ?? '');
      setArrivalStatus(saved.arrivalStatus);
      setSuburbVisible(saved.suburbVisible);
    }
  }

  const onContinue = async () => {
    const parsed = sydneyLocationSchema.safeParse({
      suburb,
      postcode: postcode.trim() === '' ? undefined : postcode.trim(),
      arrivalStatus,
      suburbVisible,
    });

    if (!parsed.success) {
      const next: Partial<Record<string, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && next[key] === undefined) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    await saveStep('sydney-location', { sydneyLocation: parsed.data });
    analytics.track('onboarding_step_completed', { screen: 'S07' });
    router.push('/(registration)/india-background');
  };

  return (
    <AppScreen scrollable testID="location-screen">
      <View style={styles.body}>
        <StepProgress current={stepNumber('sydney-location')} total={REGISTRATION_STEP_COUNT} />

        <AppHeader
          eyebrow="Step 3 of 4"
          title="Whereabouts in Sydney?"
          subtitle="Suburb only. We never ask for your address or track your location."
          onBack={() => router.back()}
        />

        <View style={styles.group}>
          <Text style={[typography.label, { color: theme.textSecondary }]}>
            Are you in Sydney yet?
          </Text>
          {ARRIVAL_STATUSES.map((status) => (
            <ChoiceCard
              key={status}
              label={ARRIVAL_STATUS_LABELS[status]}
              selected={arrivalStatus === status}
              onPress={() => setArrivalStatus(status)}
              testID={`location-arrival-${status}`}
            />
          ))}
          {errors.arrivalStatus === undefined ? null : (
            <Text style={[typography.caption, { color: theme.dangerText }]}>
              Choose one so we know where you are up to
            </Text>
          )}
        </View>

        <TextField
          label={arrivalStatus === 'in_sydney' ? 'Your suburb' : 'Suburb you expect to live in'}
          hint={
            // §S07 acceptance: someone arriving later can still answer.
            arrivalStatus === 'in_sydney'
              ? undefined
              : "A rough idea is fine — you can change it once you've arrived."
          }
          value={suburb}
          onChangeText={setSuburb}
          placeholder="e.g. Ultimo"
          autoCapitalize="words"
          maxLength={80}
          error={errors.suburb}
          testID="location-suburb"
        />

        <TextField
          label="Postcode (optional)"
          value={postcode}
          onChangeText={(next) => setPostcode(next.replace(/[^0-9]/g, '').slice(0, 4))}
          placeholder="2007"
          keyboardType="number-pad"
          maxLength={4}
          error={errors.postcode}
          testID="location-postcode"
        />

        {/* §S07: "Public suburb visibility defaults off." */}
        <View style={[styles.toggle, { borderColor: theme.border }]}>
          <View style={styles.toggleText}>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
              Show my suburb to other students
            </Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              Off by default. Your exact address is never shown, to anyone, ever.
            </Text>
          </View>
          <Switch
            value={suburbVisible}
            onValueChange={setSuburbVisible}
            accessibilityLabel="Show my suburb to other students"
            testID="location-suburb-visible"
          />
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Continue"
          onPress={() => void onContinue()}
          loading={isLoading}
          testID="location-continue"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  group: { gap: spacing.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 18,
    padding: 16,
  },
  toggleText: { flex: 1, gap: 2 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
