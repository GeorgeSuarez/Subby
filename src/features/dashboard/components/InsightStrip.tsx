/**
 * InsightStrip — the dashboard's single-line insight card.
 *
 * One sentence, one icon, derived during render from `pickInsight` — the
 * card only renders when an insight applies. Tint follows the insight kind:
 * urgent (trial) reads warning, everything else reads accent.
 *
 * Skill rules:
 *  - `rendering-no-falsy-and`: ternaries only.
 *  - `ui-styling`: tokens only.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import type { Insight, InsightKind } from '@/features/dashboard/insights';

const ICONS = {
  trial: 'gift-outline',
  savings: 'wallet-outline',
  biggest: 'arrow-up-circle-outline',
  category: 'pie-chart-outline',
  peak: 'trending-up-outline',
  currency: 'swap-horizontal-outline',
} as const satisfies Record<InsightKind, keyof typeof Ionicons.glyphMap>;

export function InsightStrip({ insight }: { insight: Insight }) {
  const { colors } = useTheme();
  const accent = insight.kind === 'trial' ? colors.warning : colors.accent;

  return (
    <Card padding={spacing.md} elevation="low">
      <View style={styles.row}>
        <Ionicons name={ICONS[insight.kind]} size={18} color={accent} />
        <Text
          variant="body"
          weight="600"
          color="textPrimary"
          style={styles.text}
        >
          {insight.text}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    flex: 1,
  },
});
