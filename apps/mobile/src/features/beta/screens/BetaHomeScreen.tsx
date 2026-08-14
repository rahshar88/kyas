import { type FeatureFlagKey } from '@kyascene/domain';
import {
  AppScreen,
  EmptyState,
  FeatureCard,
  KyaSceneWordmark,
  PoweredBy1818,
  SecondaryButton,
  StudentAvatar,
  TextButton,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { useFlags } from '@/providers/FlagsProvider';
import { betaRepository } from '@/repositories/beta-repository';
import { profileRepository } from '@/repositories/profile-repository';
import { registrationRepository } from '@/repositories/registration-repository';
import { analytics } from '@/services/analytics';
import { bundleIdentity } from '@/services/build-identity';

/**
 * S18 — Beta home.
 *
 * §S18: "Give approved testers a useful destination before the social product ships."
 *
 * The word doing the work is *useful*. This screen exists during the months when the social
 * product does not, so its job is to be honest about that while still being worth opening:
 * what you told us, what you can do now, and what is coming — clearly marked as not here yet.
 *
 * §S18's acceptance criterion is the sharp one: **"No disabled feature looks tappable; enabled
 * features are controlled by server flags."** Both halves are structural rather than
 * disciplined. Whether a card is real comes from `useFlags`, which fails closed to all-false;
 * and an unavailable card is rendered by `FeatureCard` as a `View`, not a disabled button, so
 * it is not a control in the accessibility tree either.
 */

/** §S18's "future cards": find people, Scene feed, events, housing and jobs. */
interface FeatureDefinition {
  key: string;
  title: string;
  description: string;
  /** Present when a server flag governs it; absent means it is not up for a vote either. */
  flag?: FeatureFlagKey;
  route?: string;
}

const FEATURES: FeatureDefinition[] = [
  {
    key: 'discovery_enabled',
    flag: 'discovery_enabled',
    title: 'Find your people',
    description: 'Students near you, from your state, on your course.',
  },
  {
    key: 'scene_feed_enabled',
    flag: 'scene_feed_enabled',
    title: 'The Scene',
    description: 'What is happening around Sydney this week.',
  },
  {
    key: 'events_enabled',
    title: 'Events',
    description: 'Meetups, festivals and things worth leaving the house for.',
  },
  {
    key: 'housing_enabled',
    title: 'Housing',
    description: 'Rooms, sharehouses and people looking for a flatmate.',
  },
  {
    key: 'jobs_enabled',
    title: 'Jobs',
    description: 'Casual work that fits around a student visa.',
  },
];

export function BetaHomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { flags } = useFlags();
  const userId = session?.userId;

  useEffect(() => {
    analytics.track('beta_home_viewed', { screen: 'S18' });
  }, []);

  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => registrationRepository.ensureProfile(userId!),
    enabled: userId !== undefined,
  });

  const goals = useQuery({
    queryKey: ['goals-summary', userId],
    queryFn: async () => {
      const [chosen, catalogue] = await Promise.all([
        profileRepository.listChosenGoals(userId!),
        profileRepository.listGoals(),
      ]);
      const labels = new Map(catalogue.map((entry) => [entry.code, entry.label]));
      return chosen.map((code) => labels.get(code) ?? code);
    },
    enabled: userId !== undefined,
  });

  const announcements = useQuery({
    queryKey: ['announcements'],
    queryFn: () => betaRepository.listAnnouncements(),
  });

  const votes = useQuery({
    queryKey: ['votes', userId],
    queryFn: () => betaRepository.listVotes(userId!),
    enabled: userId !== undefined,
  });

  const referral = useQuery({
    queryKey: ['referral', userId],
    queryFn: () => betaRepository.loadReferral(userId!),
    enabled: userId !== undefined,
  });

  /**
   * The bucket is private (§S14), so display goes through a short-lived signed URL. Keyed on
   * the path so replacing the photo refetches, and disabled while there is nothing to sign —
   * most accounts, since §S13 keeps the photo optional.
   */
  const avatarPath = profile.data?.avatarPath ?? null;
  const avatar = useQuery({
    queryKey: ['avatar-url', avatarPath],
    queryFn: () => profileRepository.avatarUrl(avatarPath!),
    enabled: avatarPath !== null,
  });

  const vote = async (featureKey: string, currentlyVoted: boolean) => {
    if (userId === undefined) return;

    await betaRepository.toggleVote(userId, featureKey, !currentlyVoted);
    // §14.3: the identifier, never free text and never who voted.
    if (!currentlyVoted) analytics.track('feature_vote_submitted', { featureKey });
    await queryClient.invalidateQueries({ queryKey: ['votes', userId] });
  };

  const refreshing =
    profile.isFetching || announcements.isFetching || votes.isFetching || referral.isFetching;

  const refreshAll = () => {
    void profile.refetch();
    void goals.refetch();
    void announcements.refetch();
    void votes.refetch();
    void referral.refetch();
  };

  const name = profile.data?.displayName ?? null;
  const votedKeys = new Set(votes.data ?? []);

  return (
    <AppScreen
      scrollable
      testID="beta-home"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshAll}
          tintColor={theme.textSecondary}
        />
      }
    >
      <View style={styles.body}>
        <KyaSceneWordmark />

        <View style={styles.greeting}>
          <StudentAvatar displayName={name} uri={avatar.data ?? undefined} testID="home-avatar" />
          <View style={styles.greetingText}>
            {/* §S18: "Personal greeting". The name arrived with S13; before that this screen
                would have had nobody to greet. */}
            <Text style={[typography.title, { color: theme.textPrimary }]} testID="home-greeting">
              {name === null ? 'Welcome back' : `Hi ${name}`}
            </Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              You are in the KyaScene beta.
            </Text>
          </View>
        </View>

        {/* §S18: "top selected goals" — what they told us they needed, shown back to them. */}
        {goals.data !== undefined && goals.data.length > 0 ? (
          <View style={styles.section}>
            <Text style={[typography.label, { color: theme.textSecondary }]}>
              What you are here for
            </Text>
            <Text style={[typography.body, { color: theme.textPrimary }]} testID="home-goals">
              {goals.data.join(' → ')}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[typography.label, { color: theme.textSecondary }]}>Announcements</Text>

          {announcements.isLoading ? (
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Loading…</Text>
          ) : (announcements.data ?? []).length === 0 ? (
            /* §6.6: a designed empty state, so "nothing yet" cannot be mistaken for a fault. */
            <EmptyState
              title="Nothing yet"
              body="We will post here when there is something worth telling you."
              testID="home-no-announcements"
            />
          ) : (
            (announcements.data ?? []).map((item) => (
              <View
                key={item.id}
                style={[styles.card, { backgroundColor: theme.backgroundElevated }]}
              >
                <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                  {item.title}
                </Text>
                <Text style={[typography.caption, { color: theme.textSecondary }]}>
                  {item.body}
                </Text>
              </View>
            ))
          )}
        </View>

        {flags.referrals_enabled ? (
          <View style={styles.section}>
            <Text style={[typography.label, { color: theme.textSecondary }]}>Your invitations</Text>
            <FeatureCard
              title="Invite friends"
              description={
                referral.data === null || referral.data === undefined
                  ? 'Bring people you know into the beta.'
                  : `${referral.data.remaining} of ${referral.data.capacity} invitations left.`
              }
              state="available"
              onPress={() => router.push('/invite-friends')}
              testID="home-referral"
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[typography.label, { color: theme.textSecondary }]}>Coming to KyaScene</Text>
          <Text style={[typography.caption, { color: theme.textSecondary }]}>
            None of these are built yet. Tap the ones you want first — it decides what we do next.
          </Text>

          {FEATURES.map((feature) => {
            const enabled = feature.flag !== undefined && flags[feature.flag];
            const voted = votedKeys.has(feature.key);

            return (
              <FeatureCard
                key={feature.key}
                title={feature.title}
                description={feature.description}
                state={enabled ? 'available' : 'voting'}
                voted={voted}
                onPress={() => {
                  if (enabled && feature.route !== undefined) {
                    router.push(feature.route);
                    return;
                  }
                  void vote(feature.key, voted);
                }}
                testID={`home-feature-${feature.key}`}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.actions}>
        {flags.feedback_enabled ? (
          <SecondaryButton
            label="Send feedback"
            onPress={() => router.push('/feedback')}
            testID="home-feedback"
          />
        ) : null}
        <TextButton
          label="Profile and settings"
          onPress={() => router.push('/settings')}
          testID="home-settings"
        />
        <PoweredBy1818 detail={bundleIdentity} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, flexGrow: 1 },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  greetingText: { flex: 1, gap: 2 },
  section: { gap: spacing.sm },
  card: { gap: spacing.xs, borderRadius: 18, padding: 16 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
