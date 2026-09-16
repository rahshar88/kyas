import { DEFAULT_FEATURE_FLAGS, type FeatureFlagKey, type FeatureFlags } from '@kyascene/domain';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { betaRepository } from '@/repositories/beta-repository';

interface FlagsValue {
  flags: FeatureFlags;
  isLoading: boolean;
  isEnabled: (key: FeatureFlagKey) => boolean;
  refresh: () => Promise<void>;
}

const FlagsContext = createContext<FlagsValue | undefined>(undefined);

/**
 * Server-managed feature flags (§6.5), fail-closed.
 *
 * The state starts at `DEFAULT_FEATURE_FLAGS` — every value false — and stays there if the
 * fetch fails. That is the whole design: a flag fetch that fails while the app is offline, or
 * against a server that has never heard of a key, hides features rather than revealing
 * unfinished ones. §1.2's warning about building "future features shown in concept artwork"
 * has a runtime counterpart, and this is it.
 *
 * Deliberately not React Query, despite it being available. A cached "true" surviving a
 * feature being switched off is exactly the failure this exists to prevent, and the fetch is
 * one small row set on entry to the beta.
 *
 * There is no error state exposed. A screen cannot do anything useful with "we could not read
 * the flags" — everything is already off, which is the safe answer — and showing an error for
 * a background fetch of configuration would be noise on top of a working screen.
 */
export function FlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [isLoading, setIsLoading] = useState(true);

  const value = useMemo<FlagsValue>(() => {
    const refresh = async () => {
      setIsLoading(true);
      try {
        setFlags(await betaRepository.loadFlags());
      } catch {
        // Fail closed. Anything already fetched stays; anything unknown remains false.
        setFlags((current) => current);
      } finally {
        setIsLoading(false);
      }
    };

    return {
      flags,
      isLoading,
      isEnabled: (key) => flags[key],
      refresh,
    };
  }, [flags, isLoading]);

  useEffect(() => {
    void value.refresh();
    // Once, on mount. `value.refresh` is recreated whenever flags change, and depending on it
    // would refetch on every response — a loop that would look like a network problem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

export function useFlags(): FlagsValue {
  const context = useContext(FlagsContext);
  if (context === undefined) {
    throw new Error('useFlags must be used inside a FlagsProvider');
  }
  return context;
}
