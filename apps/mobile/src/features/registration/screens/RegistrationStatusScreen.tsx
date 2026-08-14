import { REJECTION_CATEGORY_MESSAGES, type AccountStatus } from '@kyascene/domain';
import {
  AppScreen,
  KyaSceneWordmark,
  PoweredBy1818,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TextButton,
  type StatusTone,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { env } from '@/config/env';
import { useAuth } from '@/providers/AuthProvider';
import { profileRepository } from '@/repositories/profile-repository';
import { registrationRepository } from '@/repositories/registration-repository';
import { analytics } from '@/services/analytics';
import { bundleIdentity } from '@/services/build-identity';

/**
 * S17 — Registration status.
 *
 * §S17 acceptance: "Status refreshes on foreground and pull-to-refresh." Both are implemented,
 * because the state a student is waiting on changes while they are not looking at the app —
 * a screen that only fetches on mount tells them nothing has happened when it has.
 *
 * §S17: "Do not promise a review time unless operations can meet it." There is no "within 24
 * hours" anywhere on this screen. One founder reviewing by hand cannot commit to a number,
 * and a missed promise here is the first thing a tester would tell other people about.
 *
 * §S17 / §15.2: a rejected student sees a **category**, never the operator's notes. The
 * category is a closed enum and its wording lives in the domain package, so this screen has
 * no way to render an internal reason even by accident.
 */
const STATUS_TONE: Partial<Record<AccountStatus, StatusTone>> = {
  pending_review: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  suspended: 'suspended',
};

const STATUS_LABEL: Partial<Record<AccountStatus, string>> = {
  pending_review: 'With our team',
  approved: 'Approved',
  rejected: 'Not approved',
  suspended: 'On hold',
};

export function RegistrationStatusScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.userId;

  const status = useQuery({
    queryKey: ['account-status', userId],
    queryFn: () => (userId ? registrationRepository.getStatus(userId) : Promise.resolve(null)),
    enabled: userId !== undefined,
  });

  const review = useQuery({
    queryKey: ['review-state', userId],
    queryFn: () => (userId ? profileRepository.getReviewState(userId) : Promise.resolve(null)),
    enabled: userId !== undefined,
  });

  const refresh = useCallback(() => {
    void status.refetch();
    void review.refetch();
  }, [review, status]);

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S17' });
  }, []);

  // §S17: "Status refreshes on foreground." A decision made while the app was backgrounded is
  // the single most likely thing to have changed, and the tester is here precisely to find out.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const current = status.data ?? 'pending_review';
  const tone = STATUS_TONE[current] ?? 'pending';
  const label = STATUS_LABEL[current] ?? 'With our team';

  return (
    <AppScreen
      scrollable
      testID="status-screen"
      refreshControl={
        <RefreshControl
          refreshing={status.isFetching || review.isFetching}
          onRefresh={refresh}
          tintColor={theme.textSecondary}
        />
      }
    >
      <View style={styles.body}>
        <KyaSceneWordmark size="small" />

        <StatusBadge tone={tone} label={label} testID="status-badge" />

        {current === 'pending_review' ? (
          <View style={styles.section}>
            <Text style={[typography.title, { color: theme.textPrimary }]}>
              Your application is in.
            </Text>
            <Text style={[typography.body, { color: theme.textSecondary }]}>
              A real person reads every application. We will email you as soon as yours has been
              looked at.
            </Text>
            <Text style={[typography.body, { color: theme.textSecondary }]}>
              You can still change your answers while you wait.
            </Text>
          </View>
        ) : null}

        {current === 'approved' ? (
          <View style={styles.section}>
            <Text style={[typography.title, { color: theme.textPrimary }]}>You are in.</Text>
            <Text style={[typography.body, { color: theme.textSecondary }]}>
              Welcome to the KyaScene beta.
            </Text>
          </View>
        ) : null}

        {current === 'rejected' ? (
          <View style={styles.section}>
            <Text style={[typography.title, { color: theme.textPrimary }]}>
              We could not approve this one.
            </Text>
            <Text style={[typography.body, { color: theme.textSecondary }]}>
              {review.data?.rejectionCategory
                ? REJECTION_CATEGORY_MESSAGES[review.data.rejectionCategory]
                : 'We are unable to approve this account right now.'}
            </Text>
            <Text style={[typography.body, { color: theme.textSecondary }]}>
              If you think we have this wrong, get in touch — a person will read it.
            </Text>
          </View>
        ) : null}

        {current === 'suspended' ? (
          <View style={styles.section}>
            <Text style={[typography.title, { color: theme.textPrimary }]}>
              This account is on hold.
            </Text>
            <Text style={[typography.body, { color: theme.textSecondary }]}>
              Contact support and we will help sort it out.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {current === 'approved' ? (
          // Milestone 3 builds S18. Until it exists this button would lead nowhere, so it is
          // not rendered — §S18's own rule is that nothing unavailable should look tappable.
          <Text style={[typography.caption, { color: theme.textSecondary }]}>
            The beta home arrives in the next update.
          </Text>
        ) : null}

        {current === 'pending_review' ? (
          <SecondaryButton
            label="Review my answers"
            onPress={() => router.push('/review')}
            testID="status-review"
          />
        ) : null}

        <PrimaryButton
          label="Contact support"
          onPress={() => void Linking.openURL(env.EXPO_PUBLIC_SUPPORT_URL)}
          testID="status-support"
        />

        <TextButton label="Refresh" onPress={refresh} testID="status-refresh" />

        <PoweredBy1818 detail={bundleIdentity} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  section: { gap: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.xxl },
});
