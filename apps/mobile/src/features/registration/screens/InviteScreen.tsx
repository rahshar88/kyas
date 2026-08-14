import { APP_ERROR_MESSAGES, inviteCodeSchema, isAppError } from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  PoweredBy1818,
  PrimaryButton,
  TextField,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { inviteRepository } from '@/repositories/invite-repository';
import { analytics } from '@/services/analytics';
import { bundleIdentity } from '@/services/build-identity';

/**
 * S04 — Beta invitation.
 *
 * §S04: "Restrict early access and attribute referrals."
 *
 * The screen is thin because it must be: validity, capacity, expiry and atomicity all live
 * server-side (§12.1), and anything decided here could be bypassed. The client's only jobs
 * are to normalise input the way the server will, and to turn a typed failure into language
 * a student can act on.
 */
export function InviteScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    analytics.track('invite_viewed', { screen: 'S04' });
  }, []);

  const onSubmit = async () => {
    const parsed = inviteCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'That invite code does not look right');
      return;
    }

    setError(undefined);
    setSubmitting(true);

    try {
      const outcome = await inviteRepository.redeem(parsed.data);
      // §12.4: a repeat redemption is a success. Someone who tapped twice on a poor
      // connection continues rather than being told their own code is invalid.
      analytics.track('invite_redeemed', { screen: 'S04', outcomeCode: outcome });
      router.replace('/(registration)/eligibility');
    } catch (caught) {
      const code_ = isAppError(caught) ? caught.code : 'UNKNOWN';
      analytics.track('eligibility_failed', { screen: 'S04', outcomeCode: code_ });
      setError(
        code_ === 'INVITE_EXHAUSTED'
          ? 'This invitation has already been fully used. Ask whoever invited you for a new one.'
          : code_ === 'INVITE_INVALID'
            ? "We couldn't find that invitation. Check the code and try again."
            : APP_ERROR_MESSAGES[code_],
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen scrollable testID="invite-screen">
      <View style={styles.body}>
        <AppHeader
          title="Got an invite code?"
          subtitle="KyaScene is invite-only during the beta."
        />

        <TextField
          label="Invite code"
          value={code}
          onChangeText={(next) => {
            setCode(next);
            if (error !== undefined) setError(undefined);
          }}
          placeholder="KYASCENE01"
          autoCapitalize="characters"
          maxLength={20}
          error={error}
          editable={!submitting}
          testID="invite-code"
        />

        <Text style={[typography.caption, { color: theme.textSecondary }]}>
          Codes are not case-sensitive, and dashes don&apos;t matter.
        </Text>

        {/* §S04 lists "request an invitation through the marketing site" as an action. */}
        <Text style={[typography.caption, { color: theme.textSecondary }]}>
          No code yet? Ask a friend already on KyaScene, or request one at kyascene.app.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Redeem"
          onPress={() => void onSubmit()}
          loading={submitting}
          disabled={code.trim() === ''}
          testID="invite-submit"
        />
        <PoweredBy1818 detail={bundleIdentity} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
