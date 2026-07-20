/**
 * DangerZoneSection — destructive settings: wipe all subscription data.
 *
 * Skill rules:
 *  - `ui-menus`: confirmation via native `Alert.alert` (iOS UIAlertController /
 *    Android material dialog). Two-step confirm: first alert explains cost,
 *    second alert forces the user to type-acknowledge by tapping the
 *    destructive button again.
 *  - `ui-pressable`: uses the design-system Button (Pressable-based).
 *  - `react-state-dispatcher`: mutation goes through the store's `clearAll`,
 *    which re-reads from SQLite after the wipe and updates the cache.
 *  - `react-state-minimize`: no local state — the count shown here is derived
 *    from the store's `subs` array length.
 */

import { useCallback } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import { notifyWarning, notifySuccess } from '@/utils/haptics';

export function DangerZoneSection() {
  const { colors } = useTheme();
  const subs = useSubscriptionsStore((s) => s.subs);
  const clearAll = useSubscriptionsStore((s) => s.clearAll);

  const onWipe = useCallback(() => {
    void notifyWarning();
    Alert.alert(
      'Wipe all subscriptions?',
      `This permanently deletes all ${subs.length} subscription record${subs.length === 1 ? '' : 's'} from this device. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe all',
          style: 'destructive',
          onPress: () => {
            // Second-step confirm: re-prompt so a tap race doesn't nuke data.
            void notifyWarning();
            Alert.alert(
              'Are you sure?',
              'Tap "Wipe" again to confirm. All subscription data will be lost.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Wipe',
                  style: 'destructive',
                  onPress: () => {
                    void clearAll().then(() => { void notifySuccess(); });
                  },
                },
              ],
              { cancelable: true },
            );
          },
        },
      ],
      { cancelable: true },
    );
  }, [subs.length, clearAll]);

  return (
    <Card padding={spacing.lg} elevation="flat">
      <Card.Header>
        <Text variant="headline" weight="600" color="negative">Danger zone</Text>
        <Text variant="caption" color="textSecondary">
          Destructive actions below cannot be undone.
        </Text>
      </Card.Header>

      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={styles.meta}>
          <Text variant="body" weight="600" color="textPrimary">Wipe all subscriptions</Text>
          <Text variant="caption" color="textSecondary">
            {subs.length} record{subs.length === 1 ? '' : 's'} stored
          </Text>
        </View>
        <Button onPress={onWipe} variant="danger" size="sm">Wipe</Button>
      </View>
    </Card>
  );
}

// Local View import kept inline to avoid name collisions in this file.
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