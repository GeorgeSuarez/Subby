/**
 * IconButton — square Pressable wrapping a single icon symbol/string.
 *
 * Skill rule `ui-pressable`: Pressable only. Used for app-bar back/close actions,
 * FAB-style row trailing actions.
 */

import { forwardRef, type ComponentProps } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/design/theme';
import { radius, spacing, type Palette } from '@/design/tokens';

type Variant = 'solid' | 'ghost';

export interface IconButtonProps extends Omit<
  ComponentProps<typeof Pressable>,
  'style'
> {
  /** Ionicons glyph name. */
  name: keyof typeof Ionicons.glyphMap | string;
  size?: number;
  color?: keyof Palette;
  variant?: Variant;
  backgroundColor?: keyof Palette;
  borderRadius?: keyof typeof radius;
  style?: StyleProp<ViewStyle>;
}

export const IconButton = forwardRef<View, IconButtonProps>(function IconButton(
  {
    name,
    size = 22,
    color = 'textPrimary',
    variant = 'ghost',
    backgroundColor,
    borderRadius = 'pill',
    disabled,
    style,
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();
  const iconColor = colors[color];

  const pressableStyle = ({ pressed }: PressableStateCallbackType) => [
    styles.base,
    { borderRadius: radius[borderRadius] },
    variant === 'solid'
      ? { backgroundColor: colors[backgroundColor ?? 'surfaceHigher'] }
      : { backgroundColor: 'transparent' },
    pressed ? { opacity: 0.6 } : null,
    disabled ? { opacity: 0.4 } : null,
    style,
  ];

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={pressableStyle}
      {...rest}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={name as never} size={size} color={iconColor} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    padding: spacing.xs,
  },
});
