/**
 * RemindersSection — renewal-reminder notification toggle.
 *
 * Persisted in the UI store; the store only schedules reminders while this is
 * enabled. Turning it off stops scheduling for new/edited subscriptions (and
 * the wipe/remove paths cancel existing ones).
 *
 * Skill rules:
 *  - `react-state-dispatcher`: the toggle goes through the store action.
 *  - `react-state-minimize`: no local state — the switch mirrors the store.
 */

import { StyleSheet, Switch, View } from 'react-native';

import { useRouter } from 'expo-router';

import { Button, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useRemindersEnabled, useUIStore } from '@/store/useUIStore';
import { useCanUse } from '@/store/useEntitlementStore';

export function RemindersSection() {
  const enabled = useRemindersEnabled();
  const setRemindersEnabled = useUIStore((s) => s.setRemindersEnabled);
  const { colors } = useTheme();
  const canUseReminders = useCanUse('advancedReminders');
  const router = useRouter();

  return (
    <View>
      <View style={[styles.row, { borderBottomColor: colors.hairline }]}>
        <View style={styles.meta}>
          <Text variant="body" weight="600" color="textPrimary">
            Renewal reminders
          </Text>
          <Text variant="caption" color="textSecondary">
            {enabled
              ? 'Scheduled for new and edited subscriptions'
              : 'Off — nothing will be scheduled'}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={setRemindersEnabled}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor={colors.surfaceElevated}
          ios_backgroundColor={colors.border}
          accessibilityRole="switch"
          accessibilityLabel="Renewal reminders"
        />
      </View>
      {!canUseReminders ? (
        <View style={styles.proNote}>
          <Text variant="caption" color="textSecondary">
            Pro unlocks more advanced reminders
          </Text>
          <Button
            onPress={() => router.push('/subscription/paywall')}
            variant="ghost"
            size="sm"
          >
            Unlock Pro
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  meta: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  proNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
