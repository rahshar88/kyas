import type { RegistrationDraft, RegistrationStep } from '@kyascene/domain';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';
import { draftRepository } from '@/repositories/draft-repository';

/**
 * Reads and writes the resumable registration draft (§6.3, §S06).
 *
 * Local-first by design. `saveStep` writes to the device and only then reports success, so a
 * student on a patchy train connection keeps every answer — §16.2's "offline save failure
 * preserves local answers". Pushing those answers to the server is a separate concern that
 * belongs to submission (Milestone 2), not to each keystroke.
 */
export function useDraft() {
  const { session } = useAuth();
  const userId = session?.userId;

  // Stored with the id it belongs to, so a change of user is handled by DERIVING null rather
  // than by setting state inside the effect — a synchronous setState in an effect body
  // triggers a cascading render, and would briefly show one tester another's answers.
  const [loaded, setLoaded] = useState<{ userId: string; draft: RegistrationDraft } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    void draftRepository.load(userId).then((next) => {
      if (!cancelled) setLoaded({ userId, draft: next });
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const draft = loaded !== null && loaded.userId === userId ? loaded.draft : null;

  /**
   * Records the answers for a step and marks it complete, in that order — so a crash between
   * the two leaves the answers saved but the step incomplete, which resumes correctly. The
   * reverse order would mark a step done with nothing behind it.
   */
  const saveStep = useCallback(
    async (
      step: RegistrationStep,
      change: Partial<Omit<RegistrationDraft, 'version' | 'updatedAt' | 'completed'>>,
    ) => {
      if (!userId) return;

      setIsLoading(true);
      try {
        await draftRepository.patch(userId, change);
        const next = await draftRepository.markComplete(userId, step);
        setLoaded({ userId, draft: next });
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  return { draft, isLoading, saveStep };
}
