import { Stack } from 'expo-router';

/**
 * The `(scene)` group — the public directory (ADR-0007).
 *
 * No guard, deliberately: this is the one part of the product that §8.1's "reachable with no
 * session" applies to as a feature rather than a necessity. Both audiences (strangers and
 * signed-in students) share these routes; the screens read the session themselves to decide
 * between a sign-in door and a Back control.
 */
export default function SceneLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
