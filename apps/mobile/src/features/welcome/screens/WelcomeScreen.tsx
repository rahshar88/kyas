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
import { useRouter } from 'expo-router';
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
 * Both actions lead to the same place. §S02 creates or recovers an account from one screen,
 * because telling the two apart would reveal whether an address is already registered.
 */
export function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();

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
          onPress={() => {
            analytics.track('auth_started', { screen: 'S01' });
            router.push('/(public)/sign-in');
          }}
        />
        <SecondaryButton
          label="I already have an account"
          testID="welcome-sign-in"
          onPress={() => {
            analytics.track('auth_started', { screen: 'S01', outcomeCode: 'RETURNING' });
            router.push('/(public)/sign-in');
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
