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

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useRemindersEnabled, useUIStore } from '@/store/useUIStore';

export function RemindersSection() {
  const enabled = useRemindersEnabled();
  const setRemindersEnabled = useUIStore((s) => s.setRemindersEnabled);
  const { colors } = useTheme();

  return (
    <Card padding={spacing.lg} elevation="flat">
      <Card.Header>
        <Text variant="headline" weight="600">
          Notifications
        </Text>
        <Text variant="caption" color="textSecondary">
          Remind me a day before each renewal.
        </Text>
      </Card.Header>

      <View style={[styles.row, { borderColor: colors.border }]}>
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
