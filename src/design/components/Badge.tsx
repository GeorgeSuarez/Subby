/**
 * Badge — small inline status indicator.
 *
 *   <Badge tone="positive">Active</Badge>
 *   <Badge tone="warning">Past due</Badge>
 *
 * Colors come from semantic palette tokens. Skill rule `ui-styling`:
 * `borderCurve: 'continuous'`, `gap`, no inline objects on hot paths.
 */

import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { radius, spacing, type Palette } from '@/design/tokens';

export type BadgeTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'accent';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

type ToneColors = {
  background: keyof Palette;
  text: keyof Palette;
};

function toneColors(tone: BadgeTone): ToneColors {
  switch (tone) {
    case 'positive':
      return { background: 'positiveSoft', text: 'positive' };
    case 'negative':
      return { background: 'negativeSoft', text: 'negative' };
    case 'warning':
      return { background: 'warningSoft', text: 'warning' };
    case 'accent':
      return { background: 'accentSoft', text: 'accent' };
    case 'neutral':
    default:
      return { background: 'surfaceHigher', text: 'textSecondary' };
  }
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  const { colors } = useTheme();
  const t = toneColors(tone);
  return (
    <View style={[styles.badge, { backgroundColor: colors[t.background] }]}>
      <Text variant="caption" weight="600" color={t.text}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.sm,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    borderCurve: 'continuous',
    alignSelf: 'flex-start',
  },
});