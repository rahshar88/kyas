import { Stack } from 'expo-router';

/**
 * The `(public)` group from §8.1 — reachable with no session. Milestone 0 ships `welcome`;
 * `sign-in`, `verify-email` and the legal routes arrive with Milestone 1.
 */
export default function PublicLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
