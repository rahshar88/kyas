import { APP_ERROR_MESSAGES, isAppError } from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  ConfirmationSheet,
  DestructiveButton,
  PoweredBy1818,
  TextButton,
  TextField,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { betaRepository } from '@/repositories/beta-repository';
import { analytics } from '@/services/analytics';

/**
 * S22 — Delete account.
 *
 * §S22: "Allow complete account-deletion initiation inside the app."
 *
 * Four rules from §S22, each defending against a different way this screen goes wrong.
 *
 * **"Explain effect."** What is deleted is listed, plainly, before anything else. Someone
 * should not discover afterwards that their feedback and their invitation went too.
 *
 * **"Require a deliberate confirmation."** Typing DELETE, not a second button. A confirmation
 * button is defeated by the same reflex that produced the first tap; typing a word cannot be
 * done by accident, and it is the only part of this screen that genuinely prevents anything.
 *
 * **"Deactivation alone is not presented as deletion."** The copy says the account is closed
 * immediately and the data is erased under the retention policy. It does not say "deleted"
 * about something that still exists — that would be the exact misrepresentation §S22 names.
 *
 * **"Sign out immediately."** Unconditionally, including when the server reports the request
 * was already open. Someone who has confirmed deletion must not be left holding a working
 * session, and a retry after a dropped response has still done what they intended.
 */
const CONFIRM_PHRASE = 'DELETE';

export function DeleteAccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();

  const [reason, setReason] = useState('');
  const [phrase, setPhrase] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    analytics.track('account_deletion_started', { screen: 'S22' });
  }, []);

  const confirm = async () => {
    setBusy(true);
    setError(undefined);

    try {
      await betaRepository.requestDeletion(reason.trim() === '' ? undefined : reason);
      analytics.track('account_deletion_requested', { screen: 'S22' });

      // §S22: sign out immediately. Before navigating, so there is no window in which a
      // signed-in screen renders for an account that has just been closed.
      await signOut();
      router.replace('/');
    } catch (caught) {
      setConfirming(false);
      setError(isAppError(caught) ? APP_ERROR_MESSAGES[caught.code] : APP_ERROR_MESSAGES.UNKNOWN);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen scrollable testID="delete-account-screen">
      <View style={styles.body}>
        <AppHeader
          eyebrow="This cannot be undone"
          title="Delete your account"
          onBack={() => router.back()}
        />

        {/* §S22: "Explain effect." Specific, because "your data" means nothing to anyone. */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElevated }]}>
          <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>What happens</Text>
          <Text style={[typography.body, { color: theme.textSecondary }]}>
            Your account closes straight away and you are signed out of every device.
          </Text>
          <Text style={[typography.body, { color: theme.textSecondary }]}>
            Everything you told us goes: your study details, where you live, your languages,
            communities, interests and goals, your photo, and any feedback you sent us.
          </Text>
          <Text style={[typography.body, { color: theme.textSecondary }]}>
            Your invitation code stops working. Anyone who already joined with it keeps their own
            account — it is theirs, not yours.
          </Text>
          <Text style={[typography.body, { color: theme.textSecondary }]}>
            You can register again later, but nothing is restored. It would be a new account.
          </Text>
        </View>

        <TextField
          label="Anything you want to tell us? (optional)"
          value={reason}
          onChangeText={setReason}
          placeholder="It helps us understand what went wrong."
          multiline
          maxLength={1000}
          testID="delete-reason"
        />

        {error === undefined ? null : (
          <Text style={[typography.caption, { color: theme.dangerText }]} accessibilityRole="alert">
            {error}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <DestructiveButton
          label="Delete my account"
          onPress={() => {
            setPhrase('');
            setConfirming(true);
          }}
          testID="delete-start"
        />
        <TextButton label="Keep my account" onPress={() => router.back()} testID="delete-cancel" />
        <PoweredBy1818 />
      </View>

      <ConfirmationSheet
        visible={confirming}
        title="Delete your account?"
        body="This closes your account and erases what you told us. It cannot be undone."
        confirmLabel="Delete my account"
        confirmPhrase={CONFIRM_PHRASE}
        phrase={phrase}
        onPhraseChange={setPhrase}
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
        testID="delete-confirmation"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  card: { gap: spacing.sm, borderRadius: 18, padding: 16 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
