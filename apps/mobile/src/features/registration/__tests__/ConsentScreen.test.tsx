import { CURRENT_POLICY_VERSION, REQUIRED_CONSENTS } from '@kyascene/domain';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ConsentScreen } from '../screens/ConsentScreen';

const mockPush = jest.fn();
const mockSaveStep = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/features/registration/hooks/useDraft', () => ({
  useDraft: () => ({ draft: null, isLoading: false, saveStep: mockSaveStep, patch: jest.fn() }),
}));

const renderScreen = () => render(<ConsentScreen />);

const acceptAllRequired = async (view: Awaited<ReturnType<typeof renderScreen>>) => {
  for (const policy of REQUIRED_CONSENTS) {
    await fireEvent.press(view.getByTestId(`consent-${policy}`));
  }
};

/**
 * §S15: "Required and optional consent must never be bundled."
 *
 * The failure this guards against is not a crash — it is a product that quietly makes
 * marketing consent a condition of joining, which is both a dark pattern and, in several
 * jurisdictions, unlawful. It is also trivially easy to introduce: one loop over a combined
 * list of policies does it.
 */
describe('S15 — Terms, privacy and beta consent', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSaveStep.mockClear();
  });

  it('blocks continuing until every required policy is accepted', async () => {
    const view = await renderScreen();

    expect(view.getByTestId('consent-continue').props.accessibilityState.disabled).toBe(true);

    await acceptAllRequired(view);

    expect(view.getByTestId('consent-continue').props.accessibilityState.disabled).toBe(false);
  });

  it.each(REQUIRED_CONSENTS)('stays blocked while %s is unaccepted', async (missing) => {
    const view = await renderScreen();

    for (const policy of REQUIRED_CONSENTS) {
      if (policy !== missing) await fireEvent.press(view.getByTestId(`consent-${policy}`));
    }

    expect(view.getByTestId('consent-continue').props.accessibilityState.disabled).toBe(true);
  });

  /** The core of §S15: declining marketing must not stand in the way of joining. */
  it('continues with marketing declined', async () => {
    const view = await renderScreen();

    await acceptAllRequired(view);
    await fireEvent.press(view.getByTestId('consent-continue'));

    await waitFor(() => expect(mockSaveStep).toHaveBeenCalled());

    const [, change] = mockSaveStep.mock.calls[0] as [string, { consents: unknown[] }];
    expect(change.consents).toContainEqual({
      policyType: 'marketing',
      version: CURRENT_POLICY_VERSION,
      accepted: false,
    });
    expect(mockPush).toHaveBeenCalledWith('/review');
  });

  it('records marketing as accepted only when it is actually ticked', async () => {
    const view = await renderScreen();

    await acceptAllRequired(view);
    await fireEvent.press(view.getByTestId('consent-marketing'));
    await fireEvent.press(view.getByTestId('consent-continue'));

    await waitFor(() => expect(mockSaveStep).toHaveBeenCalled());

    const [, change] = mockSaveStep.mock.calls[0] as [string, { consents: unknown[] }];
    expect(change.consents).toContainEqual({
      policyType: 'marketing',
      version: CURRENT_POLICY_VERSION,
      accepted: true,
    });
  });

  /** §S15: "Store policy type, version…" — an unversioned consent is not evidence of anything. */
  it('stamps every choice with the current policy version', async () => {
    const view = await renderScreen();

    await acceptAllRequired(view);
    await fireEvent.press(view.getByTestId('consent-continue'));

    await waitFor(() => expect(mockSaveStep).toHaveBeenCalled());

    const [, change] = mockSaveStep.mock.calls[0] as [string, { consents: { version: string }[] }];
    for (const choice of change.consents) {
      expect(choice.version).toBe(CURRENT_POLICY_VERSION);
    }
  });

  /**
   * There is deliberately no "accept all" control. Its absence is the mechanism that keeps
   * required and optional unbundled, so it is asserted rather than assumed — a well-meaning
   * convenience button added later would silently undo §S15.
   */
  it('offers no accept-all shortcut', async () => {
    const view = await renderScreen();

    expect(view.queryByText(/accept all|agree to all|select all/i)).toBeNull();
  });
});
