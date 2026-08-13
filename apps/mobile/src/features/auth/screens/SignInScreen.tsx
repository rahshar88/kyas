import { APP_ERROR_MESSAGES, emailSchema, isAppError } from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  EmailField,
  PoweredBy1818,
  PrimaryButton,
  TextButton,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { analytics } from '@/services/analytics';

/**
 * S02 — Email sign-in.
 *
 * §S02: "Create or recover an account without a password."
 *
 * One screen serves both new and returning students on purpose. Splitting them would mean
 * telling the user whether an address is already registered, which leaks who is a member of
 * a private community — the opposite of what §2.3 and §13 are protecting.
 */
export function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { requestCode } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    analytics.track('auth_started', { screen: 'S02' });
  }, []);

  const onSubmit = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid email address');
      return;
    }

    setError(undefined);
    setSubmitting(true);

    try {
      await requestCode(parsed.data);
      // The normalised address travels forward, so S03 verifies exactly what was sent.
      router.push({ pathname: '/(public)/verify-email', params: { email: parsed.data } });
    } catch (caught) {
      /**
       * A rate limit must not trap someone who already has a code.
       *
       * Failing to *send* a new code says nothing about whether an earlier one is still
       * valid — and they last an hour. Refusing to advance meant a tester holding a perfectly
       * good code had no route to the screen that accepts it: the only way in was a
       * successful send. That is a dead end for the ordinary case of requesting a code,
       * closing the app, and coming back.
       *
       * So a rate limit advances anyway, and S03 explains that no new code was sent. Every
       * other failure still stops here, because those genuinely mean no code exists.
       */
      if (isAppError(caught) && caught.code === 'RATE_LIMITED') {
        router.push({
          pathname: '/(public)/verify-email',
          params: { email: parsed.data, notSent: '1' },
        });
        return;
      }

      setError(isAppError(caught) ? APP_ERROR_MESSAGES[caught.code] : APP_ERROR_MESSAGES.UNKNOWN);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen scrollable testID="sign-in-screen">
      <View style={styles.body}>
        <AppHeader
          title="What's your email?"
          subtitle="We'll email you a code. No password to remember."
          onBack={() => router.back()}
        />

        <EmailField
          label="Email address"
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            if (error !== undefined) setError(undefined);
          }}
          placeholder="you@example.com"
          error={error}
          testID="sign-in-email"
        />

        {/* §S02: "Explain why the email is required and that it will not appear publicly." */}
        <Text style={[typography.caption, { color: theme.textSecondary }]}>
          Your email is how you sign in and how we reach you about your registration. It is never
          shown to other students.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Send me a code"
          onPress={() => void onSubmit()}
          loading={submitting}
          disabled={email.trim() === ''}
          testID="sign-in-submit"
        />
        {/**
         * §S02 has no route to S03 except a successful send, which makes any send failure a
         * dead end for someone who already holds a code — and codes last an hour. Rate limits,
         * a flaky connection, an error we mapped wrongly: all of them stranded a person whose
         * code was sitting in front of them. This is the way through that does not depend on
         * classifying the failure correctly.
         */}
        <TextButton
          label="I already have a code"
          onPress={() => {
            const parsed = emailSchema.safeParse(email);
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message ?? 'Enter your email address first');
              return;
            }
            router.push({
              pathname: '/(public)/verify-email',
              params: { email: parsed.data, notSent: '1' },
            });
          }}
          testID="sign-in-have-code"
        />

        <TextButton label="Back to start" onPress={() => router.back()} testID="sign-in-back" />
        <PoweredBy1818 />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, flexGrow: 1 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
