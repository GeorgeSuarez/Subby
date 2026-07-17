/**
 * DateInput — styled text input for YYYY-MM-DD dates (v1 minimalist).
 *
 * Step 12 polish will swap to `@react-native-community/datetimepicker` while
 * keeping the same props. The component is intentionally controlled so the
 * parent owns the subscribe draft's `nextRenewal` field.
 *
 * Skill rule `rendering-no-falsy-and`: helper/error ternaries.
 */

import { forwardRef } from 'react';
import { TextInput } from 'react-native';
import { TextField, type TextFieldProps } from '@/features/add-subscription/components/TextField';

export interface DateInputProps extends Omit<TextFieldProps, 'keyboardType' | 'onChange'> {
  value: string;
  onChange: (raw: string) => void;
}

const STRICT_RE = /^\d{0,4}-?\d{0,2}-?\d{0,2}$/;

export const DateInput = forwardRef<TextInput, DateInputProps>(function DateInput(
  { value, onChange, ...rest },
  ref,
) {
  return (
    <TextField
      ref={ref}
      value={value}
      onChangeText={(raw) => {
        // Allow backspacing across dashes and prevent junk.
        if (raw.length > 10) {
          return;
        }
        // Allow digits + dashes; reject if malformed mid-typing.
        const ok = STRICT_RE.test(raw);
        if (!ok) return;
        onChange(raw);
      }}
      keyboardType="numbers-and-punctuation"
      returnKeyType="done"
      placeholder="YYYY-MM-DD"
      autoComplete="off"
      autoCorrect={false}
      spellCheck={false}
      autoCapitalize="none"
      {...rest}
    />
  );
});