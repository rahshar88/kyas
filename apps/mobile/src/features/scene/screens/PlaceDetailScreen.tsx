import {
  AppHeader,
  AppScreen,
  EmptyState,
  PoweredBy1818,
  SecondaryButton,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { DiagnosticDetail } from '@/components/DiagnosticDetail';
import { sceneRepository } from '@/repositories/scene-repository';
import { bundleIdentity } from '@/services/build-identity';

/**
 * A single Scene listing (ADR-0007). Public, like the directory it belongs to.
 *
 * Every row is optional except the name and suburb, so the layout is a list of the facts
 * that exist rather than a form with gaps — a listing with no phone simply has no phone row,
 * not an empty one (§6.6's designed-states rule applied to data instead of failures).
 */
export function PlaceDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const place = useQuery({
    queryKey: ['scene-place', id],
    queryFn: () => sceneRepository.getPlace(id!),
    enabled: id !== undefined,
  });

  return (
    <AppScreen scrollable testID="place-screen">
      <View style={styles.body}>
        <AppHeader
          title={place.data?.name ?? 'Place'}
          subtitle={place.data === null || place.data === undefined ? undefined : `${place.data.suburb}, ${place.data.stateCode}`}
          onBack={() => router.back()}
        />

        {place.error != null ? (
          <>
            <EmptyState
              title="This listing did not load"
              body="Check your connection and try again."
              testID="place-error"
            />
            <DiagnosticDetail error={place.error} testID="place-diagnostic" />
          </>
        ) : place.isLoading ? (
          <Text style={[typography.caption, { color: theme.textSecondary }]}>Loading…</Text>
        ) : place.data === null ? (
          /* A retired listing's link keeps working as a calm dead end, not an error. */
          <EmptyState
            title="No longer listed"
            body="This place has been removed from the Scene."
            testID="place-gone"
          />
        ) : place.data === undefined ? null : (
          <View style={styles.facts}>
            {place.data.description === null ? null : (
              <Text style={[typography.body, { color: theme.textPrimary }]} testID="place-description">
                {place.data.description}
              </Text>
            )}
            {place.data.address === null ? null : (
              <View style={styles.fact}>
                <Text style={[typography.label, { color: theme.textSecondary }]}>Address</Text>
                <Text style={[typography.body, { color: theme.textPrimary }]}>
                  {place.data.address}
                </Text>
              </View>
            )}
            {place.data.phone === null ? null : (
              <SecondaryButton
                label={`Call ${place.data.phone}`}
                onPress={() => void Linking.openURL(`tel:${place.data?.phone ?? ''}`)}
                testID="place-call"
              />
            )}
            {place.data.url === null ? null : (
              <SecondaryButton
                label="Open website"
                onPress={() => void Linking.openURL(place.data?.url ?? '')}
                testID="place-website"
              />
            )}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <PoweredBy1818 detail={bundleIdentity} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, flexGrow: 1 },
  facts: { gap: spacing.lg },
  fact: { gap: 2 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
