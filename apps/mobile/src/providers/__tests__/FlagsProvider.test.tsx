import { DEFAULT_FEATURE_FLAGS } from '@kyascene/domain';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FlagsProvider, useFlags } from '../FlagsProvider';

const mockLoadFlags = jest.fn();

jest.mock('@/repositories/beta-repository', () => ({
  betaRepository: { loadFlags: () => mockLoadFlags() },
}));

function Probe() {
  const { flags, isLoading } = useFlags();
  return (
    <Text testID="probe">
      {isLoading ? 'loading' : 'ready'}:
      {Object.entries(flags)
        .filter(([, on]) => on)
        .map(([key]) => key)
        .join(',')}
    </Text>
  );
}

/**
 * §6.5: "Server-managed feature flags. Default every future flag to false."
 *
 * This provider is the runtime enforcement of §1.2 — "do not implement future features shown
 * in concept artwork" — so the tests are all about what happens when things go wrong. An
 * unbuilt feature appearing because the network dropped is a worse failure than the feature
 * being missing, and it is the one nobody would think to check by hand.
 */
describe('FlagsProvider', () => {
  beforeEach(() => {
    mockLoadFlags.mockReset();
  });

  it('leaves every flag off when the flags cannot be fetched', async () => {
    mockLoadFlags.mockRejectedValue(new Error('offline'));

    const view = await render(
      <FlagsProvider>
        <Probe />
      </FlagsProvider>,
    );

    await waitFor(() => {
      expect(view.getByTestId('probe')).toHaveTextContent('ready:');
    });
  });

  it('starts with everything off, before any answer arrives', async () => {
    // Never resolves — the state while a slow network is still thinking.
    mockLoadFlags.mockReturnValue(new Promise(() => undefined));

    const view = await render(
      <FlagsProvider>
        <Probe />
      </FlagsProvider>,
    );

    expect(view.getByTestId('probe')).toHaveTextContent('loading:');
  });

  it('turns on what the server says is on', async () => {
    mockLoadFlags.mockResolvedValue({
      ...DEFAULT_FEATURE_FLAGS,
      feedback_enabled: true,
      referrals_enabled: true,
    });

    const view = await render(
      <FlagsProvider>
        <Probe />
      </FlagsProvider>,
    );

    await waitFor(() => {
      expect(view.getByTestId('probe')).toHaveTextContent(
        'ready:referrals_enabled,feedback_enabled',
      );
    });
  });

  /** Using flags outside the provider would silently read nothing. Better to say so loudly. */
  it('refuses to be used outside the provider', async () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(render(<Probe />)).rejects.toThrow(/FlagsProvider/);

    quiet.mockRestore();
  });
});
