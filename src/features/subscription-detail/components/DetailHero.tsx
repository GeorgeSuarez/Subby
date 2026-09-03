/**
 * DetailHero — large branded icon tile + subscription name, amount, cycle,
 * and category badge. Visually anchors the detail modal.
 *
 * Skill rules:
 *  - `ui-styling`: borderCurve 'continuous', gap not margins, CSS boxShadow.
 *  - `ui-expo-image`: N/A here (no remote image) — Avatar falls back to Ionicons.
 *  - `react-state-minimize`: every visible is derived from the subscription
 *    prop (a primitive domain object reference, stable across re-renders).
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge, type BadgeTone, Text } from '@/design/components';
import { iconName } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { layout, radius, spacing } from '@/design/tokens';
import { cycleMeta, categoryMeta } from '@/utils/constants';
import { formatCurrency, formatCycle, cycleSuffix } from '@/utils/format';
import { brandBackground } from '@/utils/brand';
import type { Subscription } from '@/types/subscription';

export interface DetailHeroProps {
  sub: Subscription;
}

export function DetailHero({ sub }: DetailHeroProps) {
  const { colors, shadow } = useTheme();
  const cat = categoryMeta(sub.category);
  const cycle = cycleMeta(sub.cycle);

  const brandBg = brandBackground(sub.name, sub.category);
  const tint = sub.color ? sub.color : brandBg;
  const badgeTone: BadgeTone = sub.archived ? 'warning' : 'accent';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.tile,
          {
            backgroundColor: colors.surfaceHigher,
            borderColor: colors.border,
            borderRadius: radius.xl,
            boxShadow: shadow('glowAccent'),
          },
        ]}
      >
        <Ionicons name={iconName(sub.icon)} size={48} color={tint} />
      </View>

      <View style={styles.body}>
        <View style={styles.labelRow}>
          <Text
            variant="title"
            weight="700"
            color="textPrimary"
            numberOfLines={1}
          >
            {sub.name}
          </Text>
          <Badge tone={badgeTone}>
            {sub.archived ? 'Archived' : cat.label}
          </Badge>
        </View>

        <View style={styles.amountRow}>
          <Text variant="stat" weight="700" color="textPrimary">
            {formatCurrency(sub.amount, sub.currency)}
          </Text>
          <Text variant="caption" color="textSecondary" style={styles.perCycle}>
            {cycleSuffix(sub.cycle)}
          </Text>
        </View>

        <Text variant="caption" color="textTertiary">
          {formatCycle(sub.cycle)} · renews {cycle.label.toLowerCase()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  tile: {
    width: layout.fabSize + 16,
    height: layout.fabSize + 16,
    borderWidth: 1,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  perCycle: {
    marginBottom: spacing.xs,
  },
});
