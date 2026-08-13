import { AppError } from '@kyascene/domain';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { SignInScreen } from '../screens/SignInScreen';

const mockPush = jest.fn();
const mockRequestCode = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({ requestCode: mockRequestCode }),
}));

const signInWith = async (address: string) => {
  const view = await render(<SignInScreen />);
  await fireEvent.changeText(view.getByTestId('sign-in-email'), address);
  await fireEvent.press(view.getByTestId('sign-in-submit'));
  return view;
};

describe('S02 — Email sign-in', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRequestCode.mockReset();
  });

  it('advances to the code screen with the normalised address', async () => {
    mockRequestCode.mockResolvedValue(undefined);

    await signInWith('  Asha@Example.COM ');

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(public)/verify-email',
        params: { email: 'asha@example.com' },
      });
    });
  });

  /**
   * The bug this covers: a rate limit stopped the flow dead, so a tester holding a valid code
   * had no route to the screen that accepts one — the only way in was a successful send.
   *
   * Codes last an hour, so "we could not send you a new one" says nothing about whether the
   * one in your inbox still works. Refusing to advance turned a temporary send failure into a
   * permanent lockout for the ordinary case of requesting a code, closing the app, and
   * coming back to it.
   */
  it('still reaches the code screen when a new code cannot be sent', async () => {
    mockRequestCode.mockRejectedValue(new AppError('RATE_LIMITED'));

    await signInWith('asha@example.com');

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(public)/verify-email',
        params: { email: 'asha@example.com', notSent: '1' },
      });
    });
  });

  /** Every other failure genuinely means no code exists, so those must not advance. */
  it.each(['NETWORK_UNAVAILABLE', 'UNKNOWN', 'VALIDATION_FAILED'] as const)(
    'stays put on %s',
    async (code) => {
      mockRequestCode.mockRejectedValue(new AppError(code));

      const view = await signInWith('asha@example.com');

      expect(mockPush).not.toHaveBeenCalled();
      expect(view.getByTestId('sign-in-email')).toBeTruthy();
    },
  );

  /**
   * The escape hatch that does not depend on classifying a failure correctly. Someone holding
   * a valid code must always be able to reach the screen that accepts one — a rate limit, a
   * flaky connection or an error we mapped wrongly all stranded them otherwise.
   */
  it('reaches the code screen directly, without sending anything', async () => {
    const view = await render(<SignInScreen />);
    await fireEvent.changeText(view.getByTestId('sign-in-email'), 'asha@example.com');
    await fireEvent.press(view.getByTestId('sign-in-have-code'));

    expect(mockRequestCode).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(public)/verify-email',
      params: { email: 'asha@example.com', notSent: '1' },
    });
  });

  it('will not take you to the code screen without a valid address', async () => {
    const view = await render(<SignInScreen />);
    await fireEvent.changeText(view.getByTestId('sign-in-email'), 'not-an-email');
    await fireEvent.press(view.getByTestId('sign-in-have-code'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('refuses an address that is not one, without calling the server', async () => {
    await signInWith('not-an-email');

    expect(mockRequestCode).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
