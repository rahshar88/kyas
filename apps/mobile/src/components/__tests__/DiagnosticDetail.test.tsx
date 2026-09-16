import { AppError } from '@kyascene/domain';
import { render } from '@testing-library/react-native';

import { describeCause } from '@/repositories/errors';

const mockEnvironment = { value: 'development' };

jest.mock('@/config/env', () => ({
  env: {
    get EXPO_PUBLIC_ENVIRONMENT() {
      return mockEnvironment.value;
    },
    EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  },
}));

// eslint-disable-next-line import/first -- must be imported after the env mock is registered.
import { DiagnosticDetail } from '../DiagnosticDetail';

const authError = Object.assign(new Error('Network request failed'), {
  name: 'AuthRetryableFetchError',
  status: 0,
  code: 'network_error',
});

describe('DiagnosticDetail', () => {
  afterEach(() => {
    mockEnvironment.value = 'development';
  });

  /**
   * §6.4: "Screens show human guidance and never expose raw backend messages." A build going
   * to real students must not carry this, and the check that stops it is one comparison — the
   * kind that survives until someone refactors the file and quietly inverts it.
   */
  it('shows nothing at all in production', async () => {
    mockEnvironment.value = 'production';

    const view = await render(
      <DiagnosticDetail error={new AppError('NETWORK_UNAVAILABLE', { cause: authError })} />,
    );

    expect(view.queryByTestId('diagnostic-check')).toBeNull();
    expect(view.queryByText(/Network request failed/)).toBeNull();
  });

  it('shows the underlying failure on an internal build', async () => {
    const view = await render(
      <DiagnosticDetail error={new AppError('NETWORK_UNAVAILABLE', { cause: authError })} />,
    );

    expect(view.getByText(/AuthRetryableFetchError/)).toBeTruthy();
    expect(view.getByText(/Network request failed/)).toBeTruthy();
    expect(view.getByTestId('diagnostic-check')).toBeTruthy();
  });

  /** Nothing has failed yet, so there is nothing to explain. */
  it('stays out of the way when there is no error', async () => {
    const view = await render(<DiagnosticDetail error={undefined} />);

    expect(view.queryByTestId('diagnostic-check')).toBeNull();
  });
});

describe('describeCause', () => {
  /** The point is the *original*, not the label we put on it. */
  it('unwraps the cause an AppError was built from', () => {
    expect(describeCause(new AppError('NETWORK_UNAVAILABLE', { cause: authError }))).toBe(
      'AuthRetryableFetchError · HTTP 0 · network_error · Network request failed',
    );
  });

  it('describes a bare error', () => {
    expect(describeCause(new TypeError('Network request failed'))).toBe(
      'TypeError · Network request failed',
    );
  });

  it('has nothing to say about nothing', () => {
    expect(describeCause(undefined)).toBeUndefined();
  });
});
