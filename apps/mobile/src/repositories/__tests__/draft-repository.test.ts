import AsyncStorage from '@react-native-async-storage/async-storage';
import { REGISTRATION_DRAFT_VERSION } from '@kyascene/domain';

import { draftRepository } from '../draft-repository';

const USER = 'user-1';
const OTHER_USER = 'user-2';
const KEY = `kyascene.registration-draft.${USER}`;

describe('registration draft (§6.3, §S06)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts empty for a new tester', async () => {
    const draft = await draftRepository.load(USER);

    expect(draft.version).toBe(REGISTRATION_DRAFT_VERSION);
    expect(draft.completed).toEqual([]);
  });

  /** §S06 acceptance: "Draft saves after valid field changes and survives app restart." */
  it('survives a restart', async () => {
    await draftRepository.patch(USER, {
      eligibility: {
        isEighteenOrOlder: true,
        isFromIndia: true,
        isStudyingOrOffered: true,
        hasSydneyConnection: true,
      },
    });

    // A fresh read is exactly what a relaunch does — nothing is held in memory.
    const reloaded = await draftRepository.load(USER);
    expect(reloaded.eligibility?.isFromIndia).toBe(true);
  });

  it('records completed steps without duplicating them', async () => {
    await draftRepository.markComplete(USER, 'eligibility');
    await draftRepository.markComplete(USER, 'eligibility');
    const draft = await draftRepository.markComplete(USER, 'study');

    expect(draft.completed).toEqual(['eligibility', 'study']);
  });

  /**
   * A shared phone in a student sharehouse is a real scenario, and one tester's answers
   * appearing in another's form would be both confusing and a privacy failure.
   */
  it('keeps one tester’s answers out of another’s form', async () => {
    await draftRepository.markComplete(USER, 'eligibility');

    const other = await draftRepository.load(OTHER_USER);
    expect(other.completed).toEqual([]);
  });

  describe('unusable stored data', () => {
    it('discards a draft written by a different app version', async () => {
      await AsyncStorage.setItem(
        KEY,
        JSON.stringify({ version: 999, completed: ['study'], updatedAt: 'x' }),
      );

      const draft = await draftRepository.load(USER);
      expect(draft.completed).toEqual([]);
      expect(draft.version).toBe(REGISTRATION_DRAFT_VERSION);
    });

    it('recovers from corrupt JSON rather than crashing on launch', async () => {
      await AsyncStorage.setItem(KEY, '{not json');

      const draft = await draftRepository.load(USER);
      expect(draft.completed).toEqual([]);
    });

    it('removes the unusable value so it cannot be re-read', async () => {
      await AsyncStorage.setItem(KEY, JSON.stringify({ version: 999 }));
      await draftRepository.load(USER);

      expect(await AsyncStorage.getItem(KEY)).toBeNull();
    });
  });

  it('clears everything on request (§11.4)', async () => {
    await draftRepository.markComplete(USER, 'eligibility');
    await draftRepository.clear(USER);

    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect((await draftRepository.load(USER)).completed).toEqual([]);
  });
});
