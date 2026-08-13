import { AppError } from '@kyascene/domain';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-support/render';

import { FeedbackScreen } from '../screens/FeedbackScreen';

const mockBack = jest.fn();
const mockSubmitFeedback = jest.fn();
const mockTrack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
}));

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({ session: { userId: 'user-1', email: 'a@b.test', expiresAt: null } }),
}));

jest.mock('@/repositories/beta-repository', () => ({
  betaRepository: { submitFeedback: (...args: unknown[]) => mockSubmitFeedback(...args) },
}));

jest.mock('@/services/analytics', () => ({
  analytics: { track: (...args: unknown[]) => mockTrack(...args) },
}));

describe('S20 — Beta feedback', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockTrack.mockClear();
    mockSubmitFeedback.mockReset().mockResolvedValue({ reference: 'KYA-7F3K2Q' });
  });

  const fillIn = async (comment = 'The invite screen scrolled oddly.') => {
    const view = await renderWithProviders(<FeedbackScreen />);
    await fireEvent.press(view.getByTestId('feedback-category'));
    await fireEvent.press(await view.findByText('Something is broken'));
    await fireEvent.changeText(view.getByTestId('feedback-comment'), comment);
    return view;
  };

  /**
   * §S20 acceptance: "Submission works without an email client and returns a reference
   * number." The reference is the whole receipt — without it a tester has nothing to quote and
   * no evidence the report went anywhere.
   */
  it('returns the reference the server assigned', async () => {
    const view = await fillIn();
    await fireEvent.press(view.getByTestId('feedback-submit'));

    expect(await view.findByTestId('feedback-reference')).toHaveTextContent('KYA-7F3K2Q');
  });

  it('will not send an empty report', async () => {
    const view = await renderWithProviders(<FeedbackScreen />);

    await fireEvent.press(view.getByTestId('feedback-submit'));

    expect(mockSubmitFeedback).not.toHaveBeenCalled();
  });

  it('sends the category, the comment and an optional rating', async () => {
    const view = await fillIn();
    await fireEvent.press(view.getByTestId('feedback-rating-4'));
    await fireEvent.press(view.getByTestId('feedback-submit'));

    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith('user-1', {
        category: 'bug',
        comment: 'The invite screen scrolled oddly.',
        rating: 4,
      });
    });
  });

  /** §S20: the rating is optional. Somebody reporting a bug should not have to score it. */
  it('sends without a rating when none was chosen', async () => {
    const view = await fillIn();
    await fireEvent.press(view.getByTestId('feedback-submit'));

    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ rating: undefined }),
      );
    });
  });

  /**
   * §14.3 and §S20: "Record category identifiers, not free-text personal information."
   *
   * The comment is the single field most likely to contain a name, an address or a complaint
   * about another person. This asserts it never reaches the analytics adapter — a leak that
   * would be invisible in review, because the call site looks perfectly ordinary.
   */
  it('never sends the comment to analytics', async () => {
    const view = await fillIn('My landlord at 14 Wattle Street is called Priya');
    await fireEvent.press(view.getByTestId('feedback-submit'));

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith('feedback_submitted', {
        screen: 'S20',
        feedbackCategory: 'bug',
      });
    });

    const everything = JSON.stringify(mockTrack.mock.calls);
    expect(everything).not.toContain('Wattle');
    expect(everything).not.toContain('Priya');
  });

  /** §S20: the warning has to be readable before the field, not after it. */
  it('warns against pasting secrets into the box', async () => {
    const view = await renderWithProviders(<FeedbackScreen />);

    expect(view.getByText(/do not include passwords/i)).toBeTruthy();
  });

  it('keeps what they wrote when sending fails', async () => {
    mockSubmitFeedback.mockRejectedValue(new AppError('NETWORK_UNAVAILABLE'));

    const view = await fillIn();
    await fireEvent.press(view.getByTestId('feedback-submit'));

    await waitFor(() => {
      expect(view.getByText(/couldn't reach KyaScene/)).toBeTruthy();
    });

    // Losing a written report because the network dropped is how a tester stops reporting.
    expect(view.getByTestId('feedback-comment').props.value).toBe(
      'The invite screen scrolled oddly.',
    );
  });
});
