import {
  AppHeader,
  AppScreen,
  PoweredBy1818,
  SecondaryButton,
  StudentAvatar,
  TextButton,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { DiagnosticDetail } from '@/components/DiagnosticDetail';
import { env } from '@/config/env';
import { useAuth } from '@/providers/AuthProvider';
import { profileRepository } from '@/repositories/profile-repository';
import { registrationRepository } from '@/repositories/registration-repository';
import { avatarService } from '@/services/avatar';
import { bundleIdentity } from '@/services/build-identity';

/**
 * S21 — Profile and settings.
 *
 * §S21 acceptance: **"Legal and account-deletion actions are available without searching
 * multiple menus."** That single sentence decides the layout. Everything §S21 lists is on this
 * one screen, in one scroll, with no nested settings pages — the pattern where "Delete account"
 * lives three levels down under Account → Advanced → Manage exists to reduce deletions, and
 * §11.4 and the App Store both expect the opposite.
 *
 * So deletion is a visible row here, not a footnote. What protects against an accidental tap is
 * S22's confirmation, which is a deliberate act — not making the control hard to find.
 */
interface Row {
  label: string;
  detail?: string;
  onPress: () => void;
  testID: string;
  tone?: 'default' | 'danger';
}

export function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, signOut } = useAuth();
  const userId = session?.userId;

  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => registrationRepository.ensureProfile(userId!),
    enabled: userId !== undefined,
  });

  const avatarPath = profile.data?.avatarPath ?? null;
  const avatar = useQuery({
    queryKey: ['avatar-url', avatarPath],
    queryFn: () => profileRepository.avatarUrl(avatarPath!),
    enabled: avatarPath !== null,
  });

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoState, setPhotoState] = useState<'denied' | 'failed' | 'saved' | undefined>();
  /** The original throw from a failed upload, for DiagnosticDetail on internal builds. */
  const [photoCause, setPhotoCause] = useState<unknown>();

  /**
   * Pick → upload, in one gesture, right here.
   *
   * The registration flow uploads the photo when S16 is submitted — correct for onboarding,
   * useless afterwards: an approved member's only route back to S16 was "Edit your answers",
   * five screens deep, ending at a Submit button for a registration that is already in. Two
   * real people failed to find it. A photo is a settings-shaped change, so it lives here and
   * saves the moment it is chosen, with nothing else to press.
   */
  const changePhoto = async () => {
    if (userId === undefined || photoBusy) return;
    setPhotoState(undefined);
    setPhotoCause(undefined);

    const picked = await avatarService.pick('library');
    if (picked.status === 'cancelled') return;
    if (picked.status === 'permission_denied') {
      setPhotoState('denied');
      return;
    }

    setPhotoBusy(true);
    try {
      await profileRepository.uploadAvatar(userId, picked.uri);
      // The path is stable but the object behind it changed; refetching mints a fresh signed
      // URL, whose new token is what makes the Image component actually reload.
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      await queryClient.invalidateQueries({ queryKey: ['avatar-url'] });
      setPhotoState('saved');
    } catch (caught) {
      setPhotoState('failed');
      setPhotoCause(caught);
    } finally {
      setPhotoBusy(false);
    }
  };

  const open = (url: string) => () => void Linking.openURL(url);

  // The shared identity line — same string the footer shows on every screen.

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'Your profile',
      rows: [
        {
          label: 'Edit your answers',
          detail: 'Study, suburb, languages, interests and goals',
          onPress: () => router.push('/review'),
          testID: 'settings-edit-profile',
        },
        {
          label: 'Privacy preferences',
          detail: 'What other students will be able to see',
          onPress: () => router.push('/privacy'),
          testID: 'settings-privacy',
        },
        {
          label: 'Notifications',
          detail: 'Not sending any yet — we will ask before we do',
          onPress: () => router.push('/notifications'),
          testID: 'settings-notifications',
        },
      ],
    },
    {
      title: 'Legal',
      rows: [
        {
          label: 'Privacy policy',
          onPress: open(env.EXPO_PUBLIC_PRIVACY_URL),
          testID: 'settings-privacy-policy',
        },
        {
          label: 'Terms of use',
          onPress: open(env.EXPO_PUBLIC_TERMS_URL),
          testID: 'settings-terms',
        },
        {
          label: 'Get support',
          onPress: open(env.EXPO_PUBLIC_SUPPORT_URL),
          testID: 'settings-support',
        },
      ],
    },
    {
      title: 'Account',
      rows: [
        {
          label: 'Delete my account',
          detail: 'Permanently, along with everything you have told us',
          onPress: () => router.push('/delete-account'),
          testID: 'settings-delete',
          tone: 'danger',
        },
      ],
    },
  ];

  return (
    <AppScreen scrollable testID="settings-screen">
      <View style={styles.body}>
        <AppHeader title="Profile and settings" onBack={() => router.back()} />

        <View style={styles.identity}>
          <StudentAvatar
            displayName={profile.data?.displayName ?? null}
            uri={avatar.data ?? undefined}
            size={56}
          />
          <View style={styles.identityText}>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
              {profile.data?.displayName ?? 'Your profile'}
            </Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              {session?.email ?? ''}
            </Text>
          </View>
          <TextButton
            label={
              photoBusy ? 'Saving…' : avatarPath === null ? 'Add a photo' : 'Change photo'
            }
            onPress={() => void changePhoto()}
            disabled={photoBusy}
            testID="settings-change-photo"
          />
        </View>

        {photoState === 'saved' ? (
          <Text
            style={[typography.caption, { color: theme.textSecondary }]}
            accessibilityRole="alert"
            testID="settings-photo-saved"
          >
            Photo saved. It can take a moment to show everywhere.
          </Text>
        ) : null}

        {photoState === 'denied' ? (
          <View accessibilityRole="alert" testID="settings-photo-denied" style={styles.notice}>
            <Text style={[typography.caption, { color: theme.cautionText }]}>
              KyaScene does not have access to your photos. Turn it on in your phone&apos;s
              Settings, then try again.
            </Text>
            <TextButton
              label="Open phone Settings"
              onPress={() => void Linking.openSettings()}
              testID="settings-photo-open-settings"
            />
          </View>
        ) : null}

        {photoState === 'failed' ? (
          <View accessibilityRole="alert" testID="settings-photo-failed" style={styles.notice}>
            <Text style={[typography.caption, { color: theme.cautionText }]}>
              Your photo could not be saved. Nothing else was changed — you can try again.
            </Text>
            <DiagnosticDetail error={photoCause} testID="settings-photo-diagnostic" />
          </View>
        ) : null}

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[typography.label, { color: theme.textSecondary }]}>{section.title}</Text>

            {section.rows.map((row) => (
              <Pressable
                key={row.testID}
                onPress={row.onPress}
                accessibilityRole="button"
                accessibilityLabel={
                  row.detail === undefined ? row.label : `${row.label}. ${row.detail}`
                }
                testID={row.testID}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    typography.body,
                    { color: row.tone === 'danger' ? theme.dangerText : theme.textPrimary },
                  ]}
                >
                  {row.label}
                </Text>
                {row.detail === undefined ? null : (
                  <Text style={[typography.caption, { color: theme.textSecondary }]}>
                    {row.detail}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}

        {/* §S21: "beta version". The first thing worth knowing when a tester reports a bug. */}
        <Text
          style={[typography.caption, { color: theme.textSecondary }]}
          testID="settings-version"
        >
          KyaScene {Constants.expoConfig?.version ?? '—'} ({env.EXPO_PUBLIC_ENVIRONMENT})
          {bundleIdentity === undefined ? '' : ` — ${bundleIdentity}`}
        </Text>
      </View>

      <View style={styles.actions}>
        <SecondaryButton
          label="Sign out"
          onPress={() => void signOut()}
          testID="settings-sign-out"
        />
        <TextButton label="Back" onPress={() => router.back()} testID="settings-back" />
        <PoweredBy1818 detail={bundleIdentity} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, flexGrow: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1, gap: 2 },
  notice: { gap: spacing.xs },
  section: { gap: spacing.sm },
  row: {
    gap: 2,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 16,
  },
  pressed: { opacity: 0.75 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
