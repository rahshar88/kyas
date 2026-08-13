import { AVATAR_EDGE_PIXELS, AVATAR_JPEG_QUALITY } from '@kyascene/domain';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Choosing and preparing a profile photograph (§S13).
 *
 * §S13: "Crop to square, compress before upload, remove unnecessary image metadata and store
 * a generated derivative."
 *
 * The metadata clause is the one worth being explicit about. A photograph taken on a phone
 * carries EXIF, and EXIF routinely carries **GPS coordinates** — so uploading an original
 * would import precise location into a product whose §13.2 data minimisation forbids exact
 * location outright, through a field nobody would think to audit. Re-encoding through
 * `manipulateAsync` produces a new image from decoded pixels, which is what actually drops
 * it; stripping named tags would leave whatever we forgot to name.
 *
 * Everything here returns a local file URI. Nothing uploads — that belongs to submission.
 */
export type PickOutcome =
  | { status: 'picked'; uri: string }
  | { status: 'cancelled' }
  | { status: 'permission_denied'; source: 'camera' | 'library' };

/**
 * §S13: "Ask only when the user chooses camera or library."
 *
 * Requesting on screen entry would be a permission prompt for a step the specification makes
 * optional, which is both worse for the user and an App Store review question we would rather
 * not answer (§18).
 */
async function ensurePermission(source: 'camera' | 'library'): Promise<boolean> {
  const result =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  return result.granted;
}

/**
 * Square, downscaled and re-encoded.
 *
 * The crop is centred rather than offered as an interactive cropper: `allowsEditing` gives
 * the platform's own square cropper on both iOS and Android, which is more familiar than
 * anything we would build and already accessible.
 */
async function prepare(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: AVATAR_EDGE_PIXELS, height: AVATAR_EDGE_PIXELS } }],
    { compress: AVATAR_JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  return result.uri;
}

export const avatarService = {
  async pick(source: 'camera' | 'library'): Promise<PickOutcome> {
    if (!(await ensurePermission(source))) {
      return { status: 'permission_denied', source };
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      // The original is re-encoded below, so asking for EXIF here would only mean holding
      // location data in memory that we intend to discard.
      exif: false,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return { status: 'cancelled' };

    const asset = result.assets[0];
    if (!asset) return { status: 'cancelled' };

    return { status: 'picked', uri: await prepare(asset.uri) };
  },
};
