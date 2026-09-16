import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emptyDraft,
  isDraftUsable,
  type RegistrationDraft,
  type RegistrationStep,
} from '@kyascene/domain';

/**
 * The resumable registration draft on disk (§6.3, §S06, §10.2).
 *
 * §S06 acceptance: "Draft saves after valid field changes and survives app restart."
 * §16.2 requires that "offline save failure preserves local answers" — which is exactly why
 * the draft is local-first. Answers are written to the device as they are entered and pushed
 * to the server separately; losing the network loses the sync, never the typing.
 *
 * AsyncStorage rather than SecureStore: a draft holds a course name and a suburb, not a
 * credential. §13.1 scopes SecureStore to "refresh/session secrets", and the keychain is a
 * poor fit for a value rewritten on every keystroke-settled field.
 *
 * The draft is per-user. Keying on the user id stops one tester's answers appearing in
 * another's form on a shared device, which is a real scenario in a student sharehouse.
 */
const KEY_PREFIX = 'kyascene.registration-draft';

const keyFor = (userId: string) => `${KEY_PREFIX}.${userId}`;

export interface DraftRepository {
  load(userId: string): Promise<RegistrationDraft>;
  save(userId: string, draft: RegistrationDraft): Promise<void>;
  patch(
    userId: string,
    change: Partial<Omit<RegistrationDraft, 'version' | 'updatedAt'>>,
  ): Promise<RegistrationDraft>;
  markComplete(userId: string, step: RegistrationStep): Promise<RegistrationDraft>;
  clear(userId: string): Promise<void>;
}

function now(): string {
  return new Date().toISOString();
}

export const draftRepository: DraftRepository = {
  /**
   * Returns a usable draft, always. A draft written by an older app version is discarded
   * rather than migrated — see the reasoning on `isDraftUsable`.
   */
  async load(userId: string): Promise<RegistrationDraft> {
    try {
      const raw = await AsyncStorage.getItem(keyFor(userId));
      if (raw === null) return emptyDraft(now());

      const parsed: unknown = JSON.parse(raw);
      if (!isDraftUsable(parsed)) {
        await AsyncStorage.removeItem(keyFor(userId));
        return emptyDraft(now());
      }

      return parsed;
    } catch {
      // Corrupt JSON or an unreadable store. Starting fresh is recoverable; crashing on
      // launch is not.
      return emptyDraft(now());
    }
  },

  async save(userId: string, draft: RegistrationDraft): Promise<void> {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify({ ...draft, updatedAt: now() }));
  },

  async patch(userId, change): Promise<RegistrationDraft> {
    const current = await draftRepository.load(userId);
    const next: RegistrationDraft = { ...current, ...change, updatedAt: now() };
    await draftRepository.save(userId, next);
    return next;
  },

  async markComplete(userId, step): Promise<RegistrationDraft> {
    const current = await draftRepository.load(userId);
    if (current.completed.includes(step)) return current;

    const next: RegistrationDraft = {
      ...current,
      completed: [...current.completed, step],
      updatedAt: now(),
    };
    await draftRepository.save(userId, next);
    return next;
  },

  /** Called after a successful submission, and on sign-out (§11.4). */
  async clear(userId: string): Promise<void> {
    await AsyncStorage.removeItem(keyFor(userId));
  },
};
