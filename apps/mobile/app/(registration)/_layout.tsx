import { Stack } from 'expo-router';

/**
 * The `(registration)` group from §8.1 — reachable once a session exists but registration is
 * not yet submitted. Milestone 1 ships S04 through S08; S09–S17 arrive with Milestone 2.
 *
 * `gestureEnabled: false` on the invite step is deliberate: swiping back from there would
 * land on a signed-in dead end, since sign-in already succeeded.
 */
export default function RegistrationLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
