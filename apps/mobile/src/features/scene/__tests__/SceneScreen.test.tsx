import { fireEvent, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-support/render';

import { SceneScreen } from '../screens/SceneScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockSession: { current: { userId: string } | null } = { current: null };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
}));

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({ session: mockSession.current }),
}));

jest.mock('@/repositories/scene-repository', () => ({
  sceneRepository: {
    listCategories: jest.fn().mockResolvedValue([
      { code: 'grocery', label: 'Groceries & spices' },
      { code: 'temple', label: 'Temples & gurdwaras' },
      { code: 'services', label: 'Services' },
    ]),
    listPlaces: jest.fn().mockResolvedValue([
      {
        id: 'p1',
        name: 'Patel Brothers',
        categoryCode: 'grocery',
        suburb: 'Harris Park',
        stateCode: 'NSW',
        address: null,
        url: null,
        phone: null,
        description: 'On the Wigram Street strip.',
      },
      {
        id: 'p2',
        name: 'Gurdwara Sahib Parklea',
        categoryCode: 'temple',
        suburb: 'Parklea',
        stateCode: 'NSW',
        address: null,
        url: null,
        phone: null,
        description: null,
      },
    ]),
    getPlace: jest.fn(),
  },
}));

/**
 * The Scene — the public directory (ADR-0007).
 *
 * The properties pinned here are the mechanism the founder locked on 16 Sep:
 *
 *   * The same route serves both audiences, split only by session — a stranger gets the
 *     sign-in door, a student gets Back, and neither ever sees the other's control.
 *   * The directory groups by category and drops empty categories rather than rendering
 *     headings over nothing.
 */
describe('The Scene — public directory', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockSession.current = null;
  });

  it('renders places grouped by category, skipping empty categories', async () => {
    const screen = await renderWithProviders(<SceneScreen />);

    await waitFor(() => {
      expect(screen.getByText('Patel Brothers')).toBeTruthy();
    });
    expect(screen.getByText('Groceries & spices')).toBeTruthy();
    expect(screen.getByText('Gurdwara Sahib Parklea')).toBeTruthy();
    // 'Services' has no places, so the heading must not render over nothing.
    expect(screen.queryByText('Services')).toBeNull();
  });

  it('offers a stranger the one door into the student side', async () => {
    const screen = await renderWithProviders(<SceneScreen />);

    await waitFor(() => {
      expect(screen.getByText('Patel Brothers')).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId('scene-sign-in'));
    expect(mockPush).toHaveBeenCalledWith('/welcome');
    expect(screen.queryByTestId('scene-back')).toBeNull();
  });

  it('gives a signed-in student Back instead of a sign-in pitch', async () => {
    mockSession.current = { userId: 'user-1' };
    const screen = await renderWithProviders(<SceneScreen />);

    await waitFor(() => {
      expect(screen.getByText('Patel Brothers')).toBeTruthy();
    });

    expect(screen.queryByTestId('scene-sign-in')).toBeNull();
    await fireEvent.press(screen.getByTestId('scene-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('opens a listing', async () => {
    const screen = await renderWithProviders(<SceneScreen />);

    await waitFor(() => {
      expect(screen.getByText('Patel Brothers')).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId('scene-place-p1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/place/[id]', params: { id: 'p1' } });
  });
});
