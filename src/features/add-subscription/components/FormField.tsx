/**
 * FormField — label + (TextInput | custom control) + inline error.
 *
 * Wraps a child input with the visual chrome (label, error hint, divider).
 * Skill rule `ui-styling`: borderCurve 'continuous', CSS-style border on focus.
 */

import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/design/components';
import { spacing } from '@/design/tokens';
import type { FieldKey } from '@/features/add-subscription/form-helpers';

export interface FormFieldProps {
  field: FieldKey;
  label: string;
  /** Map from validation errors; presented message wins if present. */
  errorMap?: Partial<Record<FieldKey, string>>;
  /** Hide the until-validated state until the field has been interacted with. */
  showError?: boolean;
  children: ReactNode;
  /** Optional inline helper text below the input (not the error). */
  helper?: string;
}

export function FormField({
  field,
  label,
  errorMap,
  showError,
  children,
  helper,
}: FormFieldProps) {
  const err = showError ? errorMap?.[field] : undefined;

  return (
    <View style={styles.container}>
      <Text variant="caption" color="textSecondary" weight="600">
        {label}
      </Text>
      {children}
      {err ? (
        <Text variant="caption" color="negative">
          {err}
        </Text>
      ) : helper ? (
        <Text variant="caption" color="textTertiary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
});
