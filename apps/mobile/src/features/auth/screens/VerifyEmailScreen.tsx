import { APP_ERROR_MESSAGES, isAppError, otpCodeSchema } from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  PoweredBy1818,
  PrimaryButton,
  TextButton,
  TextField,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';

/** §S03: "resend after countdown". Long enough to discourage hammering the rate limit. */
const RESEND_COOLDOWN_SECONDS = 45;

/**
 * S03 — Verify email.
 *
 * §S03 states: "Invalid, expired, rate-limited, offline and success." Each maps to a typed
 * AppErrorCode, so the copy comes from one place (§6.4) rather than being invented here.
 *
 * The auto-submit on a complete code matters more than it looks: pasting a code from the
 * Mail app is the common path, and requiring a further tap after paste is the kind of
 * friction that shows up in §3.2's three-minute registration target.
 */
export function VerifyEmailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signInWithCode, requestCode } = useAuth();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = useCallback(
    async (value: string) => {
      const parsed = otpCodeSchema.safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Enter the 6-digit code');
        return;
      }
      if (!email) {
        setError(APP_ERROR_MESSAGES.SESSION_EXPIRED);
        return;
      }

      setError(undefined);
      setSubmitting(true);

      try {
        await signInWithCode(email, parsed.data);
        // Where they land next depends on server status, which the root layout resolves.
        router.replace('/');
      } catch (caught) {
        setError(
          isAppError(caught)
            ? caught.code === 'VALIDATION_FAILED'
              ? 'That code did not work. It may have expired — try a new one.'
              : APP_ERROR_MESSAGES[caught.code]
            : APP_ERROR_MESSAGES.UNKNOWN,
        );
        // Let the same code be retried after a network blip, but not auto-resubmitted.
        attempted.current = null;
      } finally {
        setSubmitting(false);
      }
    },
    [email, router, signInWithCode],
  );

  const onChange = (next: string) => {
    const digits = next.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(digits);
    if (error !== undefined) setError(undefined);

    // Auto-submit once, so a paste completes without a further tap but a failed attempt is
    // not retried in a loop.
    if (digits.length === 6 && attempted.current !== digits && !submitting) {
      attempted.current = digits;
      void submit(digits);
    }
  };

  const onResend = async () => {
    if (!email || cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setError(undefined);
    attempted.current = null;

    try {
      await requestCode(email);
    } catch (caught) {
      setError(isAppError(caught) ? APP_ERROR_MESSAGES[caught.code] : APP_ERROR_MESSAGES.UNKNOWN);
    }
  };

  return (
    <AppScreen scrollable testID="verify-email-screen">
      <View style={styles.body}>
        <AppHeader
          title="Check your email"
          subtitle={email ? `We sent a 6-digit code to ${email}.` : 'We sent you a 6-digit code.'}
          onBack={() => router.back()}
        />

        <TextField
          label="6-digit code"
          value={code}
          onChangeText={onChange}
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          error={error}
          editable={!submitting}
          testID="verify-code"
        />

        <Text style={[typography.caption, { color: theme.textSecondary }]}>
          The code expires after a few minutes. Check your spam folder if it hasn&apos;t arrived.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Verify"
          onPress={() => void submit(code)}
          loading={submitting}
          disabled={code.length !== 6}
          testID="verify-submit"
        />

        <TextButton
          label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Send a new code'}
          onPress={() => void onResend()}
          disabled={cooldown > 0}
          testID="verify-resend"
        />

        {/* §S03 lists "change email" as a required action. */}
        <TextButton
          label="Use a different email"
          onPress={() => router.back()}
          testID="verify-change-email"
        />

        <PoweredBy1818 />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, flexGrow: 1 },
  actions: { gap: spacing.sm, marginTop: spacing.xxl },
});
