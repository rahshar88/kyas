import { isAppError } from '@kyascene/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * Server state (§6.3: "Remote persistent state: TanStack Query and repositories").
 *
 * The retry rule is the part worth reading. Retrying a request that failed because the code
 * was wrong, or the session expired, wastes the tester's time and — for OTP requests — burns
 * against the server's rate limit (§12.5). So only genuinely transient failures retry.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry(failureCount, error) {
          if (failureCount >= 2) return false;
          if (!isAppError(error)) return false;
          return error.code === 'NETWORK_UNAVAILABLE';
        },
      },
      mutations: {
        // Never retry a mutation automatically. Registration submission and invite
        // redemption are idempotent server-side (§12.4), but a silent retry would still
        // hide a real failure from the tester rather than letting them decide.
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
