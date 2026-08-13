import {
  AppHeader,
  AppScreen,
  PrimaryButton,
  SecondaryButton,
  StepProgress,
  TextButton,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { useDraft } from '@/features/registration/hooks/useDraft';
import { avatarService } from '@/features/registration/services/avatar';
import { analytics } from '@/services/analytics';

/**
 * S13 — Profile photograph.
 *
 * §S13: "Add recognition and trust while remaining optional in P0."
 *
 * Optional is load-bearing here, not a caveat. Skip is a real button of equal weight, it is
 * present before any permission is requested, and it is still present after a denial —
 * §S13's acceptance is that "permission denial returns to a usable screen with instructions
 * and skip option", which is a screen that has to work in the failure case, not a message.
 *
 * This step is deliberately absent from `REGISTRATION_STEPS`: a step that can be skipped
 * cannot be used to decide "where did they get to", because skipped and never-reached would
 * be indistinguishable and the resume would loop here forever.
 */
export function ProfilePhotoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, patch, isLoading } = useDraft();

  const [uri, setUri] = useState<string | undefined>();
  const [denied, setDenied] = useState<'camera' | 'library' | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S13' });
  }, []);

  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && draft !== null) {
    setHydrated(true);
    if (draft.photo?.localUri) setUri(draft.photo.localUri);
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
    await patch({ photo: { localUri: photoUri } });
    analytics.track('onboarding_step_completed', { screen: 'S13' });
    router.push('/privacy');
  };

  return (
    <AppScreen scrollable testID="photo-screen">
      <View style={styles.body}>
        <StepProgress current={8} total={10} />

        <AppHeader
          eyebrow="Optional"
          title="Add a photo?"
          subtitle="It helps people recognise you. You can add one later instead."
          onBack={() => router.back()}
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
