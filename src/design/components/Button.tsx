/**
 * Button — accessible, Pressable-based button.
 *
 * Skill rule `ui-pressable`: ALWAYS use `Pressable`, never `TouchableOpacity`.
 * Press feedback via the `pressed` style callback. Sizes/variants come from
 * tokens. Default to rounded rectangles with subtle accent border for v1.
 *
 * Usage:
 *   <Button onPress={handleAdd} variant="primary">Add subscription</Button>
 *   <Button variant="ghost" size="lg">Cancel</Button>
 */

import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { radius, spacing, type Palette, type Radius } from '@/design/tokens';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<
  ComponentProps<typeof Pressable>,
  'children' | 'style'
> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  /** Align label inside; default is centered. */
  align?: 'start' | 'center';
  borderRadius?: Radius;
  style?: StyleProp<ViewStyle>;
}

const sizeConfig = {
  sm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  md: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  lg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
} as const;

const textSizeFor = {
  sm: 'caption',
  md: 'body',
  lg: 'headline',
} as const;

export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    align = 'center',
    disabled,
    borderRadius = 'md',
    style,
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();
  const colorsByVariant = getVariantColors(variant, colors);
  const sizeStyle = sizeConfig[size];
  const radiusStyle = { borderRadius: radius[borderRadius] };
  const alignStyle =
    align === 'start'
      ? ({ justifyContent: 'flex-start' } as const)
      : ({ justifyContent: 'center' } as const);

  const pressableStyle = ({ pressed }: PressableStateCallbackType) => [
    styles.base,
    sizeStyle,
    radiusStyle,
    colorsByVariant.base,
    alignStyle,
    pressed ? colorsByVariant.pressed : null,
    disabled ? styles.disabled : null,
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
      <Text
        variant={textSizeFor[size]}
        weight="600"
        color={colorsByVariant.textColor}
      >
        {children}
      </Text>
    </Pressable>
  );
});

type VariantColorSet = {
  base: { backgroundColor: string; borderWidth?: number; borderColor?: string };
  pressed: { opacity: number };
  textColor: keyof Palette;
};

function getVariantColors(variant: Variant, colors: Palette): VariantColorSet {
  switch (variant) {
    case 'primary':
      return {
        base: { backgroundColor: colors.accent },
        pressed: { opacity: 0.84 },
        textColor: 'textOnAccent',
      };
    case 'ghost':
      return {
        base: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        },
        pressed: { opacity: 0.6 },
        textColor: 'textPrimary',
      };
    case 'danger':
      return {
        base: { backgroundColor: colors.negativeSoft },
        pressed: { opacity: 0.6 },
        textColor: 'negative',
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
