import { render } from '@testing-library/react-native';

import { WelcomeScreen } from '../screens/WelcomeScreen';

jest.mock('expo-linking', () => ({ openURL: jest.fn() }));

/**
 * `render` is asynchronous in React Native Testing Library v14 — it returns a Promise of
 * the query helpers rather than the helpers themselves. Forgetting the `await` yields the
 * confusing "getByText is not a function", so every test awaits this helper.
 */
const renderWelcome = () => render(<WelcomeScreen />);

describe('S01 — Welcome', () => {
  it('renders the beta positioning from §S01', async () => {
    const view = await renderWelcome();

    expect(view.getByText(/private community for students from India in Sydney/i)).toBeTruthy();
    expect(view.getByText('Connect')).toBeTruthy();
    expect(view.getByText('Discover')).toBeTruthy();
    expect(view.getByText('Belong')).toBeTruthy();
    expect(view.getByText(/free and invite-only/i)).toBeTruthy();
  });

  /**
   * §S01 acceptance: "The primary action is visible without scrolling." Layout cannot be
   * measured in a unit test, so this asserts the weaker but still meaningful property —
   * the primary action exists and is reachable by an assistive technology.
   */
  it('exposes the primary action by accessible role and name', async () => {
    const view = await renderWelcome();

    const join = view.getByRole('button', { name: 'Join the beta' });
    expect(join).toBeTruthy();
    expect(join.props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  });

  it('offers the returning-user path', async () => {
    const view = await renderWelcome();
    expect(view.getByRole('button', { name: 'I already have an account' })).toBeTruthy();
  });

  /**
   * §16.4 makes "missing privacy or terms links" a release blocker, so their absence
   * should fail the build rather than be noticed during store review.
   */
  it('shows privacy and terms links', async () => {
    const view = await renderWelcome();

    expect(view.getByRole('button', { name: 'Privacy' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Terms' })).toBeTruthy();
  });

  /** §2.2: "Powered by 1818, always secondary to KyaScene." */
  it('carries the 1818 attribution', async () => {
    const view = await renderWelcome();
    expect(view.getByText('Powered by 1818')).toBeTruthy();
  });

  /** §7.3: "Minimum interactive target: 48 by 48 logical units across both platforms." */
  it('gives every action a 48pt minimum target', async () => {
    const view = await renderWelcome();

    for (const name of ['Join the beta', 'I already have an account', 'Privacy', 'Terms']) {
      const style = view.getByRole('button', { name }).props.style as unknown;
      const flattened: { minHeight?: number } = Array.isArray(style)
        ? Object.assign({}, ...(style.flat(Infinity) as object[]).filter(Boolean))
        : ((style ?? {}) as { minHeight?: number });

      expect(flattened.minHeight).toBe(48);
    }
  });
});
