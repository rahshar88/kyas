import { fireEvent, render } from '@testing-library/react-native';

import { EligibilityScreen } from '../screens/EligibilityScreen';

const mockPush = jest.fn();
const mockSaveStep = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/features/registration/hooks/useDraft', () => ({
  useDraft: () => ({ draft: null, isLoading: false, saveStep: mockSaveStep }),
}));

/**
 * Both `render` and `fireEvent` are asynchronous in React Native Testing Library v14.
 * Forgetting to await either produces confusing failures — a missing testID, or a state
 * change that appears never to have happened — so every interaction below is awaited.
 */
const renderScreen = () => render(<EligibilityScreen />);

describe('S05 — Eligibility', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSaveStep.mockClear();
  });

  it('asks all four questions from §S05', async () => {
    const view = await renderScreen();

    expect(view.getByText("I'm 18 or older")).toBeTruthy();
    expect(view.getByText("I'm from India")).toBeTruthy();
    expect(view.getByText("I'm studying in Australia, or I have an offer")).toBeTruthy();
    expect(view.getByText("I'm in Sydney, or heading there")).toBeTruthy();
  });

  /**
   * §S05 acceptance: an ineligible user gets a respectful explanation, and — critically —
   * does NOT advance. This is the check that stops someone walking past the audience
   * boundary in §2.4.
   */
  it('refuses to advance when an answer is missing, and says which', async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('eligibility-isEighteenOrOlder'));
    await fireEvent.press(view.getByTestId('eligibility-isFromIndia'));
    await fireEvent.press(view.getByTestId('eligibility-isStudyingOrOffered'));
    // Sydney deliberately left unticked.
    await fireEvent.press(view.getByTestId('eligibility-continue'));

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockSaveStep).not.toHaveBeenCalled();
    expect(view.getByText(/Sydney is our first city/i)).toBeTruthy();
  });

  it('explains the age boundary specifically, not generically', async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('eligibility-isFromIndia'));
    await fireEvent.press(view.getByTestId('eligibility-isStudyingOrOffered'));
    await fireEvent.press(view.getByTestId('eligibility-hasSydneyConnection'));
    await fireEvent.press(view.getByTestId('eligibility-continue'));

    expect(view.getByText(/aged 18 and over/i)).toBeTruthy();
  });

  it('lets a refused user go back and change their answers', async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('eligibility-continue'));
    expect(view.getByTestId('eligibility-refused')).toBeTruthy();

    await fireEvent.press(view.getByTestId('eligibility-reconsider'));
    expect(view.getByTestId('eligibility-screen')).toBeTruthy();
  });

  it('advances and saves the step when all four are true', async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('eligibility-isEighteenOrOlder'));
    await fireEvent.press(view.getByTestId('eligibility-isFromIndia'));
    await fireEvent.press(view.getByTestId('eligibility-isStudyingOrOffered'));
    await fireEvent.press(view.getByTestId('eligibility-hasSydneyConnection'));
    await fireEvent.press(view.getByTestId('eligibility-continue'));

    expect(mockSaveStep).toHaveBeenCalledWith('eligibility', {
      eligibility: {
        isEighteenOrOlder: true,
        isFromIndia: true,
        isStudyingOrOffered: true,
        hasSydneyConnection: true,
      },
    });
  });

  /** §7.5: checkboxes must announce their state, not signal it by colour alone. */
  it('announces each answer as a checkbox with its checked state', async () => {
    const view = await renderScreen();

    const age = view.getByTestId('eligibility-isEighteenOrOlder');
    expect(age.props.accessibilityState).toMatchObject({ checked: false });

    await fireEvent.press(age);
    expect(
      view.getByTestId('eligibility-isEighteenOrOlder').props.accessibilityState,
    ).toMatchObject({ checked: true });
  });
});
