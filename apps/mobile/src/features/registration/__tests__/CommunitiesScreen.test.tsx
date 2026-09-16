import { fireEvent, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-support/render';

import { CommunitiesScreen } from '../screens/CommunitiesScreen';

const mockPush = jest.fn();
const mockSaveStep = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/features/registration/hooks/useDraft', () => ({
  useDraft: () => ({ draft: null, isLoading: false, saveStep: mockSaveStep, patch: jest.fn() }),
}));

jest.mock('@/repositories/profile-repository', () => ({
  profileRepository: {
    listCommunities: () =>
      Promise.resolve([
        { code: 'punjabi', label: 'Punjabi' },
        { code: 'goan', label: 'Goan' },
        { code: 'tamil', label: 'Tamil' },
      ]),
  },
}));

const renderScreen = () => renderWithProviders(<CommunitiesScreen />);

/**
 * §S10's acceptance criterion is a single sentence — "Prefer not to specify clears other
 * selections" — and it is the one rule on this screen that can produce a genuinely wrong
 * statement about a person: a profile asserting both "I decline to say" and a list of
 * communities. It is enforced in three places, so it is tested here at the layer a user
 * actually touches.
 */
describe('S10 — Cultural communities', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSaveStep.mockClear();
  });

  it('clears existing selections when "prefer not to specify" is turned on', async () => {
    const view = await renderScreen();

    const punjabi = await view.findByTestId('communities-chips-punjabi');
    await fireEvent.press(punjabi);
    await fireEvent.press(view.getByTestId('communities-chips-goan'));

    expect(view.getByTestId('communities-chips-punjabi').props.accessibilityState.checked).toBe(
      true,
    );

    await fireEvent(view.getByTestId('communities-not-specified-switch'), 'valueChange', true);

    expect(view.getByTestId('communities-chips-punjabi').props.accessibilityState.checked).toBe(
      false,
    );
    expect(view.getByTestId('communities-chips-goan').props.accessibilityState.checked).toBe(false);
  });

  it('saves the cleared state, not the stale selection', async () => {
    const view = await renderScreen();

    const punjabi = await view.findByTestId('communities-chips-punjabi');
    await fireEvent.press(punjabi);
    await fireEvent(view.getByTestId('communities-not-specified-switch'), 'valueChange', true);
    await fireEvent.press(view.getByTestId('communities-continue'));

    await waitFor(() => {
      expect(mockSaveStep).toHaveBeenCalledWith('communities', {
        communities: { codes: [], notSpecified: true },
      });
    });
  });

  /**
   * The inverse direction, which is the easier one to forget: a user who declines and then
   * changes their mind must not end up with both facts recorded.
   */
  it('turns off "prefer not to specify" when a community is chosen', async () => {
    const view = await renderScreen();

    await view.findByTestId('communities-chips-punjabi');
    await fireEvent(view.getByTestId('communities-not-specified-switch'), 'valueChange', true);
    await fireEvent(view.getByTestId('communities-not-specified-switch'), 'valueChange', false);
    await fireEvent.press(view.getByTestId('communities-chips-tamil'));
    await fireEvent.press(view.getByTestId('communities-continue'));

    await waitFor(() => {
      expect(mockSaveStep).toHaveBeenCalledWith('communities', {
        communities: { codes: ['tamil'], notSpecified: false },
      });
    });
  });

  /** §S10: "Optional". Nothing selected and nothing declined is a valid state to continue in. */
  it('allows continuing with no selection at all', async () => {
    const view = await renderScreen();

    await view.findByTestId('communities-chips-punjabi');
    await fireEvent.press(view.getByTestId('communities-continue'));

    await waitFor(() => {
      expect(mockSaveStep).toHaveBeenCalledWith('communities', {
        communities: { codes: [], notSpecified: false },
      });
    });
  });

  /**
   * §S10: "never inferred from state, language or religion". The screen has no access to those
   * answers at all, which is the real guarantee — this asserts the absence of a religion
   * option, since §13.2 forbids the field outright in P0.
   */
  it('offers no religion option', async () => {
    const view = await renderScreen();
    await view.findByTestId('communities-chips-punjabi');

    expect(view.queryByText(/religio|hindu|muslim|sikh|christian/i)).toBeNull();
  });
});
