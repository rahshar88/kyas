import {
  AppHeader,
  AppScreen,
  EmptyState,
  PoweredBy1818,
  PrimaryButton,
  SecondaryButton,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { betaRepository } from '@/repositories/beta-repository';
import { analytics } from '@/services/analytics';

/**
 * S19 — Invite friends.
 *
 * §S19: "Recruit eligible testers and measure referrals."
 *
 * Two rules from §S19 shape everything here.
 *
 * **"Shared link contains an opaque code, not the inviter's user ID."** The shared text
 * carries the code and nothing else. A user id in a link is a permanent identifier handed to
 * whoever the message is forwarded to, and a beta of a few hundred people is small enough that
 * one leaked id de-anonymises a lot.
 *
 * **"Do not reveal referred users until they independently consent and connect in a future
 * milestone."** So this screen shows a *count* and never a list. Someone who redeems a code
 * has consented to join KyaScene, not to having their name shown to the person who invited
 * them — and that distinction is the whole reason the count is the only thing here.
 */
export function InviteFriendsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.userId;

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    analytics.track('referral_viewed', { screen: 'S19' });
  }, []);

  /**
   * Minting and reading are two steps on purpose.
   *
   * `ensureReferral` is idempotent and writes to the invite ledger through an Edge Function;
   * the code itself is then read under the owner-only policy, so there is exactly one path to
   * a referral code and one place deciding who may see it.
   */
  const referral = useQuery({
    queryKey: ['referral', userId],
    queryFn: async () => {
      await betaRepository.ensureReferral();
      return betaRepository.loadReferral(userId!);
    },
    enabled: userId !== undefined,
  });

  const code = referral.data?.code;

  const share = async () => {
    if (code === undefined) return;

    await Share.share({
      message:
        `I'm on KyaScene — it's for Indian students in Sydney, still invite-only.\n\n` +
        `Use my code ${code} when you sign up.`,
    });

    // §14.3: that a share happened, never who it went to or what was written.
    analytics.track('referral_shared', { screen: 'S19' });
  };

  const copy = async () => {
    if (code === undefined) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
  };

  return (
    <AppScreen scrollable testID="invite-friends">
      <View style={styles.body}>
        <AppHeader
          title="Invite friends"
          subtitle="KyaScene is invite-only. These are yours to give."
          onBack={() => router.back()}
        />

        {referral.isLoading ? (
          <Text style={[typography.body, { color: theme.textSecondary }]}>
            Getting your code ready…
          </Text>
        ) : referral.isError || code === undefined ? (
          <EmptyState
            title="We could not get your code"
            body="Pull down to try again, or come back in a moment."
            testID="invite-error"
          />
        ) : (
          <>
            <View style={[styles.codeCard, { backgroundColor: theme.backgroundElevated }]}>
              <Text style={[typography.label, { color: theme.textSecondary }]}>Your code</Text>
              <Text
                style={[typography.display, { color: theme.accentText, letterSpacing: 4 }]}
                accessibilityLabel={`Your invitation code is ${code.split('').join(' ')}`}
                testID="invite-code"
              >
                {code}
              </Text>
            </View>

            <View style={styles.stats}>
              <Text style={[typography.body, { color: theme.textPrimary }]} testID="invite-count">
                {referral.data?.remaining} of {referral.data?.capacity} invitations left
              </Text>
              {/* §S19: a count, never a list. See the note at the top of this file. */}
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                {referral.data?.redeemedCount === 0
                  ? 'Nobody has used yours yet.'
                  : `${referral.data?.redeemedCount} ${
                      referral.data?.redeemedCount === 1 ? 'person has' : 'people have'
                    } joined with your code. We do not show you who — that is theirs to share.`}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Share my code"
          onPress={() => void share()}
          disabled={code === undefined}
          testID="invite-share"
        />
        <SecondaryButton
          label={copied ? 'Copied' : 'Copy code'}
          onPress={() => void copy()}
          disabled={code === undefined}
          testID="invite-copy"
        />
        <PoweredBy1818 />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, flexGrow: 1 },
  codeCard: { alignItems: 'center', gap: spacing.sm, borderRadius: 24, padding: 24 },
  stats: { gap: spacing.xs },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
