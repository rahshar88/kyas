import { render } from '@testing-library/react-native';

import { StudentAvatar } from '../StudentAvatar';

/**
 * The initial is hidden from the accessibility tree on purpose — the container carries the
 * label, so a screen reader saying "Asha's profile picture" then "A" would be repeating
 * itself. RNTL excludes hidden elements by default, so every query for it has to opt in.
 */
const HIDDEN = { includeHiddenElements: true } as const;

/**
 * The engine gap this exists for.
 *
 * `StudentAvatar` used `Intl.Segmenter` unconditionally to take the first grapheme of a name.
 * That is the correct API and **Hermes does not implement it**. Node does, so every unit test
 * passed and the device crashed on launch.
 *
 * It hid longer than it should have because the call sat behind an early return for an empty
 * name. Every account in testing had a null `display_name`, so the line was never reached and
 * the app worked. Setting one real name crashed it — and rebuilding could not help, because
 * the data had changed rather than the code.
 *
 * So these tests delete `Intl.Segmenter` first. A test environment more capable than the
 * target is not a neutral difference; it is a test that lies.
 */
async function renderWithoutSegmenter(name: string) {
  const original = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
  // @ts-expect-error — deliberately making the environment as poor as Hermes.
  delete Intl.Segmenter;

  try {
    return await render(<StudentAvatar displayName={name} testID="avatar" />);
  } finally {
    if (original) Object.defineProperty(Intl, 'Segmenter', original);
  }
}

describe('StudentAvatar', () => {
  it('still renders an initial on an engine with no Intl.Segmenter', async () => {
    const view = await renderWithoutSegmenter('Rah');

    expect(view.getByText('R', HIDDEN)).toBeTruthy();
  });

  /**
   * Why the fallback is `Array.from` and not `value[0]`: a string index returns a UTF-16 code
   * unit, so an emoji comes back as half a surrogate pair and renders as a replacement box.
   */
  it('keeps a surrogate pair whole without Intl.Segmenter', async () => {
    const view = await renderWithoutSegmenter('😀 Asha');

    expect(view.getByText('😀', HIDDEN)).toBeTruthy();
  });

  /** Devanagari: the base consonant, not half a cluster. */
  it('takes a whole letter from an Indic script without Intl.Segmenter', async () => {
    const view = await renderWithoutSegmenter('अनुराग');

    expect(view.getByText('अ', HIDDEN)).toBeTruthy();
  });

  it('uses Intl.Segmenter when the engine has it', async () => {
    const view = await render(<StudentAvatar displayName="Rah" testID="avatar" />);

    expect(view.getByText('R', HIDDEN)).toBeTruthy();
  });

  it('shows a question mark when there is no name yet', async () => {
    const view = await render(<StudentAvatar displayName={null} testID="avatar" />);

    expect(view.getByText('?', HIDDEN)).toBeTruthy();
  });

  it('shows the photo instead when there is one', async () => {
    const view = await render(
      <StudentAvatar displayName="Rah" uri="file:///rah.jpg" testID="avatar" />,
    );

    expect(view.getByTestId('avatar').props.accessibilityLabel).toBe("Rah's profile picture");
  });
});
