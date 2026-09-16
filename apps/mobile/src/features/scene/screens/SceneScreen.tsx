import {
  AppScreen,
  EmptyState,
  KyaSceneWordmark,
  PoweredBy1818,
  PrimaryButton,
  TextButton,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { DiagnosticDetail } from '@/components/DiagnosticDetail';
import { useAuth } from '@/providers/AuthProvider';
import { sceneRepository, type ScenePlace } from '@/repositories/scene-repository';
import { analytics } from '@/services/analytics';
import { bundleIdentity } from '@/services/build-identity';

/**
 * The Scene — the public directory (ADR-0007).
 *
 * The first screen in the app that renders without a session. Two audiences share it:
 *
 *   * A stranger, for whom this is the shop window — real, useful content before any
 *     sign-in wall, with one clearly-marked door into the student side.
 *   * A signed-in student, who reached it from home and gets a Back control instead of
 *     a sign-in pitch.
 *
 * The distinction is the session, never a prop: the same route serves both, which is the
 * locked mechanism (sign-in state decides, no chooser).
 */
export function SceneScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const signedIn = session !== null;

  useEffect(() => {
    // §14.3: no query text, no place ids — just that the surface was seen, and by which
    // audience, since public reach is the whole point of measuring this screen.
    analytics.track('scene_viewed', { audience: signedIn ? 'student' : 'public' });
  }, [signedIn]);

  const categories = useQuery({
    queryKey: ['scene-categories'],
    queryFn: () => sceneRepository.listCategories(),
  });
  const places = useQuery({
    queryKey: ['scene-places'],
    queryFn: () => sceneRepository.listPlaces(),
  });

  /** Category order comes from the catalogue; places already arrive sorted within it. */
  const sections = useMemo(() => {
    if (categories.data === undefined || places.data === undefined) return [];
    const byCategory = new Map<string, ScenePlace[]>();
    for (const place of places.data) {
      const list = byCategory.get(place.categoryCode) ?? [];
      list.push(place);
      byCategory.set(place.categoryCode, list);
    }
    return categories.data
      .map((category) => ({ ...category, places: byCategory.get(category.code) ?? [] }))
      .filter((section) => section.places.length > 0);
  }, [categories.data, places.data]);

  const loading = categories.isLoading || places.isLoading;
  const failure = categories.error ?? places.error;

  return (
    <AppScreen
      scrollable
      testID="scene-screen"
      refreshControl={
        <RefreshControl
          refreshing={categories.isFetching || places.isFetching}
          onRefresh={() => {
            void categories.refetch();
            void places.refetch();
          }}
          tintColor={theme.textSecondary}
        />
      }
    >
      <View style={styles.body}>
        <KyaSceneWordmark />

        <View style={styles.intro}>
          <Text style={[typography.title, { color: theme.textPrimary }]} testID="scene-title">
            The Scene
          </Text>
          <Text style={[typography.body, { color: theme.textSecondary }]}>
            Indian places and services around Sydney — groceries, food, mandirs and gurdwaras.
            Open to everyone.
          </Text>
        </View>

        {failure != null ? (
          <>
            <EmptyState
              title="The Scene did not load"
              body="Check your connection and pull down to try again."
              testID="scene-error"
            />
            <DiagnosticDetail error={failure} testID="scene-diagnostic" />
          </>
        ) : loading ? (
          <Text style={[typography.caption, { color: theme.textSecondary }]}>Loading…</Text>
        ) : sections.length === 0 ? (
          <EmptyState
            title="Nothing listed yet"
            body="The directory is being curated. Check back soon."
            testID="scene-empty"
          />
        ) : (
          sections.map((section) => (
            <View key={section.code} style={styles.section}>
              <Text style={[typography.label, { color: theme.textSecondary }]}>
                {section.label}
              </Text>
              {section.places.map((place) => (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${place.name}, ${place.suburb}`}
                  onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}
                  style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}
                  testID={`scene-place-${place.id}`}
                >
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                    {place.name}
                  </Text>
                  <Text style={[typography.caption, { color: theme.textSecondary }]}>
                    {place.suburb}
                    {place.description === null ? '' : ` — ${place.description}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </View>

      <View style={styles.actions}>
        {signedIn ? (
          <TextButton label="Back" onPress={() => router.back()} testID="scene-back" />
        ) : (
          <>
            {/* The one door into the private side. §S02 takes it from here. */}
            <PrimaryButton
              label="Students — sign in"
              onPress={() => router.push('/welcome')}
              testID="scene-sign-in"
            />
            <Text style={[typography.caption, { color: theme.textSecondary, textAlign: 'center' }]}>
              KyaScene students is a private, invited community. The directory above is for
              everyone — no account needed.
            </Text>
          </>
        )}
        <PoweredBy1818 detail={bundleIdentity} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, flexGrow: 1 },
  intro: { gap: spacing.xs },
  section: { gap: spacing.sm },
  card: {
    gap: 2,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 16,
  },
  pressed: { opacity: 0.75 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
