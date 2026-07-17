/**
 * Surface — themed View primitive.
 *
 * Provides a background color token and the base for layout composition.
 * Not a compound component; prefer `Card` for elevated containers.
 */

import { forwardRef, type ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';

import { useTheme } from '@/design/theme';
import type { Palette } from '@/design/tokens';

export type SurfaceProps = ComponentProps<typeof View> & {
  /** Background color token. Defaults to 'surface'. */
  background?: keyof Palette;
  /** Apply subtle elevation border. */
  bordered?: boolean;
};

const styles = StyleSheet.create({
  bordered: { borderWidth: 1, borderCurve: 'continuous' },
});

export const Surface = forwardRef<View, SurfaceProps>(function Surface(
  { background = 'surface', bordered, style, ...rest },
  ref,
) {
  const { colors } = useTheme();
  return (
    <View
      ref={ref}
      style={[
        { backgroundColor: colors[background] },
        bordered ? [styles.bordered, { borderColor: colors.border }] : null,
        style,
      ]}
      {...rest}
    />
  );
});