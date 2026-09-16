import { TextField, type TextFieldProps } from './TextField';

type EmailFieldProps = Omit<
  TextFieldProps,
  'keyboardType' | 'autoCapitalize' | 'autoComplete' | 'textContentType'
>;

/**
 * §S02's email input.
 *
 * The keyboard and autofill hints are the whole point of having a separate component: on a
 * phone, `autoComplete="email"` plus `textContentType="emailAddress"` is the difference
 * between one tap and typing an address by hand, and §3.2 targets a median registration
 * under three minutes.
 *
 * Normalisation (trim and lowercase) is deliberately NOT done here — it belongs to
 * `emailSchema` in @kyascene/domain, so the same rule applies wherever an address enters the
 * system, not only through this field.
 */
export function EmailField(props: EmailFieldProps) {
  return (
    <TextField
      {...props}
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      textContentType="emailAddress"
    />
  );
}
