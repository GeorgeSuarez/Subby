/**
 * Text primitive.
 *
 * Limited type scale (per skill `ui-styling`): hierarchy comes from weight and
 * color, not dozens of font sizes. All variants map to the `typeScale` tokens.
 *
 * Usage:
 *   <Text variant="display">¥12,480</Text>
 *   <Text variant="caption" color="textSecondary">Renews in 3 days</Text>
 */

import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text as RNText } from 'react-native';

import { useTheme } from '@/design/theme';
import {
  fontWeight,
  lineHeight,
  typeScale,
  type Palette,
  type TypeScale,
  type FontWeight,
} from '@/design/tokens';

export type TextVariant = TypeScale;
export type TextColor = keyof Palette | 'inherit';

export type TextProps = Omit<ComponentProps<typeof RNText>, 'color'> & {
  /** Maps to a tokenized size/line-height. Defaults to 'body'. */
  variant?: TextVariant;
  /** Token color name; 'inherit' keeps the inherited text color. Defaults to 'textPrimary'. */
  color?: TextColor;
  weight?: FontWeight;
  align?: 'left' | 'center' | 'right';
  /** Number of lines to clamp before truncation. */
 numberOfLines?: number;
};

const variantStyle = StyleSheet.create({
  display: { fontSize: typeScale.display, lineHeight: lineHeight.display, fontWeight: fontWeight.semibold },
  title: { fontSize: typeScale.title, lineHeight: lineHeight.title, fontWeight: fontWeight.semibold },
  headline: { fontSize: typeScale.headline, lineHeight: lineHeight.headline, fontWeight: fontWeight.semibold },
  body: { fontSize: typeScale.body, lineHeight: lineHeight.body, fontWeight: fontWeight.regular },
  caption: { fontSize: typeScale.caption, lineHeight: lineHeight.caption, fontWeight: fontWeight.regular },
  stat: { fontSize: typeScale.stat, lineHeight: lineHeight.stat, fontWeight: fontWeight.bold },
});

/**
 * Themed text. Resolves color from the active palette via `useTheme()`.
 * Skill rule `ui-styling`: weights/colors vary, not a sprawling type scale.
 */
export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = 'body', color = 'textPrimary', weight, align, style, numberOfLines, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const resolvedColor = color === 'inherit' ? undefined : colors[color];

  return (
    <RNText
      ref={ref}
      numberOfLines={numberOfLines}
      style={[
        variantStyle[variant],
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        resolvedColor ? { color: resolvedColor } : null,
        style,
      ]}
      {...rest}
    />
  );
});

/** Convenience compound label for icon rows. */
export function TextLabel({ children }: { children: ReactNode }) {
  return <Text variant="caption" color="textSecondary">{children}</Text>;
}