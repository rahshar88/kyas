import {
  PROVIDER_NOT_LISTED,
  STUDY_LEVELS,
  STUDY_LEVEL_LABELS,
  studyDetailsSchema,
  type StudyLevel,
} from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  ChoiceCard,
  OfflineBanner,
  PrimaryButton,
  SelectField,
  StepProgress,
  TextField,
  spacing,
  typography,
  useTheme,
  type SelectOption,
} from '@kyascene/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDraft } from '@/features/registration/hooks/useDraft';
import { registrationRepository } from '@/repositories/registration-repository';
import { analytics } from '@/services/analytics';

type Errors = Partial<Record<string, string>>;

const MONTHS: SelectOption[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((name, index) => ({ code: String(index + 1), name }));

/**
 * Years offered for intake and completion.
 *
 * §S06 allows a future intake — a student with an offer has not started yet — so the range
 * runs from a few years back to several years ahead rather than ending at today.
 */
function yearOptions(): SelectOption[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, index) => {
    const year = current - 3 + index;
    return { code: String(year), name: String(year) };
  });
}

/**
 * S06 — Study details.
 *
 * §S06 acceptance: "Draft saves after valid field changes and survives app restart."
 *
 * The provider list comes from the server catalogue, with §S06's required "Not listed"
 * option appended client-side — it is a sentinel, never a row, because the column has a
 * foreign key onto `education_providers`.
 */
export function StudyDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, saveStep, isLoading } = useDraft();

  const providers = useQuery({
    queryKey: ['education-providers'],
    queryFn: () => registrationRepository.listEducationProviders(),
  });

  const [provider, setProvider] = useState<string | undefined>();
  const [providerOther, setProviderOther] = useState('');
  const [campus, setCampus] = useState('');
  const [course, setCourse] = useState('');
  const [studyLevel, setStudyLevel] = useState<StudyLevel | undefined>();
  const [intakeMonth, setIntakeMonth] = useState<string | undefined>();
  const [intakeYear, setIntakeYear] = useState<string | undefined>();
  const [completionMonth, setCompletionMonth] = useState<string | undefined>();
  const [completionYear, setCompletionYear] = useState<string | undefined>();
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S06' });
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
    const saved = draft.study;
    if (saved) {
      setProvider(saved.provider);
      setProviderOther(saved.providerOther ?? '');
      setCampus(saved.campus ?? '');
      setCourse(saved.course);
      setStudyLevel(saved.studyLevel);
      setIntakeMonth(String(saved.intakeMonth));
      setIntakeYear(String(saved.intakeYear));
      setCompletionMonth(String(saved.completionMonth));
      setCompletionYear(String(saved.completionYear));
    }
  }

  const providerOptions = useMemo<SelectOption[]>(
    () => [
      ...(providers.data ?? []).map((option) => ({ code: option.code, name: option.name })),
      // §S06: "Searchable provider list plus Not listed."
      { code: PROVIDER_NOT_LISTED, name: 'My provider is not listed' },
    ],
    [providers.data],
  );

  const onContinue = async () => {
    const candidate = {
      provider: provider ?? '',
      providerOther: providerOther.trim() === '' ? undefined : providerOther.trim(),
      campus: campus.trim() === '' ? undefined : campus.trim(),
      course,
      studyLevel,
      intakeMonth: Number(intakeMonth),
      intakeYear: Number(intakeYear),
      completionMonth: Number(completionMonth),
      completionYear: Number(completionYear),
    };

    const parsed = studyDetailsSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && next[key] === undefined) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    await saveStep('study', { study: parsed.data });
    analytics.track('onboarding_step_completed', { screen: 'S06' });
    router.push('/(registration)/sydney-location');
  };

  return (
    <AppScreen scrollable testID="study-screen">
      <View style={styles.body}>
        <StepProgress current={2} total={4} />

        <AppHeader
          eyebrow="Step 2 of 4"
          title="Where are you studying?"
          subtitle="This helps us connect you with people on your campus."
          onBack={() => router.back()}
        />

        {providers.isError ? (
          <OfflineBanner message="We couldn't load the provider list. Check your connection." />
        ) : null}

        <SelectField
          label="Education provider"
          value={provider}
          options={providerOptions}
          onChange={setProvider}
          searchable
          searchPlaceholder="Search universities and colleges"
          error={errors.provider}
          testID="study-provider"
        />

        {provider === PROVIDER_NOT_LISTED ? (
          <TextField
            label="Provider name"
            value={providerOther}
            onChangeText={setProviderOther}
            placeholder="Who are you studying with?"
            autoCapitalize="words"
            maxLength={120}
            error={errors.providerOther}
            testID="study-provider-other"
          />
        ) : null}

        <TextField
          label="Campus (optional)"
          value={campus}
          onChangeText={setCampus}
          placeholder="Which campus?"
          autoCapitalize="words"
          maxLength={80}
          testID="study-campus"
        />

        <TextField
          label="Course"
          value={course}
          onChangeText={setCourse}
          placeholder="e.g. Master of Information Technology"
          autoCapitalize="words"
          maxLength={120}
          error={errors.course}
          testID="study-course"
        />

        <View style={styles.group}>
          <Text style={[typography.label, { color: theme.textSecondary }]}>Study level</Text>
          <View style={styles.levels}>
            {STUDY_LEVELS.map((level) => (
              <ChoiceCard
                key={level}
                label={STUDY_LEVEL_LABELS[level]}
                selected={studyLevel === level}
                onPress={() => setStudyLevel(level)}
                testID={`study-level-${level}`}
              />
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <SelectField
              label="Intake month"
              value={intakeMonth}
              options={MONTHS}
              onChange={setIntakeMonth}
              error={errors.intakeMonth}
              testID="study-intake-month"
            />
          </View>
          <View style={styles.half}>
            <SelectField
              label="Intake year"
              value={intakeYear}
              options={yearOptions()}
              onChange={setIntakeYear}
              error={errors.intakeYear}
              testID="study-intake-year"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <SelectField
              label="Finishing month"
              value={completionMonth}
              options={MONTHS}
              onChange={setCompletionMonth}
              error={errors.completionMonth}
              testID="study-completion-month"
            />
          </View>
          <View style={styles.half}>
            <SelectField
              label="Finishing year"
              value={completionYear}
              options={yearOptions()}
              onChange={setCompletionYear}
              error={errors.completionYear}
              testID="study-completion-year"
            />
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Continue"
          onPress={() => void onContinue()}
          loading={isLoading}
          testID="study-continue"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  group: { gap: spacing.sm },
  levels: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
