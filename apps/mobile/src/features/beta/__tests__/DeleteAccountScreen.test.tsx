import { AppError } from '@kyascene/domain';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-support/render';

import { DeleteAccountScreen } from '../screens/DeleteAccountScreen';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockRequestDeletion = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: mockReplace }),
}));

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

jest.mock('@/repositories/beta-repository', () => ({
  betaRepository: {
    requestDeletion: (...args: unknown[]) => mockRequestDeletion(...args),
  },
}));

/**
 * S22 — Delete account.
 *
 * Every assertion here corresponds to a sentence in §S22, because this is the one screen where
 * being wrong is not recoverable in either direction: deleting an account somebody meant to
 * keep, or leaving one active that somebody meant to close.
 */
describe('S22 — Delete account', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockBack.mockClear();
    mockSignOut.mockClear();
    mockRequestDeletion.mockReset().mockResolvedValue(undefined);
  });

  /** §S22: "Explain effect." Before the control, not after it. */
  it('says what is lost before offering to do it', async () => {
    const view = await renderWithProviders(<DeleteAccountScreen />);

    expect(view.getByText(/Your account closes straight away/)).toBeTruthy();
    expect(view.getByText(/Your invitation code stops working/)).toBeTruthy();
  });

  /**
   * §S22: "Require a deliberate confirmation."
   *
   * The strongest form of this test is that opening the sheet is not enough — a person who
   * taps twice out of reflex, which is precisely how accidental deletions happen, must still
   * have deleted nothing.
   */
  it('does not delete anything on the first tap', async () => {
    const view = await renderWithProviders(<DeleteAccountScreen />);

    await fireEvent.press(view.getByTestId('delete-start'));

    expect(await view.findByTestId('delete-confirmation')).toBeTruthy();
    expect(mockRequestDeletion).not.toHaveBeenCalled();
  });

  it('will not confirm until the word is typed exactly', async () => {
    const view = await renderWithProviders(<DeleteAccountScreen />);
    await fireEvent.press(view.getByTestId('delete-start'));

    const confirm = await view.findByTestId('confirmation-confirm');
    await fireEvent.press(confirm);
    expect(mockRequestDeletion).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByTestId('confirmation-phrase'), 'DELET');
    await fireEvent.press(confirm);
    expect(mockRequestDeletion).not.toHaveBeenCalled();
  });

  /** §S22: "Sign out immediately after confirmed deletion." */
  it('deletes, signs out and leaves, in that order', async () => {
    const order: string[] = [];
    mockRequestDeletion.mockImplementation(async () => {
      order.push('requested');
    });
    mockSignOut.mockImplementation(async () => {
      order.push('signed-out');
    });

    const view = await renderWithProviders(<DeleteAccountScreen />);
    await fireEvent.press(view.getByTestId('delete-start'));
    await fireEvent.changeText(view.getByTestId('confirmation-phrase'), 'DELETE');
    await fireEvent.press(view.getByTestId('confirmation-confirm'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });

    // Signing out before navigating leaves no window in which a signed-in screen renders for
    // an account that has just been closed.
    expect(order).toEqual(['requested', 'signed-out']);
  });

  it('accepts the typed word regardless of case or stray spaces', async () => {
    const view = await renderWithProviders(<DeleteAccountScreen />);
    await fireEvent.press(view.getByTestId('delete-start'));
    await fireEvent.changeText(view.getByTestId('confirmation-phrase'), '  delete ');
    await fireEvent.press(view.getByTestId('confirmation-confirm'));

    await waitFor(() => {
      expect(mockRequestDeletion).toHaveBeenCalled();
    });
  });

  /**
   * A failure must not sign anyone out and must not claim anything happened. Someone whose
   * deletion failed still has an account, and telling them otherwise is the worst thing this
   * screen could get wrong.
   */
  it('keeps the account and says so when the request fails', async () => {
    mockRequestDeletion.mockRejectedValue(new AppError('NETWORK_UNAVAILABLE'));

    const view = await renderWithProviders(<DeleteAccountScreen />);
    await fireEvent.press(view.getByTestId('delete-start'));
    await fireEvent.changeText(view.getByTestId('confirmation-phrase'), 'DELETE');
    await fireEvent.press(view.getByTestId('confirmation-confirm'));

    await waitFor(() => {
      expect(view.getByText(/couldn't reach KyaScene/)).toBeTruthy();
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('leaves without doing anything when they change their mind', async () => {
    const view = await renderWithProviders(<DeleteAccountScreen />);

    await fireEvent.press(view.getByTestId('delete-cancel'));

    expect(mockBack).toHaveBeenCalled();
    expect(mockRequestDeletion).not.toHaveBeenCalled();
  });
});
