/**
 * ProSection — two states, nothing else.
 *
 * No subscription: full plans UX (details + plan options + purchase),
 * shared with the paywall modal via `ProPlans`. Active subscription:
 * status with Manage (App Store / Play Store) and Restore.
 */

import { Linking, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Button, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { restorePurchases } from '@/lib/purchases';
import { ProPlans } from '@/features/paywall/components/ProPlans';
import { useCallback, useState } from 'react';

export function ProSection() {
  const { colors } = useTheme();
  const isPro = useEntitlementStore((s) => s.isPro);
  const productId = useEntitlementStore((s) => s.productId);
  const hydrate = useEntitlementStore((s) => s.hydrate);
  const [restoring, setRestoring] = useState(false);

  const onManage = useCallback(() => {
    // iOS: App Store subscriptions, Android: Play subscriptions.
    const url = 'https://apps.apple.com/account/subscriptions';
    void Linking.openURL(url);
  }, []);

  const onRestore = useCallback(async () => {
    setRestoring(true);
    try {
      await restorePurchases();
      // Re-read the Supabase row (the _layout purchase listener
      // handles most verifications live).
      await hydrate();
    } finally {
      setRestoring(false);
    }
  }, [hydrate]);

  if (isPro) {
    return (
      <View>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.positiveSoft }]}>
            <Ionicons name="star" size={20} color={colors.positive} />
          </View>
          <View style={styles.meta}>
            <View style={styles.titleRow}>
              <Text variant="body" weight="700" color="textPrimary">
                Subby Pro
              </Text>
              <Badge tone="positive">Active</Badge>
            </View>
            <Text variant="caption" color="textSecondary">
              {productId ? productId.replace('subby_pro_', '') : 'Pro'} · All
              features unlocked
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Button onPress={onManage} variant="ghost" size="sm">
            Manage
          </Button>
          <Button
            onPress={onRestore}
            variant="ghost"
            size="sm"
            disabled={restoring}
          >
            {restoring ? 'Restoring…' : 'Restore'}
          </Button>
        </View>
      </View>
    );
  }

  return <ProPlans />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
