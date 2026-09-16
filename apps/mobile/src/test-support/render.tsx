import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

/**
 * Renders a screen with the providers the real app supplies.
 *
 * Any screen reading a reference catalogue uses `useQuery`, which throws "No QueryClient set"
 * without a provider — a failure that points at the library rather than at the missing
 * wrapper, and costs a few minutes every time someone meets it.
 *
 * A fresh client per render, with retries off: a test asserting an error state should see it
 * immediately rather than after three silent retries, and shared cache between tests is a
 * classic source of results that depend on file order.
 *
 * Lives in `src/test-support/` rather than `src/test/` only because everything under
 * `apps/mobile/app/` is a route — this is outside it, but the naming keeps the distinction
 * obvious to anyone scanning the tree.
 */
export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper });
}
