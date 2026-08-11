/**
 * SettingsScreen — preference hub.
 *
 * Skill rules:
 *  - `react-state-minimize`: every visible value is derived from the persisted
 *    UI store or the subscriptions store. No local screen state.
 *  - `ui-safe-area-scroll`: ScrollView uses `contentInsetAdjustmentBehavior`
 *    so the native tab bar's safe area is honored automatically.
 *  - `rendering-no-falsy-and`: pure composition — no inline conditionals.
 */

import { ScrollView, StyleSheet } from 'react-native';

import { Surface } from '@/design/components/Surface';
import { spacing } from '@/design/tokens';
import { ThemeSection } from '@/features/settings/components/ThemeSection';
import { CurrencySection } from '@/features/settings/components/CurrencySection';
import { AccountSection } from '@/features/settings/components/AccountSection';
import { DemoDataSection } from '@/features/settings/components/DemoDataSection';
import { DangerZoneSection } from '@/features/settings/components/DangerZoneSection';
import { AboutSection } from '@/features/settings/components/AboutSection';

export function SettingsScreen() {
  return (
    <Surface background="surface" style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ThemeSection />
        <CurrencySection />
        <AccountSection />
        <DemoDataSection />
        <DangerZoneSection />
        <AboutSection />
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
});