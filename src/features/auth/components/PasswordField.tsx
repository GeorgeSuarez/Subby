/**
 * PasswordField — secure TextField with a show/hide eye toggle.
 *
 * The toggle is an absolutely-positioned Pressable (IconButton) over the
 * field's right edge; the input's right padding keeps typed text clear of it.
 * Visibility is local component state — the field stays controlled.
 *
 * Skill rules:
 *  - `ui-pressable`: Pressable-based IconButton, never Touchable*.
 *  - `react-state-minimize`: only the visibility flag lives here.
 */

import { forwardRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { IconButton } from '@/design/components';
import { TextField, type TextFieldProps } from '@/features/add-subscription/components/TextField';
import { spacing } from '@/design/tokens';
import { selection } from '@/utils/haptics';

export type PasswordFieldProps = Omit<TextFieldProps, 'secureTextEntry' | 'textContentType'> & {
  /** Autofill hint; parent picks per mode (current-password / new-password). */
  textContentType: TextFieldProps['textContentType'];
};

export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(function PasswordField(
  { style, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <TextField
        ref={ref}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, style]}
        {...rest}
      />
      <IconButton
        name={visible ? 'eye-off' : 'eye'}
        size={20}
        color="textTertiary"
        onPress={() => {
          setVisible((prev) => !prev);
          void selection();
        }}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        style={styles.toggle}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  input: {
    paddingRight: spacing['2xl'],
  },
  toggle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: spacing.xs,
    justifyContent: 'center',
  },
});
