import { REGISTRATION_STEP_COUNT, displayNameSchema, stepNumber } from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  PrimaryButton,
  SecondaryButton,
  StepProgress,
  TextButton,
  TextField,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { useDraft } from '@/features/registration/hooks/useDraft';
import { analytics } from '@/services/analytics';
import { avatarService } from '@/services/avatar';

/**
 * S13 — Your name and photo.
 *
 * §S13: "Add recognition and trust while remaining optional in P0." That is about the
 * photograph, and it still holds: Skip is a real button of equal weight, present before any
 * permission is requested and still present after a denial — §S13's acceptance is that
 * "permission denial returns to a usable screen with instructions and skip option", which is
 * a screen that has to work in the failure case, not a message.
 *
 * The **name is required**, and is the reason this screen changed.
 *
 * No screen in §S02–§S17 ever asked for one. `profiles.display_name` existed from Milestone 1
 * because the review console lists people and §15.2 lets a moderator clear a name — both of
 * which presuppose one — but nothing ever set it. Every applicant reached the queue as "No
 * name", and §S18's beta home would have greeted nobody. Found by looking at a real review
 * queue; no test could have noticed, because nothing was broken.
 *
 * A name and a face are the same question — how do you appear to other students — so it
 * belongs here rather than on a screen of its own.
 *
 * It is also what lets S13 join `REGISTRATION_STEPS`. It could not before: the photo is
 * optional, so "skipped" and "never reached" were indistinguishable and resume would have
 * looped here forever. "Has a name" is unambiguous, and skipping the photo still completes
 * the step.
 */
export function ProfilePhotoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, saveStep, isLoading } = useDraft();

  const [uri, setUri] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [denied, setDenied] = useState<'camera' | 'library' | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S13' });
  }, []);

  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && draft !== null) {
    setHydrated(true);
    if (draft.photo?.localUri) setUri(draft.photo.localUri);
    if (draft.displayName !== undefined) setName(draft.displayName);
  }

  const choose = async (source: 'camera' | 'library') => {
    setBusy(true);
    try {
      const result = await avatarService.pick(source);

      if (result.status === 'picked') {
        setUri(result.uri);
        setDenied(undefined);
        return;
      }
      if (result.status === 'permission_denied') {
        setDenied(result.source);
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * Advancing writes the photo either way — with a uri when chosen, without when skipped.
   * Both are answers, and recording the skip is what stops S16 showing "Not provided" as
   * though something went wrong.
   */
  const advance = async (photoUri: string | undefined) => {
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? 'Enter a name');
      return;
    }

    await saveStep('photo', { displayName: parsed.data, photo: { localUri: photoUri } });
    analytics.track('onboarding_step_completed', { screen: 'S13' });
    router.push('/privacy');
  };

  return (
    <AppScreen scrollable testID="photo-screen">
      <View style={styles.body}>
        <StepProgress current={stepNumber('photo')} total={REGISTRATION_STEP_COUNT} />

        <AppHeader
          title="What should we call you?"
          subtitle="This is the name other students will see. A photo is optional."
          onBack={() => router.back()}
        />

        <TextField
          label="Your name"
          value={name}
          onChangeText={(next) => {
            setName(next);
            if (nameError !== undefined) setNameError(undefined);
          }}
          placeholder="Asha"
          autoCapitalize="words"
          autoComplete="name"
          maxLength={60}
          error={nameError}
          testID="photo-name"
        />

        <View style={styles.preview}>
          {uri === undefined ? (
            <View
              style={[
                styles.placeholder,
                { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
              ]}
              accessibilityRole="image"
              accessibilityLabel="No photo chosen"
              testID="photo-placeholder"
            >
              <Text style={[typography.caption, { color: theme.textSecondary }]}>No photo</Text>
            </View>
          ) : (
            <Image
              source={{ uri }}
              style={[styles.image, { borderColor: theme.border }]}
              accessibilityLabel="Your chosen profile photo"
              testID="photo-preview"
            />
          )}
        </View>

        {denied === undefined ? null : (
          <View
            style={[styles.notice, { borderColor: theme.border }]}
            accessibilityRole="alert"
            testID="photo-permission-denied"
          >
            <Text style={[typography.body, { color: theme.textPrimary }]}>
              {denied === 'camera'
                ? 'KyaScene does not have access to your camera.'
                : 'KyaScene does not have access to your photos.'}
            </Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              You can turn it on in Settings, or skip this step — a photo is optional.
            </Text>
            <TextButton
              label="Open Settings"
              onPress={() => void Linking.openSettings()}
              testID="photo-open-settings"
            />
          </View>
        )}

        <View style={styles.choices}>
          <SecondaryButton
            label="Take a photo"
            onPress={() => void choose('camera')}
            disabled={busy}
            testID="photo-camera"
          />
          <SecondaryButton
            label="Choose from library"
            onPress={() => void choose('library')}
            disabled={busy}
            testID="photo-library"
          />
          {uri === undefined ? null : (
            <TextButton
              label="Remove photo"
              onPress={() => setUri(undefined)}
              testID="photo-remove"
            />
          )}
        </View>

        <Text style={[typography.caption, { color: theme.textSecondary }]}>
          We resize the photo on your phone and strip the hidden data cameras attach — including the
          location where it was taken.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={uri === undefined ? 'Continue without a photo' : 'Use this photo'}
          disabled={name.trim() === ''}
          onPress={() => void advance(uri)}
          loading={isLoading}
          testID="photo-continue"
        />
        {uri === undefined ? null : (
          <TextButton
            label="Skip for now"
            onPress={() => void advance(undefined)}
            testID="photo-skip"
          />
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  preview: { alignItems: 'center' },
  placeholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: 160, height: 160, borderRadius: 80, borderWidth: StyleSheet.hairlineWidth * 2 },
  notice: {
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 18,
    padding: 16,
  },
  choices: { gap: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.xxl },
});
