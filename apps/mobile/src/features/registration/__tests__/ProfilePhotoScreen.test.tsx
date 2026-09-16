import { emptyDraft, type RegistrationDraft } from '@kyascene/domain';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-support/render';

import { ProfilePhotoScreen } from '../screens/ProfilePhotoScreen';

const mockPush = jest.fn();
const mockSaveStep = jest.fn().mockResolvedValue(undefined);
const mockPick = jest.fn();
const mockDraft: { current: RegistrationDraft | null } = { current: null };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/features/registration/hooks/useDraft', () => ({
  useDraft: () => ({
    draft: mockDraft.current,
    isLoading: false,
    saveStep: mockSaveStep,
    patch: jest.fn(),
  }),
}));

jest.mock('@/services/avatar', () => ({
  avatarService: { pick: (...args: unknown[]) => mockPick(...args) },
}));

/**
 * S13 — Your name and photo.
 *
 * The name is the reason this screen has a test at all. Nothing in §S02–§S17 ever asked for
 * one, so `display_name` was null for every applicant and the review queue listed them all as
 * "No name" — a gap no test could have found, because nothing was broken. What can be pinned
 * from here is the consequence: the name is required, the photo is not, and the step completes
 * either way.
 */
describe('S13 — Your name and photo', () => {
  beforeEach(() => {
    mockDraft.current = null;
    mockPush.mockClear();
    mockSaveStep.mockClear();
    mockPick.mockReset();
  });

  it('will not continue without a name', async () => {
    const view = await renderWithProviders(<ProfilePhotoScreen />);
    await fireEvent.press(view.getByTestId('photo-continue'));

    expect(mockSaveStep).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('treats a name of only spaces as no name', async () => {
    const view = await renderWithProviders(<ProfilePhotoScreen />);
    await fireEvent.changeText(view.getByTestId('photo-name'), '   ');
    await fireEvent.press(view.getByTestId('photo-continue'));

    expect(mockSaveStep).not.toHaveBeenCalled();
  });

  /** §S13 keeps the photo optional. Requiring a name must not quietly require one. */
  it('completes the step with a name and no photo', async () => {
    const view = await renderWithProviders(<ProfilePhotoScreen />);
    await fireEvent.changeText(view.getByTestId('photo-name'), '  Asha  ');
    await fireEvent.press(view.getByTestId('photo-continue'));

    await waitFor(() => {
      expect(mockSaveStep).toHaveBeenCalledWith('photo', {
        displayName: 'Asha',
        photo: { localUri: undefined },
      });
      expect(mockPush).toHaveBeenCalledWith('/privacy');
    });
  });

  it('keeps the photo when one was chosen', async () => {
    mockPick.mockResolvedValue({ status: 'picked', uri: 'file:///asha.jpg' });

    const view = await renderWithProviders(<ProfilePhotoScreen />);
    await fireEvent.changeText(view.getByTestId('photo-name'), 'Asha');
    await fireEvent.press(view.getByTestId('photo-library'));
    await view.findByTestId('photo-preview');
    await fireEvent.press(view.getByTestId('photo-continue'));

    await waitFor(() => {
      expect(mockSaveStep).toHaveBeenCalledWith('photo', {
        displayName: 'Asha',
        photo: { localUri: 'file:///asha.jpg' },
      });
    });
  });

  /**
   * §S13 acceptance: "Permission denial returns to a usable screen with instructions and skip
   * option." Usable now includes being able to finish, which is why this asserts the step
   * completes rather than only that the notice appears.
   */
  it('still lets someone finish after a permission denial', async () => {
    mockPick.mockResolvedValue({ status: 'permission_denied', source: 'camera' });

    const view = await renderWithProviders(<ProfilePhotoScreen />);
    await fireEvent.press(view.getByTestId('photo-camera'));
    await view.findByTestId('photo-permission-denied');

    await fireEvent.changeText(view.getByTestId('photo-name'), 'Asha');
    await fireEvent.press(view.getByTestId('photo-continue'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/privacy');
    });
  });

  /** §10.2: coming back to a step shows what was answered, not an empty field. */
  it('shows the name already in the draft', async () => {
    mockDraft.current = { ...emptyDraft('2026-08-14T00:00:00.000Z'), displayName: 'Asha' };

    const view = await renderWithProviders(<ProfilePhotoScreen />);

    expect(view.getByTestId('photo-name').props.value).toBe('Asha');
  });
});
