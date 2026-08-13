import { emptyDraft, type RegistrationDraft } from '@kyascene/domain';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-support/render';

import { ReviewScreen } from '../screens/ReviewScreen';

const mockReplace = jest.fn();
const mockPush = jest.fn();

const mockSaveDisplayName = jest.fn().mockResolvedValue(undefined);
const mockSaveStudyDetails = jest.fn().mockResolvedValue(undefined);
const mockSaveSydneyLocation = jest.fn().mockResolvedValue(undefined);
const mockSaveIndiaBackground = jest.fn().mockResolvedValue(undefined);
const mockSaveLanguages = jest.fn().mockResolvedValue(undefined);
const mockSaveInterests = jest.fn().mockResolvedValue(undefined);
const mockSubmit = jest.fn().mockResolvedValue({ outcome: 'submitted' });

// `mock`-prefixed so jest.mock's factory may reference it — the guard against uninitialised
// mock variables allows only that prefix.
const mockDraft: RegistrationDraft = {
  ...emptyDraft('2026-08-13T00:00:00.000Z'),
  displayName: 'Asha',
  study: {
    provider: 'usyd',
    course: 'Masters in AI',
    studyLevel: 'master',
    intakeMonth: 2,
    intakeYear: 2026,
    completionMonth: 11,
    completionYear: 2027,
  },
  sydneyLocation: { suburb: 'Ultimo', arrivalStatus: 'in_sydney', suburbVisible: false },
  indiaBackground: {
    stateCode: 'IN-PB',
    hometown: 'Mohali',
    stateVisible: false,
    hometownVisible: false,
  },
  languages: [{ code: 'hindi', proficiency: 'native' }],
  interests: ['cricket', 'movies', 'startups'],
  goals: ['meet_people'],
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: mockReplace }),
}));

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({ session: { userId: 'user-1', email: 'a@b.test', expiresAt: null } }),
}));

jest.mock('@/features/registration/hooks/useDraft', () => ({
  useDraft: () => ({ draft: mockDraft, isLoading: false, saveStep: jest.fn(), patch: jest.fn() }),
}));

jest.mock('@/repositories/registration-repository', () => ({
  registrationRepository: {
    saveStudyDetails: (...args: unknown[]) => mockSaveStudyDetails(...args),
    saveSydneyLocation: (...args: unknown[]) => mockSaveSydneyLocation(...args),
    saveIndiaBackground: (...args: unknown[]) => mockSaveIndiaBackground(...args),
    listIndiaStates: () => Promise.resolve([{ code: 'IN-PB', name: 'Punjab' }]),
    listEducationProviders: () => Promise.resolve([{ code: 'usyd', name: 'University of Sydney' }]),
  },
}));

jest.mock('@/repositories/profile-repository', () => ({
  profileRepository: {
    saveDisplayName: (...args: unknown[]) => mockSaveDisplayName(...args),
    saveLanguages: (...args: unknown[]) => mockSaveLanguages(...args),
    saveCommunities: jest.fn().mockResolvedValue(undefined),
    saveInterests: (...args: unknown[]) => mockSaveInterests(...args),
    saveGoals: jest.fn().mockResolvedValue(undefined),
    saveVisibility: jest.fn().mockResolvedValue(undefined),
    saveConsents: jest.fn().mockResolvedValue(undefined),
    submit: () => mockSubmit(),
    listLanguages: () => Promise.resolve([{ code: 'hindi', label: 'Hindi' }]),
    listCommunities: () => Promise.resolve([{ code: 'punjabi', label: 'Punjabi' }]),
    listInterests: () =>
      Promise.resolve([
        { code: 'cricket', label: 'Cricket' },
        { code: 'movies', label: 'Movies' },
        { code: 'startups', label: 'Startups' },
      ]),
    listGoals: () => Promise.resolve([{ code: 'meet_people', label: 'Meet people' }]),
  },
}));

describe('S16 — Review profile', () => {
  beforeEach(() => {
    for (const fn of [
      mockReplace,
      mockPush,
      mockSaveDisplayName,
      mockSaveStudyDetails,
      mockSaveSydneyLocation,
      mockSaveIndiaBackground,
      mockSaveLanguages,
      mockSaveInterests,
      mockSubmit,
    ]) {
      fn.mockClear();
    }
  });

  /**
   * The bug this exists for: the Milestone 1 screens wrote study details, suburb and Indian
   * state to the local draft only. The repository methods that persist them were written and
   * never called from anywhere, so `student_profiles` had no row and the server reported all
   * four Milestone 1 steps as unfinished — while this screen displayed them, filled in,
   * directly above the error. Nobody could mockSubmit a registration.
   *
   * Asserting the calls rather than the outcome is deliberate: the failure was silent absence,
   * and only "was it sent at all" catches that.
   */
  it('sends the Milestone 1 answers to the server before submitting', async () => {
    const view = await renderWithProviders(<ReviewScreen />);
    await fireEvent.press(view.getByTestId('review-submit'));

    await waitFor(() => {
      expect(mockSaveDisplayName).toHaveBeenCalledWith('user-1', 'Asha');
      expect(mockSaveStudyDetails).toHaveBeenCalledWith('user-1', mockDraft.study);
      expect(mockSaveSydneyLocation).toHaveBeenCalledWith('user-1', mockDraft.sydneyLocation);
      expect(mockSaveIndiaBackground).toHaveBeenCalledWith('user-1', mockDraft.indiaBackground);
    });
  });

  it('sends the Milestone 2 answers too, then submits', async () => {
    const view = await renderWithProviders(<ReviewScreen />);
    await fireEvent.press(view.getByTestId('review-submit'));

    await waitFor(() => {
      expect(mockSaveLanguages).toHaveBeenCalledWith('user-1', mockDraft.languages);
      expect(mockSaveInterests).toHaveBeenCalledWith('user-1', mockDraft.interests);
      expect(mockSubmit).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/status');
    });
  });

  /** §S16 is for inspecting answers, which requires them to be readable. */
  it('shows what the student chose, not the codes it is stored under', async () => {
    const view = await renderWithProviders(<ReviewScreen />);

    expect(await view.findByText('University of Sydney')).toBeTruthy();
    expect(view.getByText('Asha')).toBeTruthy();
    expect(view.getByText('Punjab')).toBeTruthy();
    expect(view.getByText('Meet people')).toBeTruthy();
    expect(view.getByText('Cricket, Movies, Startups')).toBeTruthy();

    expect(view.queryByText('usyd')).toBeNull();
    expect(view.queryByText('IN-PB')).toBeNull();
    expect(view.queryByText('meet_people')).toBeNull();
  });

  /** §S16: a server rejection has to be actionable, not just visible. */
  it('turns the server list of unfinished steps into navigation', async () => {
    mockSubmit.mockResolvedValueOnce({ outcome: 'incomplete', missing: ['study', 'consent'] });

    const view = await renderWithProviders(<ReviewScreen />);
    await fireEvent.press(view.getByTestId('review-submit'));

    const link = await view.findByTestId('review-missing-study');
    await fireEvent.press(link);

    expect(mockPush).toHaveBeenCalledWith('/study');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
