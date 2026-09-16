import { fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderWithProviders } from '@/test-support/render';

import { SettingsScreen } from '../screens/SettingsScreen';

const mockPush = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockPick = jest.fn();
const mockUploadAvatar = jest.fn();

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
      Promise.resolve({
        userId: 'user-1',
        displayName: 'Asha',
        avatarPath: null,
        status: 'approved',
      }),
  },
}));

jest.mock('@/services/avatar', () => ({
  avatarService: { pick: (...args: unknown[]) => mockPick(...args) },
}));

jest.mock('@/repositories/profile-repository', () => ({
  profileRepository: {
    uploadAvatar: (...args: unknown[]) => mockUploadAvatar(...args),
    avatarUrl: jest.fn().mockResolvedValue(null),
  },
}));

describe('S21 — Profile and settings', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSignOut.mockClear();
    mockPick.mockReset();
    mockUploadAvatar.mockReset().mockResolvedValue(undefined);
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

  /**
   * The photo saves the moment it is chosen — no Submit, no other screen.
   *
   * The registration flow's upload fires only when S16 is submitted, which an approved member
   * never reaches again. Two real people picked a photo, saw it previewed, and it went
   * nowhere: the bucket stayed empty because the one button that uploads was five screens
   * away behind "Edit your answers". This pins the replacement: pick here, uploaded here.
   */
  it('uploads a chosen photo immediately, with no further step', async () => {
    mockPick.mockResolvedValue({ status: 'picked', uri: 'file:///prepared.jpg' });

    const view = await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(view.getByTestId('settings-change-photo'));

    expect(await view.findByTestId('settings-photo-saved')).toBeTruthy();
    expect(mockUploadAvatar).toHaveBeenCalledWith('user-1', 'file:///prepared.jpg');
  });

  it('cancelling the picker uploads nothing and says nothing', async () => {
    mockPick.mockResolvedValue({ status: 'cancelled' });

    const view = await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(view.getByTestId('settings-change-photo'));

    expect(mockUploadAvatar).not.toHaveBeenCalled();
    expect(view.queryByTestId('settings-photo-saved')).toBeNull();
    expect(view.queryByTestId('settings-photo-failed')).toBeNull();
  });

  it('a denied photo permission explains itself instead of failing silently', async () => {
    mockPick.mockResolvedValue({ status: 'permission_denied', source: 'library' });

    const view = await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(view.getByTestId('settings-change-photo'));

    expect(await view.findByTestId('settings-photo-denied')).toBeTruthy();
    expect(mockUploadAvatar).not.toHaveBeenCalled();
  });

  /** A failed upload must say so — a silent null avatar_path already cost a debugging round. */
  it('says out loud when the upload fails', async () => {
    mockPick.mockResolvedValue({ status: 'picked', uri: 'file:///prepared.jpg' });
    mockUploadAvatar.mockRejectedValue(new Error('storage said no'));

    const view = await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(view.getByTestId('settings-change-photo'));

    expect(await view.findByTestId('settings-photo-failed')).toBeTruthy();
    expect(view.queryByTestId('settings-photo-saved')).toBeNull();
  });
});
