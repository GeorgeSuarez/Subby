/**
 * Avatar — square icon tile backed by `expo-image`.
 *
 * Skill rule `ui-expo-image`: always use `expo-image` (never RN `Image`).
 * Used in subscription rows to display an app favicon or brand glyph.
 *
 * For non-image avatars (e.g. an Ionicon placeholder), pass the `icon` prop
 * instead of `source`.
 */

import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/design/theme';
import { iconName } from '@/design/icons';
import { radius, spacing, type Palette } from '@/design/tokens';

type AvatarSize = 'sm' | 'md' | 'lg';

const pixelsBySize = { sm: 32, md: 44, lg: 64 };
const iconBySize = { sm: 18, md: 22, lg: 32 };

export interface AvatarProps {
  /** Remote image source; omit to use `icon`. */
  source?: string;
  /** Ionicons glyph name shown when no image is provided. */
  icon?: string;
  /** Background color token used behind the icon placeholder. */
  backgroundColor?: keyof Palette;
  size?: AvatarSize;
  /** Override the icon color token. Defaults to 'onAccent' when bg is accent, otherwise accent. */
  iconColor?: keyof Palette;
  rounded?: boolean;
}

export const Avatar = forwardRef<View, AvatarProps>(function Avatar(
  {
    source,
    icon = 'Cube',
    backgroundColor = 'surfaceHigher',
    iconColor,
    size = 'md',
    rounded = false,
  },
  ref,
) {
  const { colors } = useTheme();
  const dim = pixelsBySize[size];
  const r = rounded ? radius.pill : radius.md;
  const resolvedIconColor =
    colors[
      iconColor ?? (backgroundColor === 'accent' ? 'textOnAccent' : 'accent')
    ];

  return (
    <View
      ref={ref}
      style={[
        styles.container,
        {
          width: dim,
          height: dim,
          backgroundColor: colors[backgroundColor],
          borderRadius: r,
        },
      ]}
    >
      {source ? (
        <Image source={source} style={styles.image} contentFit="cover" />
      ) : (
        <Ionicons
          name={iconName(icon)}
          size={iconBySize[size]}
          color={resolvedIconColor}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: spacing.xs,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
