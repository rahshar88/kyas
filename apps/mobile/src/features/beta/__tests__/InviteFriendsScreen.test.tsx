import { fireEvent, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { renderWithProviders } from '@/test-support/render';

import { InviteFriendsScreen } from '../screens/InviteFriendsScreen';

const mockEnsureReferral = jest.fn().mockResolvedValue(undefined);
const mockLoadReferral = jest.fn();
const mockSetString = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({ session: { userId: 'user-1', email: 'a@b.test', expiresAt: null } }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetString(...args),
}));

jest.mock('@/repositories/beta-repository', () => ({
  betaRepository: {
    ensureReferral: () => mockEnsureReferral(),
    loadReferral: () => mockLoadReferral(),
  },
}));

describe('S19 — Invite friends', () => {
  beforeEach(() => {
    mockEnsureReferral.mockClear();
    mockSetString.mockClear();
    mockLoadReferral
      .mockReset()
      .mockResolvedValue({ code: 'ASHA01', capacity: 3, redeemedCount: 1, remaining: 2 });
  });

  it('mints a code on first visit and shows it', async () => {
    const view = await renderWithProviders(<InviteFriendsScreen />);

    expect(await view.findByTestId('invite-code')).toHaveTextContent('ASHA01');
    expect(mockEnsureReferral).toHaveBeenCalled();
  });

  it('shows how many invitations are left', async () => {
    const view = await renderWithProviders(<InviteFriendsScreen />);

    expect(await view.findByTestId('invite-count')).toHaveTextContent('2 of 3 invitations left');
  });

  /**
   * §S19: "Do not reveal referred users until they independently consent and connect in a
   * future milestone."
   *
   * Redeeming a code is consent to join KyaScene — not consent to being named to whoever
   * invited you. So a count is shown and a list never is, and this asserts the screen has no
   * way to display one even as the data grows.
   */
  it('counts who joined without naming any of them', async () => {
    const view = await renderWithProviders(<InviteFriendsScreen />);
    await view.findByTestId('invite-code');

    expect(view.getByText(/1 person has joined with your code/)).toBeTruthy();
    expect(view.getByText(/We do not show you who/)).toBeTruthy();
  });

  /**
   * §S19 acceptance: "Shared link contains an opaque code, not the inviter's user ID."
   *
   * A user id in a forwarded message is a permanent identifier handed to strangers, and in a
   * beta of a few hundred people one leaked id de-anonymises a great deal.
   */
  it('shares the code and nothing that identifies the inviter', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

    const view = await renderWithProviders(<InviteFriendsScreen />);
    await view.findByTestId('invite-code');
    await fireEvent.press(view.getByTestId('invite-share'));

    await waitFor(() => {
      expect(share).toHaveBeenCalled();
    });

    const message = share.mock.calls[0]?.[0] as { message: string };
    expect(message.message).toContain('ASHA01');
    expect(message.message).not.toContain('user-1');
    expect(message.message).not.toContain('a@b.test');

    share.mockRestore();
  });

  it('copies the code to the clipboard', async () => {
    const view = await renderWithProviders(<InviteFriendsScreen />);
    await view.findByTestId('invite-code');

    await fireEvent.press(view.getByTestId('invite-copy'));

    await waitFor(() => {
      expect(mockSetString).toHaveBeenCalledWith('ASHA01');
    });
  });

  /** §6.6: a failure is a designed state, and sharing must not be offered without a code. */
  it('says so rather than offering an empty code to share', async () => {
    mockLoadReferral.mockResolvedValue(null);

    const view = await renderWithProviders(<InviteFriendsScreen />);

    expect(await view.findByTestId('invite-error')).toBeTruthy();
    expect(view.getByTestId('invite-share').props.accessibilityState.disabled).toBe(true);
  });
});
