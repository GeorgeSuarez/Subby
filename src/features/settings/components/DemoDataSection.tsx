/**
 * DemoDataSection — load / remove seeded data, test account only.
 *
 * Renders nothing for any account other than the test account
 * (`test@subby.app`); the actual rule is enforced at the data layer in
 * `src/db/seed.ts`, so the UI hiding is just presentation.
 *
 * Skill rules:
 *  - `ui-menus`: destructive confirmation via native `Alert.alert`.
 *  - `ui-pressable`: design-system Button (Pressable-based).
 *  - `react-state-minimize`: status comes from the demo-data store (one-shot
 *    DB query), refreshed via a store action from the effect — no local
 *    component state.
 *  - `rendering-no-falsy-and`: ternaries only.
 */

import { useCallback, useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { loadSeedData, removeSeedData } from '@/db/seed';
import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import { TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD } from '@/utils/constants';
import { notifySuccess, notifyWarning } from '@/utils/haptics';

export function DemoDataSection() {
  const { colors } = useTheme();
  const email = useAuthStore((s) => s.email);
  const info = useDemoDataStore((s) => s.info);
  const refresh = useDemoDataStore((s) => s.refresh);

  useEffect(() => {
    void refresh(email);
  }, [refresh, email]);

  const onLoad = useCallback(async () => {
    const result = await loadSeedData(email);
    if (result === 'done') {
      void notifySuccess();
    } else if (result === 'denied') {
      void notifyWarning();
      return;
    }
    await useSubscriptionsStore.getState().hydrate();
    await refresh(email);
  }, [email, refresh]);

  const onRemove = useCallback(() => {
    void notifyWarning();
    Alert.alert(
      'Remove demo data?',
      `This deletes the ${info?.count ?? 0} seeded subscription${(info?.count ?? 0) === 1 ? '' : 's'}. Your own subscriptions are untouched.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove demo data',
          style: 'destructive',
          onPress: async () => {
            const result = await removeSeedData(email);
            if (result === 'done') {
              void notifySuccess();
            }
            await useSubscriptionsStore.getState().hydrate();
            await refresh(email);
          },
        },
      ],
      { cancelable: true },
    );
  }, [email, info?.count, refresh]);

  // Rule enforcement starts here: not the test account → nothing renders.
  if (!info?.isAllowed) return null;

  return (
    <Card padding={spacing.lg} elevation="flat">
      <Card.Header>
        <Text variant="headline" weight="600">Demo data</Text>
        <Text variant="caption" color="textSecondary">
          Test account: {TEST_ACCOUNT_EMAIL} / {TEST_ACCOUNT_PASSWORD} — demo controls are exclusive to it.
        </Text>
      </Card.Header>

      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={styles.meta}>
          <Text variant="body" weight="600" color="textPrimary">
            {info.loaded ? `${info.count} demo subscription${info.count === 1 ? '' : 's'} loaded` : 'No demo data loaded'}
          </Text>
          <Text variant="caption" color="textSecondary">
            {info.loaded ? 'Seeded rows are tracked separately from your data.' : 'Signing in loads the seed set automatically.'}
          </Text>
        </View>
        {info.loaded ? (
          <Button onPress={onRemove} variant="danger" size="sm">Remove</Button>
        ) : (
          <Button onPress={onLoad} variant="ghost" size="sm">Load</Button>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderCurve: 'continuous',
    padding: spacing.md,
    gap: spacing.sm,
  },
  meta: {
    flex: 1,
    gap: spacing.xs / 2,
  },
});
