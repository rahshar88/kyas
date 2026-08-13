import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@kyascene/domain';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-support/render';

import { BetaHomeScreen } from '../screens/BetaHomeScreen';

const mockPush = jest.fn();
const mockToggleVote = jest.fn().mockResolvedValue(undefined);
const mockFlags: { current: FeatureFlags } = { current: { ...DEFAULT_FEATURE_FLAGS } };
const mockAnnouncements: { current: unknown[] } = { current: [] };
const mockVotes: { current: string[] } = { current: [] };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({ session: { userId: 'user-1', email: 'a@b.test', expiresAt: null } }),
}));

jest.mock('@/providers/FlagsProvider', () => ({
  useFlags: () => ({ flags: mockFlags.current, isLoading: false, isEnabled: () => false }),
}));

jest.mock('@/repositories/registration-repository', () => ({
  registrationRepository: {
    ensureProfile: () =>
      Promise.resolve({ userId: 'user-1', displayName: 'Asha', status: 'approved' }),
  },
}));

jest.mock('@/repositories/profile-repository', () => ({
  profileRepository: {
    listChosenGoals: () => Promise.resolve(['meet_people', 'find_events']),
    listGoals: () =>
      Promise.resolve([
        { code: 'meet_people', label: 'Meet people' },
        { code: 'find_events', label: 'Find events' },
      ]),
  },
}));

jest.mock('@/repositories/beta-repository', () => ({
  betaRepository: {
    listAnnouncements: () => Promise.resolve(mockAnnouncements.current),
    listVotes: () => Promise.resolve(mockVotes.current),
    toggleVote: (...args: unknown[]) => mockToggleVote(...args),
    loadReferral: () =>
      Promise.resolve({ code: 'ASHA01', capacity: 3, redeemedCount: 1, remaining: 2 }),
  },
}));

describe('S18 — Beta home', () => {
  beforeEach(() => {
    mockFlags.current = { ...DEFAULT_FEATURE_FLAGS };
    mockAnnouncements.current = [];
    mockVotes.current = [];
    mockPush.mockClear();
    mockToggleVote.mockClear();
  });

  /** §S18: "Personal greeting". The reason S13 had to start collecting a name. */
  it('greets the tester by name', async () => {
    const view = await renderWithProviders(<BetaHomeScreen />);

    expect(await view.findByText('Hi Asha')).toBeTruthy();
  });

  /** §S18: "top selected goals", in the order they ranked them on S12. */
  it('shows back what they said they came for, in their order', async () => {
    const view = await renderWithProviders(<BetaHomeScreen />);

    expect(await view.findByText('Meet people → Find events')).toBeTruthy();
  });

  /**
   * §S18's acceptance criterion, at the screen level: **"enabled features are controlled by
   * server flags"**. With every flag false — which is also what a failed fetch produces —
   * nothing that is not built may present itself as usable.
   */
  it('offers no route into a feature whose flag is off', async () => {
    const view = await renderWithProviders(<BetaHomeScreen />);
    await view.findByText('Hi Asha');

    // referrals_enabled is false here, so the invitations card must not exist at all.
    expect(view.queryByTestId('home-referral')).toBeNull();
    expect(view.queryByTestId('home-feedback')).toBeNull();
  });

  it('shows the invitations card once the server enables referrals', async () => {
    mockFlags.current = { ...DEFAULT_FEATURE_FLAGS, referrals_enabled: true };

    const view = await renderWithProviders(<BetaHomeScreen />);

    const card = await view.findByTestId('home-referral');
    await fireEvent.press(card);

    expect(mockPush).toHaveBeenCalledWith('/invite-friends');
  });

  /** §S18 feature voting. The vote is the point of showing an unbuilt feature at all. */
  it('records a vote for something that does not exist yet', async () => {
    const view = await renderWithProviders(<BetaHomeScreen />);

    await fireEvent.press(await view.findByTestId('home-feature-events_enabled'));

    await waitFor(() => {
      expect(mockToggleVote).toHaveBeenCalledWith('user-1', 'events_enabled', true);
    });
    // Voting must never navigate — there is nothing to navigate to.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('withdraws a vote already cast', async () => {
    mockVotes.current = ['events_enabled'];

    const view = await renderWithProviders(<BetaHomeScreen />);

    await waitFor(() => {
      expect(view.getByTestId('home-feature-events_enabled').props.accessibilityLabel).toContain(
        'You voted for this',
      );
    });

    await fireEvent.press(view.getByTestId('home-feature-events_enabled'));

    await waitFor(() => {
      expect(mockToggleVote).toHaveBeenCalledWith('user-1', 'events_enabled', false);
    });
  });

  /** §6.6: an empty list is a designed state, not a blank area that reads as a fault. */
  it('explains an empty announcement list rather than showing nothing', async () => {
    const view = await renderWithProviders(<BetaHomeScreen />);

    expect(await view.findByTestId('home-no-announcements')).toBeTruthy();
  });

  it('shows announcements when there are some', async () => {
    mockAnnouncements.current = [
      { id: '1', title: 'Welcome', body: 'Thanks for being early.', publishedAt: '2026-08-14' },
    ];

    const view = await renderWithProviders(<BetaHomeScreen />);

    expect(await view.findByText('Welcome')).toBeTruthy();
    expect(view.queryByTestId('home-no-announcements')).toBeNull();
  });
});
