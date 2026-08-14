import {
  ARRIVAL_STATUS_LABELS,
  LANGUAGE_PROFICIENCY_LABELS,
  MISSING_STEP_ROUTES,
  STUDY_LEVEL_LABELS,
  VISIBILITY_LABELS,
  type MissingStep,
  type VisibilityPreferences,
} from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  InlineError,
  PrimaryButton,
  ProfileSummaryCard,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { useDraft } from '@/features/registration/hooks/useDraft';
import { profileRepository } from '@/repositories/profile-repository';
import { registrationRepository } from '@/repositories/registration-repository';
import { analytics } from '@/services/analytics';

/**
 * S16 — Review profile.
 *
 * §S16: "Let the user inspect and correct all submitted information", with server validation
 * run again and an idempotent submission.
 *
 * Two things this screen must get right, both of which are about failure rather than success:
 *
 * 1. **A repeated tap must not create a second registration.** The button disables while in
 *    flight, but that is only the cosmetic half — the real guarantee is a partial unique index
 *    in the database, because a disabled button does nothing about two phones or a retried
 *    request.
 * 2. **A server rejection must be actionable.** `submit_registration` returns the steps it
 *    found missing as codes, and those become navigation here. Telling someone "something is
 *    incomplete" on a review screen listing everything they entered is a dead end.
 */
export function ReviewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { draft } = useDraft();

  /**
   * The catalogues, so this screen can show what the student chose rather than the codes we
   * store it under. A review screen reading "north_east_indian" and "IN-PB" asks someone to
   * check answers they cannot read — and §S16's whole purpose is that they can inspect and
   * correct what is about to be submitted.
   *
   * Every one of these is already cached by the screen that collected it, so this costs
   * nothing on the ordinary path through the flow.
   */
  const catalogues = {
    languages: useQuery({
      queryKey: ['languages'],
      queryFn: () => profileRepository.listLanguages(),
    }),
    communities: useQuery({
      queryKey: ['communities'],
      queryFn: () => profileRepository.listCommunities(),
    }),
    interests: useQuery({
      queryKey: ['interests'],
      queryFn: () => profileRepository.listInterests(),
    }),
    goals: useQuery({ queryKey: ['goals'], queryFn: () => profileRepository.listGoals() }),
    states: useQuery({
      queryKey: ['india-states'],
      queryFn: () => registrationRepository.listIndiaStates(),
    }),
    providers: useQuery({
      queryKey: ['education-providers'],
      queryFn: () => registrationRepository.listEducationProviders(),
    }),
  };

  /** Falls back to the code, so a catalogue that has not loaded shows something rather than nothing. */
  const label = useMemo(() => {
    const index = new Map<string, string>();
    for (const entry of catalogues.languages.data ?? []) index.set(entry.code, entry.label);
    for (const entry of catalogues.communities.data ?? []) index.set(entry.code, entry.label);
    for (const entry of catalogues.interests.data ?? []) index.set(entry.code, entry.label);
    for (const entry of catalogues.goals.data ?? []) index.set(entry.code, entry.label);
    for (const entry of catalogues.states.data ?? []) index.set(entry.code, entry.name);
    for (const entry of catalogues.providers.data ?? []) index.set(entry.code, entry.name);
    return (code: string | undefined) =>
      code === undefined ? undefined : (index.get(code) ?? code);
  }, [
    catalogues.communities.data,
    catalogues.goals.data,
    catalogues.interests.data,
    catalogues.languages.data,
    catalogues.providers.data,
    catalogues.states.data,
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [missing, setMissing] = useState<MissingStep[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S16' });
  }, []);

  const userId = session?.userId;

  /**
   * Pushes the whole draft to the server, then submits.
   *
   * The draft is local-first (§16.2) so answers survive a bad connection, which means the
   * server has seen nothing until this point. Writing everything here — rather than on each
   * screen — keeps the flow usable on a train and makes submission the single place where a
   * network failure matters.
   */
  const onSubmit = async () => {
    if (!userId || draft === null || submitting) return;

    setSubmitting(true);
    setError(undefined);
    setMissing([]);

    try {
      /**
       * Everything the draft holds, in the order the server needs it.
       *
       * The Milestone 1 steps come first and are not optional: they create the
       * `student_profiles` row that every later write and the submission check depend on.
       * Until this existed they were saved to the device and nowhere else — the repository
       * methods were written and never called — so the server saw no study details, no
       * suburb and no Indian state, and `submit_registration` reported all four Milestone 1
       * steps as unfinished while the review screen displayed them filled in directly above
       * the error. Registration could not be submitted by anyone.
       */
      if (draft.displayName) await profileRepository.saveDisplayName(userId, draft.displayName);

      /**
       * §S13: "store a generated derivative". The photo is optional, so its upload failing
       * must not fail the registration — someone on a slow connection should not lose their
       * submission over a picture they were allowed to skip. They can add one again from
       * settings; every required write below still throws normally.
       */
      if (draft.photo?.localUri) {
        try {
          await profileRepository.uploadAvatar(userId, draft.photo.localUri);
        } catch {
          // Deliberate: optional data, required flow.
        }
      }
      if (draft.study) await registrationRepository.saveStudyDetails(userId, draft.study);
      if (draft.sydneyLocation) {
        await registrationRepository.saveSydneyLocation(userId, draft.sydneyLocation);
      }
      if (draft.indiaBackground) {
        await registrationRepository.saveIndiaBackground(userId, draft.indiaBackground);
      }

      if (draft.languages) await profileRepository.saveLanguages(userId, draft.languages);
      if (draft.communities) await profileRepository.saveCommunities(userId, draft.communities);
      if (draft.interests) await profileRepository.saveInterests(userId, draft.interests);
      if (draft.goals) await profileRepository.saveGoals(userId, draft.goals);
      if (draft.visibility) await profileRepository.saveVisibility(userId, draft.visibility);
      if (draft.consents) await profileRepository.saveConsents(userId, draft.consents);

      const result = await profileRepository.submit();

      if (result.outcome === 'incomplete') {
        setMissing(result.missing);
        setError('Some answers still need finishing before we can submit this.');
        return;
      }

      // §12.4: 'already_submitted' is a successful retry, not a failure — S17 shows the same
      // pending state either way, so both land there.
      analytics.track('registration_submitted', { screen: 'S16' });
      router.replace('/status');
    } catch {
      setError('We could not submit this. Your answers are safe on this phone — try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (draft === null) {
    return (
      <AppScreen testID="review-screen">
        <Text style={[typography.body, { color: theme.textSecondary }]}>Loading your answers…</Text>
      </AppScreen>
    );
  }

  const visibility = draft.visibility;
  const sharedFields =
    visibility === undefined
      ? []
      : (Object.keys(VISIBILITY_LABELS) as (keyof VisibilityPreferences)[]).filter(
          (key) => visibility[key],
        );

  return (
    <AppScreen scrollable testID="review-screen">
      <View style={styles.body}>
        <AppHeader
          eyebrow="Almost there"
          title="Check your answers"
          subtitle="Change anything that is not right. Nothing is sent until you tap submit."
          onBack={() => router.back()}
        />

        {error === undefined ? null : <InlineError message={error} testID="review-error" />}

        {missing.length === 0 ? null : (
          <View style={[styles.missing, { borderColor: theme.dangerText }]} testID="review-missing">
            <Text style={[typography.body, { color: theme.textPrimary }]}>
              These still need finishing:
            </Text>
            {missing.map((step) => (
              <Text
                key={step}
                style={[typography.body, { color: theme.accentText }]}
                accessibilityRole="link"
                onPress={() => router.push(MISSING_STEP_ROUTES[step])}
                testID={`review-missing-${step}`}
              >
                {MISSING_LABELS[step]}
              </Text>
            ))}
          </View>
        )}

        <ProfileSummaryCard
          title="You"
          onEdit={() => router.push('/photo')}
          items={[{ label: 'Name', value: draft.displayName }]}
          testID="review-name"
        />

        <ProfileSummaryCard
          title="Study"
          onEdit={() => router.push('/study')}
          items={[
            {
              label: 'Provider',
              value: draft.study?.providerOther ?? label(draft.study?.provider),
            },
            { label: 'Course', value: draft.study?.course },
            {
              label: 'Level',
              value:
                draft.study?.studyLevel === undefined
                  ? undefined
                  : STUDY_LEVEL_LABELS[draft.study.studyLevel],
            },
          ]}
          testID="review-study"
        />

        <ProfileSummaryCard
          title="Sydney"
          onEdit={() => router.push('/sydney-location')}
          items={[
            { label: 'Suburb', value: draft.sydneyLocation?.suburb },
            {
              label: 'Arrival',
              value:
                draft.sydneyLocation?.arrivalStatus === undefined
                  ? undefined
                  : ARRIVAL_STATUS_LABELS[draft.sydneyLocation.arrivalStatus],
            },
          ]}
          testID="review-location"
        />

        <ProfileSummaryCard
          title="India"
          onEdit={() => router.push('/india-background')}
          items={[
            { label: 'State', value: label(draft.indiaBackground?.stateCode) },
            { label: 'Hometown', value: draft.indiaBackground?.hometown },
          ]}
          testID="review-india"
        />

        <ProfileSummaryCard
          title="Languages"
          onEdit={() => router.push('/languages')}
          items={
            draft.languages === undefined || draft.languages.length === 0
              ? [{ label: 'Languages' }]
              : draft.languages.map((choice) => ({
                  label: label(choice.code) ?? choice.code,
                  value: LANGUAGE_PROFICIENCY_LABELS[choice.proficiency],
                }))
          }
          testID="review-languages"
        />

        <ProfileSummaryCard
          title="Communities"
          onEdit={() => router.push('/communities')}
          items={[
            {
              label: 'Cultural communities',
              value: draft.communities?.notSpecified
                ? 'Prefer not to specify'
                : draft.communities?.codes.map((code) => label(code)).join(', ') || undefined,
            },
          ]}
          testID="review-communities"
        />

        <ProfileSummaryCard
          title="Interests and goals"
          onEdit={() => router.push('/interests')}
          items={[
            { label: 'Interests', value: draft.interests?.map((code) => label(code)).join(', ') },
            { label: 'Top need', value: label(draft.goals?.[0]) },
          ]}
          testID="review-interests"
        />

        <ProfileSummaryCard
          title="Privacy"
          onEdit={() => router.push('/privacy')}
          items={[
            {
              label: 'Visible to other students',
              value:
                sharedFields.length === 0
                  ? 'Just your name'
                  : sharedFields.map((key) => VISIBILITY_LABELS[key]).join(', '),
            },
          ]}
          testID="review-privacy"
        />
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Submit for approval"
          onPress={() => void onSubmit()}
          loading={submitting}
          disabled={submitting}
          testID="review-submit"
        />
        <Text style={[typography.caption, { color: theme.textSecondary }]}>
          We review every application by hand. You can still edit your answers afterwards.
        </Text>
      </View>
    </AppScreen>
  );
}

/** Wording for the codes `submit_registration` returns, so a server list reads as English. */
const MISSING_LABELS: Record<MissingStep, string> = {
  eligibility: 'Eligibility questions',
  name: 'Your name',
  study: 'Study details',
  location: 'Where you live in Sydney',
  india_background: 'Where in India you are from',
  languages: 'Languages',
  interests: 'Interests',
  goals: 'What you need first',
  privacy: 'Privacy preferences',
  consent: 'Terms and privacy',
};

const styles = StyleSheet.create({
  body: { gap: spacing.md, flexGrow: 1 },
  missing: {
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 18,
    padding: 16,
  },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
