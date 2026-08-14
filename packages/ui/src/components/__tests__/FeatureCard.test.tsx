import { fireEvent, render } from '@testing-library/react-native';

import { FeatureCard } from '../FeatureCard';

/**
 * §S18's acceptance criterion, tested rather than intended: **"No disabled feature looks
 * tappable; enabled features are controlled by server flags."**
 *
 * The interesting half is what "disabled" has to mean. A `Pressable` with `disabled` set is
 * still a button in the accessibility tree, so VoiceOver announces "Scene feed, button,
 * dimmed" and someone navigating by swipe is invited to activate something inert. Styling it
 * grey satisfies the sentence for sighted users and fails it for everyone else.
 *
 * So the assertions below are about the role and the handler, not the colour.
 */
describe('FeatureCard', () => {
  /**
   * Asserted through the accessibility tree rather than by firing a press.
   *
   * `fireEvent.press` traverses *upwards* looking for a handler, so it finds the `onPress`
   * passed to `<FeatureCard>` itself and reports a call even when the rendered host element
   * has none. It cannot distinguish "this card is inert" from "this card is a button",
   * which is the only question here.
   *
   * What can be asserted is what the platform actually exposes: no element with the button
   * role, and no press handler on the card itself.
   */
  it('does not present a coming-soon feature as a control', async () => {
    const view = await render(
      <FeatureCard
        title="Scene feed"
        description="See what is happening around Sydney."
        state="coming_soon"
        onPress={jest.fn()}
        testID="card"
      />,
    );

    expect(view.queryByRole('button')).toBeNull();
    expect(view.getByTestId('card').props.onPress).toBeUndefined();
    expect(view.getByText('Coming soon')).toBeTruthy();
  });

  it('says so out loud, not only in colour', async () => {
    const view = await render(
      <FeatureCard
        title="Scene feed"
        description="See what is happening around Sydney."
        state="coming_soon"
        testID="card"
      />,
    );

    // §7.5: state is never conveyed by colour alone. The label carries it.
    expect(view.getByTestId('card').props.accessibilityLabel).toContain('Coming soon');
  });

  it('lets someone vote for a feature that is up for a vote', async () => {
    const onPress = jest.fn();

    const view = await render(
      <FeatureCard
        title="Events"
        description="Find things happening near you."
        state="voting"
        onPress={onPress}
        testID="card"
      />,
    );

    await fireEvent.press(view.getByTestId('card'));

    expect(onPress).toHaveBeenCalled();
    expect(view.getByTestId('card').props.accessibilityRole).toBe('button');
  });

  /**
   * §S18: future cards are "all clearly labelled Coming soon **unless enabled**".
   *
   * A votable card is still an unbuilt one, so the label belongs there too. The first version
   * of this component showed the badge only on inert cards and said just "tap to vote" on the
   * rest — which left every card on the beta home silent about whether the feature existed.
   */
  it('labels a votable feature as coming soon, in text and to a screen reader', async () => {
    const view = await render(
      <FeatureCard
        title="Events"
        description="Find things happening near you."
        state="voting"
        onPress={jest.fn()}
        testID="card"
      />,
    );

    expect(view.getByText('Coming soon')).toBeTruthy();
    expect(view.getByTestId('card').props.accessibilityLabel).toContain('Coming soon');
  });

  it('reflects a vote already cast in the announced state', async () => {
    const view = await render(
      <FeatureCard
        title="Events"
        description="Find things happening near you."
        state="voting"
        voted
        onPress={jest.fn()}
        testID="card"
      />,
    );

    expect(view.getByTestId('card').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('card').props.accessibilityLabel).toContain('You voted for this');
  });

  it('navigates when the feature is actually available', async () => {
    const onPress = jest.fn();

    const view = await render(
      <FeatureCard
        title="Invite friends"
        description="Bring people you know."
        state="available"
        onPress={onPress}
        testID="card"
      />,
    );

    await fireEvent.press(view.getByTestId('card'));

    expect(onPress).toHaveBeenCalled();
    expect(view.queryByText('Coming soon')).toBeNull();
  });
});
