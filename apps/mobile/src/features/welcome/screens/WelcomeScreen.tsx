import {
  AppScreen,
  KyaSceneWordmark,
  PoweredBy1818,
  PrimaryButton,
  SecondaryButton,
  TextButton,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { env } from '@/config/env';
import { analytics } from '@/services/analytics';

/** §S01: "Include Connect, Discover and Belong." */
const PILLARS = [
  { title: 'Connect', body: 'Meet students from India who are studying near you.' },
  { title: 'Discover', body: 'Find the places, events and services that actually help.' },
  { title: 'Belong', body: 'A private community built around where you are from.' },
] as const;

/**
 * S01 — Welcome.
 *
 * Acceptance criterion from §S01: "The primary action is visible without scrolling on
 * supported phone sizes." The layout therefore keeps the primary action in a fixed footer
 * block rather than at the end of a scrolling column.
 *
 * "Join the beta" is intentionally inert in Milestone 0 — §21.2 forbids registration
 * business logic here, and §3.3 forbids anything incomplete from *looking* functional, so
 * it announces that the beta is invite-only rather than pretending to start a flow.
 */
export function WelcomeScreen() {
  const theme = useTheme();

  useEffect(() => {
    analytics.track('welcome_viewed', { screen: 'S01' });
  }, []);

  const openLegal = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <AppScreen testID="welcome-screen" scrollable>
      <View style={styles.header}>
        <KyaSceneWordmark />
        <Text style={[typography.heading, { color: theme.textPrimary }]}>
          The private community for students from India in Sydney.
        </Text>
      </View>

      <View style={styles.pillars}>
        {PILLARS.map((pillar) => (
          <View key={pillar.title} style={styles.pillar}>
            <Text style={[typography.bodyStrong, { color: theme.accent }]}>{pillar.title}</Text>
            <Text style={[typography.body, { color: theme.textSecondary }]}>{pillar.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Text style={[typography.caption, styles.centred, { color: theme.textSecondary }]}>
          The beta is free and invite-only.
        </Text>

        <PrimaryButton
          label="Join the beta"
          testID="welcome-join"
          accessibilityHint="Registration opens in a later beta release"
          onPress={() => {
            analytics.track('auth_started', { screen: 'S01' });
          }}
        />
        <SecondaryButton
          label="I already have an account"
          testID="welcome-sign-in"
          onPress={() => {
            analytics.track('auth_started', { screen: 'S01', outcomeCode: 'RETURNING' });
          }}
        />

        {/* §16.4 makes missing privacy or terms links a release blocker, so they are on
            the first screen a tester ever sees. */}
        <View style={styles.legal}>
          <TextButton
            label="Privacy"
            testID="welcome-privacy"
            onPress={() => openLegal(env.EXPO_PUBLIC_PRIVACY_URL)}
          />
          <TextButton
            label="Terms"
            testID="welcome-terms"
            onPress={() => openLegal(env.EXPO_PUBLIC_TERMS_URL)}
          />
        </View>

        <PoweredBy1818 />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.lg, marginBottom: spacing.xxl },
  pillars: { gap: spacing.lg, flexGrow: 1 },
  pillar: { gap: spacing.xs },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
  centred: { textAlign: 'center' },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
});
