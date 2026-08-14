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
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { env } from '@/config/env';
import { useAuth } from '@/providers/AuthProvider';
import { profileRepository } from '@/repositories/profile-repository';
import { registrationRepository } from '@/repositories/registration-repository';

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

  const open = (url: string) => () => void Linking.openURL(url);

  /**
   * Which JavaScript this phone is actually running.
   *
   * Two multi-day debugging rounds in this project came down to a device silently running an
   * old bundle while everyone reasoned about the new one — updates published for a runtime no
   * binary had, then a reinstall reverting to an embedded bundle mid-diagnosis. "Force-close
   * and hope" is not a verification step. This line is: read it, compare it to the update id
   * the publish printed, done.
   *
   * `updateId` is null when running the bundle embedded at build time, which is its own
   * answer. The date is ISO-sliced rather than locale-formatted on purpose — Hermes' Intl
   * support is exactly the kind of assumption that cost a day here already.
   */
  const updateLabel = (() => {
    try {
      if (Updates.updateId == null) return 'embedded bundle';
      const published =
        Updates.createdAt == null ? '' : ` · ${Updates.createdAt.toISOString().slice(0, 16)}Z`;
      return `update ${Updates.updateId.slice(0, 8)}${published}`;
    } catch {
      return 'embedded bundle';
    }
  })();

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
        </View>

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
          KyaScene {Constants.expoConfig?.version ?? '—'} ({env.EXPO_PUBLIC_ENVIRONMENT}) —{' '}
          {updateLabel}
        </Text>
      </View>

      <View style={styles.actions}>
        <SecondaryButton
          label="Sign out"
          onPress={() => void signOut()}
          testID="settings-sign-out"
        />
        <TextButton label="Back" onPress={() => router.back()} testID="settings-back" />
        <PoweredBy1818 />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, flexGrow: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1, gap: 2 },
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
