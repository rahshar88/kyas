import { fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderWithProviders } from '@/test-support/render';

import { SettingsScreen } from '../screens/SettingsScreen';

const mockPush = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    session: { userId: 'user-1', email: 'asha@example.test', expiresAt: null },
    signOut: mockSignOut,
  }),
}));

jest.mock('@/repositories/registration-repository', () => ({
  registrationRepository: {
    ensureProfile: () =>
      Promise.resolve({ userId: 'user-1', displayName: 'Asha', status: 'approved' }),
  },
}));

describe('S21 — Profile and settings', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSignOut.mockClear();
  });

  /**
   * §S21 acceptance: **"Legal and account-deletion actions are available without searching
   * multiple menus."**
   *
   * Asserted as "all of it is on this screen", because the failure mode is gradual: someone
   * tidies the layout, moves deletion behind an Account sub-page, and the criterion is broken
   * by a change that looked like an improvement.
   */
  it('puts legal and deletion on the first screen, not behind a submenu', async () => {
    const view = await renderWithProviders(<SettingsScreen />);

    for (const testID of [
      'settings-privacy-policy',
      'settings-terms',
      'settings-support',
      'settings-delete',
    ]) {
      expect(view.getByTestId(testID)).toBeTruthy();
    }
  });

  it('opens the legal documents rather than describing them', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    const view = await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(view.getByTestId('settings-privacy-policy'));

    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('/privacy'));
    openURL.mockRestore();
  });

  it('routes to deletion', async () => {
    const view = await renderWithProviders(<SettingsScreen />);

    await fireEvent.press(view.getByTestId('settings-delete'));

    expect(mockPush).toHaveBeenCalledWith('/delete-account');
  });

  it('signs out', async () => {
    const view = await renderWithProviders(<SettingsScreen />);

    await fireEvent.press(view.getByTestId('settings-sign-out'));

    expect(mockSignOut).toHaveBeenCalled();
  });

  /** §S21: "beta version" — the first thing worth knowing when a tester reports a bug. */
  it('shows which build they are on', async () => {
    const view = await renderWithProviders(<SettingsScreen />);

    expect(view.getByTestId('settings-version')).toBeTruthy();
  });
});
