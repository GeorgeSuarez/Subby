/**
 * BrandLockup — Subby brand anchor for the auth screens.
 *
 * The recurring-arrow glyph (the same asset used in the splash screen) sits in
 * a hairline ring with a soft accent glow, beneath the "subby" wordmark.
 * Deliberately static: the calmer variant of the concept keeps the ring still.
 *
 * Skill rules:
 *  - `ui-expo-image`: expo-image only, never RN `Image`.
 *  - `ui-styling`: tokens only; the glow is the theme's `glowAccent` boxShadow
 *    CSS string, no legacy shadow props.
 */

import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';

const GLYPH = require('@/assets/images/splash-icon.png');

export function BrandLockup() {
  const { colors, shadow } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.ring,
          {
            borderColor: colors.border,
            boxShadow: shadow('glowAccent'),
          },
        ]}
      >
        <Image source={GLYPH} style={styles.glyph} contentFit="contain" />
      </View>
      <Text variant="title" weight="600" style={styles.wordmark}>
        Subby
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  ring: {
    width: 96,
    height: 96,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  glyph: {
    width: 64,
    height: 64,
  },
  wordmark: {
    letterSpacing: 0.4,
  },
});
