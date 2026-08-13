/**
 * AmountInput — numeric text field with currency symbol prefix.
 *
 * Only digits + a single decimal separator allowed. Skill rule
 * `react-state-minimize`: value + onChange live in the parent; this component
 * holds the local focus state only (a UI affordance, not real data state).
 */

import { forwardRef, type ComponentRef } from 'react';
import { currencyMeta } from '@/utils/constants';
import type { CurrencyCode } from '@/types/subscription';
import {
  TextField,
  type TextFieldProps as TextFieldProps_in,
} from '@/features/add-subscription/components/TextField';

type TextRef = ComponentRef<typeof TextField>;

const DECIMAL_RE = /^\d*\.?\d{0,2}$/;

export interface AmountInputProps extends Omit<
  TextFieldProps_in,
  'keyboardType' | 'leading' | 'trailing' | 'onChangeText'
> {
  currency: CurrencyCode;
  value: string;
  onChangeText: (raw: string) => void;
}

export const AmountInput = forwardRef<TextRef, AmountInputProps>(
  function AmountInput({ currency, value, onChangeText, ...rest }, ref) {
    const meta = currencyMeta(currency);
    return (
      <TextField
        ref={ref}
        value={value}
        onChangeText={(raw) => {
          // Strip group separators (commas) and spaces; keep single decimal dot.
          const stripped = raw.replace(/[,\s]/g, '');
          if (stripped.length === 0) {
            onChangeText('');
            return;
          }
          if (!DECIMAL_RE.test(stripped)) {
            return; // Reject anything outside digits + optional 2-decimal dot.
          }
          onChangeText(stripped);
        }}
        keyboardType="decimal-pad"
        returnKeyType="done"
        leading={meta.symbol}
        trailing={currency}
        placeholder="0.00"
        {...rest}
      />
    );
  },
);
