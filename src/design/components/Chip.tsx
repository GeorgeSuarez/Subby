/**
 * Chip — selectable filter/category pill.
 *
 *   <Chip selected onSelect={onSelect}>Streaming</Chip>
 *
 * Skill `ui-pressable`: Pressable only. The primary accent is used for the
 * selected state; unselected chips use subtle surface elevation.
 */

import { forwardRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableStateCallbackType, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';

export interface ChipProps extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  selected?: boolean;
  /** Optional leading icon (Ionicons name). */
  icon?: string;
  style?: StyleProp<ViewStyle>;
}

export const Chip = forwardRef<View, ChipProps>(function Chip(
  { children, selected = false, disabled, style, ...rest },
  ref,
) {
  const { colors } = useTheme();

  const pressableStyle = ({ pressed }: PressableStateCallbackType) => [
    styles.chip,
    {
      backgroundColor: selected ? colors.accentSoft : colors.surfaceHigher,
      borderColor: selected ? colors.accent : colors.border,
    },
    pressed ? { opacity: 0.6 } : null,
    disabled ? { opacity: 0.4 } : null,
    style,
  ];

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={pressableStyle}
      {...rest}
    >
      <Text
        variant="caption"
        weight={selected ? '600' : '500'}
        color={selected ? 'accent' : 'textSecondary'}
      >
        {children}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.pill,
    gap: spacing.xs,
  },
});