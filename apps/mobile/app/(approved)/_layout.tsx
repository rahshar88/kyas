import { canEnterBeta } from '@kyascene/domain';
import { Redirect, Stack } from 'expo-router';

import { FlagsProvider } from '@/providers/FlagsProvider';
import { useAuth } from '@/providers/AuthProvider';

/**
 * The `(approved)` group from §8.1 — S18 through S22, reachable only once an operator has
 * approved the registration.
 *
 * §8.2: "Route guards must be derived from server status, not only client state." So the
 * check is `canEnterBeta(status)` against the status the server reported, not a local flag
 * that survived a sign-out or a stale cache. An account suspended between launch and now is
 * turned away the next time this renders.
 *
 * While `status` is still null the group renders nothing rather than redirecting. Redirecting
 * on unknown would bounce an approved tester out to S17 for the moment between launch and the
 * status arriving — a flicker that reads as being thrown out of the app they were just in.
 *
 * `FlagsProvider` sits here rather than in the root layout because §6.5's flags describe what
 * exists inside the beta, and fetching them for someone who cannot reach the beta is a request
 * with no reader.
 */
export default function ApprovedLayout() {
  const { status } = useAuth();

  if (status === null) return null;
  if (!canEnterBeta(status)) return <Redirect href="/status" />;

  return (
    <FlagsProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </FlagsProvider>
  );
}
