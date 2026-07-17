/**
 * EffectiveCostCard — two-column stat block (monthly / yearly) showing the
 * per-cycle amount converted to standard equivalents.
 *
 * Skill rule `react-state-minimize`: both values are derived during render
 * from the subscription, never stored.
 */

import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { getMonthlyCost, getYearlyCost } from '@/features/subscription-detail/detail-helpers';
import { formatCurrency } from '@/utils/format';
import type { Subscription } from '@/types/subscription';

export interface EffectiveCostCardProps {
  sub: Subscription;
  /** Optional notes to render below the cost row. */
  notes?: string;
}

export function EffectiveCostCard({ sub, notes }: EffectiveCostCardProps) {
  const { colors } = useTheme();
  const monthly = getMonthlyCost(sub);
  const yearly = getYearlyCost(sub);

  return (
    <Card padding={spacing.lg} elevation="low">
      <Text variant="caption" color="textSecondary" weight="600">Effective cost</Text>

      <View style={[styles.row, { borderColor: colors.hairline }]}>
        <Stat label="Per month" value={monthly} currency={sub.currency} />
        <Divider />
        <Stat label="Per year" value={yearly} currency={sub.currency} />
      </View>

      {notes ? (
        <View style={[styles.notesRow, { borderTopColor: colors.hairline }]}>
          <Text variant="caption" color="textSecondary">Notes</Text>
          <Text variant="body" color="textPrimary">{notes}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function Stat({
  label,
  value,
  currency,
}: {
  label: string;
  value: number;
  currency: Subscription['currency'];
}) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" color="textTertiary">{label}</Text>
      <Text variant="headline" weight="700" color="textPrimary">
        {formatCurrency(value, currency)}
      </Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.hairline }]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    alignItems: 'stretch',
  },
  stat: {
    flex: 1,
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.xs,
  },
  divider: {
    width: 1,
    marginVertical: spacing.xs,
  },
  notesRow: {
    borderTopWidth: 1,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
});