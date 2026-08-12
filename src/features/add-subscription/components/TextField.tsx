/**
 * TextField — themed text input used inside add-subscription form fields.
 *
 * Skill rules:
 *  - `ui-styling`: borderCurve 'continuous', boxShadow when focused,
 *    accent border on focus.
 *  - State is parent-owned (controlled component). TextInput is purely reactive.
 */

import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';

export interface TextFieldProps extends TextInputProps {
  /** Optional suffix chip shown inside the field (e.g. "USD"). */
  trailing?: string;
  /** Optional leading constant label (e.g. currency symbol). */
  leading?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    style,
    leading,
    trailing,
    multiline,
    placeholderTextColor,
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        multiline ? styles.containerMultiline : null,
        {
          backgroundColor: colors.surfaceHigher,
          borderColor: focused ? colors.accent : colors.border,
        },
        focused ? { boxShadow: '0 0 0 1px ' + colors.accent } : null,
      ]}
    >
      {leading ? (
        <Text variant="body" color={focused ? 'accent' : 'textTertiary'} style={styles.leading}>
          {leading}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor ?? colors.textTertiary}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[styles.input, { color: colors.textPrimary }, style]}
        {...rest}
      />
      {trailing ? (
        <View style={[styles.trailing, { borderLeftColor: colors.border }]}>
          <Text variant="caption" color="textSecondary" weight="600">{trailing}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    // minHeight (not height) so multiline inputs can grow the box.
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.md,
  },
  containerMultiline: {
    alignItems: 'flex-start',
  },
  leading: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 16,
    includeFontPadding: false,
  },
  trailing: {
    borderLeftWidth: 1,
    paddingLeft: spacing.sm,
    marginLeft: spacing.sm,
  },
});