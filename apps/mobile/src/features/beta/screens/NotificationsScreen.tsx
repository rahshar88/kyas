import {
  AppHeader,
  AppScreen,
  PoweredBy1818,
  PrimaryButton,
  SecondaryButton,
  TextButton,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { pushService, type PushRegistration } from '@/features/beta/services/push';
import { useAuth } from '@/providers/AuthProvider';
import { betaRepository } from '@/repositories/beta-repository';

/**
 * Notification preferences — the §S21 item, and the visible half of §21.5's push foundation.
 *
 * **Milestone 3 sends nothing.** The screen says so, in those words, because the alternative
 * is asking someone for notification permission and then never using it — which trains people
 * to decline, and spends the single best chance of a yes on nothing.
 *
 * §S13's permission rules apply here in full: the prompt appears only when someone taps the
 * button, a denial returns to a screen that still works and explains what to do, and there is
 * always a way onward. iOS asks once per install, so a denial handled badly is permanent.
 */
export function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.userId;

  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined',
  );
  const [result, setResult] = useState<PushRegistration | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushService.currentPermission().then(setPermission);
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const registration = await pushService.register();
      setResult(registration);

      if (registration.status === 'registered' && userId !== undefined) {
        await betaRepository.registerPushToken(userId, registration.token, registration.platform);
        setPermission('granted');
      } else if (registration.status === 'denied') {
        setPermission('denied');
      }
    } finally {
      setBusy(false);
    }
  };

  const registered = result?.status === 'registered' || permission === 'granted';

  return (
    <AppScreen scrollable testID="notifications-screen">
      <View style={styles.body}>
        <AppHeader
          title="Notifications"
          subtitle="We are not sending any yet."
          onBack={() => router.back()}
        />

        <View style={[styles.card, { backgroundColor: theme.backgroundElevated }]}>
          <Text style={[typography.body, { color: theme.textSecondary }]}>
            When there is something worth telling you — your registration being approved, or the
            first real features arriving — we would rather reach you than hope you open the app.
          </Text>
          <Text style={[typography.body, { color: theme.textSecondary }]}>
            Turning this on now just registers this device. Nothing is sent during the beta without
            us saying so first.
          </Text>
        </View>

        {registered ? (
          <Text style={[typography.body, { color: theme.positiveText }]} testID="push-registered">
            This device is registered.
          </Text>
        ) : null}

        {result?.status === 'denied' || permission === 'denied' ? (
          <View
            style={[styles.card, { borderColor: theme.border, borderWidth: 1 }]}
            accessibilityRole="alert"
            testID="push-denied"
          >
            <Text style={[typography.body, { color: theme.textPrimary }]}>
              KyaScene does not have permission to notify you.
            </Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              iOS only asks once, so this has to be changed in Settings.
            </Text>
            <TextButton
              label="Open Settings"
              onPress={() => void Linking.openSettings()}
              testID="push-open-settings"
            />
          </View>
        ) : null}

        {/**
         * `unavailable` is its own state, and an honest one. It was the normal iOS outcome
         * until an Apple push key existed; now it means a simulator, a lapsed credential, or a
         * fork without an EAS project id. Reporting any of those as a failure the tester caused
         * would send them to Settings to fix something that is not theirs to fix.
         */}
        {result?.status === 'unavailable' ? (
          <View
            style={[styles.card, { borderColor: theme.border, borderWidth: 1 }]}
            testID="push-unavailable"
          >
            <Text style={[typography.body, { color: theme.textPrimary }]}>
              Notifications are not set up on this build yet.
            </Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              Nothing you did — it is on our side. Everything else works as normal.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {registered ? (
          <SecondaryButton
            label="Registered"
            onPress={() => router.back()}
            disabled
            testID="push-enable"
          />
        ) : (
          <PrimaryButton
            label="Notify me about KyaScene"
            onPress={() => void enable()}
            loading={busy}
            testID="push-enable"
          />
        )}
        <TextButton label="Back" onPress={() => router.back()} testID="push-back" />
        <PoweredBy1818 />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  card: { gap: spacing.sm, borderRadius: 18, padding: 16 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
