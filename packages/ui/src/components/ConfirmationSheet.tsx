import { Modal, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, spacing } from '../tokens/layout';
import { typography } from '../tokens/typography';
import { DestructiveButton } from './DestructiveButton';
import { SecondaryButton } from './SecondaryButton';
import { TextField } from './TextField';

export interface ConfirmationSheetProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  /**
   * A word the person must type to proceed. §S22 wants "a deliberate confirmation", and a
   * second button is not deliberate — muscle memory taps it.
   */
  confirmPhrase?: string;
  /** Typed value, owned by the caller so the screen can reset it. */
  phrase?: string;
  onPhraseChange?: (next: string) => void;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

/**
 * The last thing between someone and an irreversible action (§7.4).
 *
 * Three properties, each defending against a different way this goes wrong:
 *
 * **Cancel is the ordinary button and confirm is the destructive one.** The two are not
 * interchangeable and must not look it.
 *
 * **`confirmPhrase` requires typing, not tapping.** A second "Are you sure?" button is
 * defeated by the same reflex that produced the first tap. Typing a word cannot be done by
 * accident, and it is the only part of this component that genuinely prevents anything.
 *
 * **`onRequestClose` cancels.** The Android back button must not confirm, and a modal that
 * traps someone with no way out except the destructive action is worse than no modal.
 */
export function ConfirmationSheet({
  visible,
  title,
  body,
  confirmLabel,
  confirmPhrase,
  phrase = '',
  onPhraseChange,
  busy = false,
  onConfirm,
  onCancel,
  testID,
}: ConfirmationSheetProps) {
  const theme = useTheme();

  const satisfied =
    confirmPhrase === undefined || phrase.trim().toUpperCase() === confirmPhrase.toUpperCase();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.scrim}>
        <View
          style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}
          accessibilityRole="alert"
          testID={testID}
        >
          <Text style={[typography.title, { color: theme.textPrimary }]}>{title}</Text>
          <Text style={[typography.body, { color: theme.textSecondary }]}>{body}</Text>

          {confirmPhrase === undefined ? null : (
            <TextField
              label={`Type ${confirmPhrase} to confirm`}
              value={phrase}
              onChangeText={onPhraseChange ?? (() => undefined)}
              autoCapitalize="characters"
              testID="confirmation-phrase"
            />
          )}

          <View style={styles.actions}>
            <DestructiveButton
              label={confirmLabel}
              onPress={onConfirm}
              disabled={!satisfied || busy}
              loading={busy}
              testID="confirmation-confirm"
            />
            <SecondaryButton
              label="Cancel"
              onPress={onCancel}
              disabled={busy}
              testID="confirmation-cancel"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6, 17, 15, 0.72)',
  },
  sheet: {
    gap: spacing.md,
    padding: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  actions: { gap: spacing.sm },
});
