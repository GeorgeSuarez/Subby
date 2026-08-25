import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import type { ProProductId } from '@/utils/limits';
import type { IAPProduct } from '@/lib/purchases';

interface PlanToggleProps {
  products: IAPProduct[];
  selected: ProProductId;
  onSelect: (id: ProProductId) => void;
}

const ORDER: ProProductId[] = [
  'subby_pro_monthly',
  'subby_pro_yearly',
  'subby_pro_lifetime',
];

// Inferred keys + satisfies keeps exhaustiveness over ProProductId without
// widening the binding to an open Record.
const LABELS = {
  subby_pro_monthly: { title: 'Monthly', sub: '$2.99 / month' },
  subby_pro_yearly: { title: 'Yearly', sub: 'Save 44%' },
  subby_pro_lifetime: { title: 'Lifetime', sub: 'Pay once' },
} as const satisfies Record<ProProductId, { title: string; sub: string }>;

export function PlanToggle({ products, selected, onSelect }: PlanToggleProps) {
  const { colors } = useTheme();

  function priceFor(id: string): string | null {
    const p = products.find((x) => x.id === id);
    if (!p) return null;
    return p.price || null;
  }

  return (
    <View style={styles.root}>
      {ORDER.map((id) => {
        const meta = LABELS[id];
        const price = priceFor(id);
        const active = selected === id;
        return (
          <Pressable
            key={id}
            onPress={() => onSelect(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.card,
              {
                borderColor: active ? colors.accent : colors.border,
                backgroundColor: active
                  ? colors.accentSoft
                  : colors.surfaceElevated,
                borderRadius: radius.lg,
              },
            ]}
          >
            <View style={styles.header}>
              <Text variant="body" weight="700" color="textPrimary">
                {meta.title}
              </Text>
              {id === 'subby_pro_yearly' ? (
                <Badge tone="positive">Best value</Badge>
              ) : null}
            </View>
            <Text variant="caption" color="textSecondary">
              {id === 'subby_pro_yearly' ? '7-day free trial, then ' : ''}
              {price ?? meta.sub}
              {id === 'subby_pro_yearly' && price ? ' / year' : ''}
            </Text>
            {id === 'subby_pro_yearly' ? (
              <Text variant="caption" color="textTertiary">
                7-day free trial
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1.5,
    borderCurve: 'continuous',
    padding: spacing.md,
    gap: spacing.xs / 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
