import {
  LANGUAGE_PROFICIENCIES,
  LANGUAGE_PROFICIENCY_LABELS,
  languagesSchema,
  type LanguageChoice,
  type LanguageProficiency,
} from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  OfflineBanner,
  PrimaryButton,
  SelectField,
  StepProgress,
  TextButton,
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
 * S09 — Languages.
 *
 * §S09: "Multiple languages and proficiency… English may be selected like any other language."
 *
 * English is genuinely not special-cased: it sits in the catalogue in sort order and carries
 * no assumed proficiency. Assuming fluency from nationality is precisely the inference §2.3
 * and §7.6 warn against, and it would be trivial to bake in here without noticing.
 *
 * §S09's acceptance is that "duplicate language entries are prevented". The picker only
 * offers languages not already added, so a duplicate is unreachable rather than rejected —
 * with the schema and the primary key behind it for anything that does not come through this
 * screen.
 */
export function LanguagesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, saveStep, isLoading } = useDraft();

  const catalogue = useQuery({
    queryKey: ['languages'],
    queryFn: () => profileRepository.listLanguages(),
  });

  const [choices, setChoices] = useState<LanguageChoice[]>([]);
  const [pendingCode, setPendingCode] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S09' });
  }, []);

  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && draft !== null) {
    setHydrated(true);
    if (draft.languages) setChoices(draft.languages);
  }

  const chosen = new Set(choices.map((choice) => choice.code));
  const available = (catalogue.data ?? [])
    .filter((entry) => !chosen.has(entry.code))
    .map((entry) => ({ code: entry.code, name: entry.label }));

  const labelFor = (code: string) =>
    catalogue.data?.find((entry) => entry.code === code)?.label ?? code;

  const add = (code: string) => {
    // Defaulting to 'conversational' rather than 'native' or 'fluent': the middle of the scale
    // is the least presumptuous starting point, and it is one tap from either end.
    setChoices((current) => [...current, { code, proficiency: 'conversational' }]);
    setPendingCode(undefined);
    setError(undefined);
  };

  const setProficiency = (code: string, proficiency: LanguageProficiency) => {
    setChoices((current) =>
      current.map((choice) => (choice.code === code ? { ...choice, proficiency } : choice)),
    );
  };

  const remove = (code: string) => {
    setChoices((current) => current.filter((choice) => choice.code !== code));
  };

  const onContinue = async () => {
    const parsed = languagesSchema.safeParse(choices);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Add at least one language');
      return;
    }

    setError(undefined);
    await saveStep('languages', { languages: parsed.data });
    analytics.track('onboarding_step_completed', { screen: 'S09' });
    router.push('/communities');
  };

  return (
    <AppScreen scrollable testID="languages-screen">
      <View style={styles.body}>
        <StepProgress current={5} total={10} />

        <AppHeader
          eyebrow="Step 5 of 10"
          title="What languages do you speak?"
          subtitle="Add as many as you like, with how comfortable you are in each."
          onBack={() => router.back()}
        />

        {catalogue.isError ? (
          <OfflineBanner message="We couldn't load the language list. Check your connection." />
        ) : null}

        <SelectField
          label="Add a language"
          value={pendingCode}
          options={available}
          onChange={add}
          searchable
          searchPlaceholder="Search languages"
          error={error}
          testID="languages-add"
        />

        <View style={styles.list}>
          {choices.map((choice) => (
            <View
              key={choice.code}
              style={[styles.entry, { borderColor: theme.border }]}
              testID={`languages-entry-${choice.code}`}
            >
              <View style={styles.entryHeader}>
                <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                  {labelFor(choice.code)}
                </Text>
                <TextButton
                  label="Remove"
                  onPress={() => remove(choice.code)}
                  accessibilityLabel={`Remove ${labelFor(choice.code)}`}
                  testID={`languages-remove-${choice.code}`}
                />
              </View>

              <View
                style={styles.proficiency}
                accessibilityRole="radiogroup"
                accessibilityLabel={`How well do you speak ${labelFor(choice.code)}?`}
              >
                {LANGUAGE_PROFICIENCIES.map((level) => {
                  const selected = choice.proficiency === level;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => setProficiency(choice.code, level)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, checked: selected }}
                      accessibilityLabel={`${LANGUAGE_PROFICIENCY_LABELS[level]} ${labelFor(choice.code)}`}
                      testID={`languages-${choice.code}-${level}`}
                      style={({ pressed }) => [
                        styles.level,
                        {
                          backgroundColor: selected ? theme.accent : theme.backgroundElevated,
                          borderColor: selected ? theme.accent : theme.border,
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { color: selected ? theme.onAccent : theme.textPrimary },
                        ]}
                      >
                        {LANGUAGE_PROFICIENCY_LABELS[level]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {choices.length === 0 ? (
          <Text style={[typography.caption, { color: theme.textSecondary }]}>
            English counts. So does the language you speak at home.
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Continue"
          onPress={() => void onContinue()}
          loading={isLoading}
          disabled={choices.length === 0}
          testID="languages-continue"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  list: { gap: spacing.md },
  entry: {
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 18,
    padding: 16,
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proficiency: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  level: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
  },
  pressed: { opacity: 0.75 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
