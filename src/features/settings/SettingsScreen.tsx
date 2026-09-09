/**
 * SettingsScreen — preference hub.
 *
 * A grouped menu: each row pushes the dedicated screen (see
 * `src/app/settings/`). Detail screens reuse the existing section
 * components unchanged.
 *
 * Skill rules:
 *  - `react-state-minimize`: no local screen state (the demo-info refresh
 *    mirrors `DemoDataSection`'s one-shot query for the Developer gating).
 *  - `ui-safe-area-scroll`: ScrollView uses `contentInsetAdjustmentBehavior`
 *    so the native tab bar's safe area is honored automatically.
 *  - `rendering-no-falsy-and`: ternaries only.
 */

import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { Card, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { spacing } from '@/design/tokens';
import { SettingsMenuRow } from '@/features/settings/components/SettingsMenuRow';
import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { ENABLE_DEMO_DATA } from '@/utils/environment';

export function SettingsScreen() {
  const router = useRouter();

  const email = useAuthStore((s) => s.email);
  const demoInfo = useDemoDataStore((s) => s.info);
  const refreshDemoInfo = useDemoDataStore((s) => s.refresh);

  // Same one-shot status query `DemoDataSection` runs — the Developer rows
  // need it for their summaries and gating.
  useEffect(() => {
    void refreshDemoInfo(email);
  }, [refreshDemoInfo, email]);

  const showDeveloper = ENABLE_DEMO_DATA && demoInfo?.isAllowed === true;

  return (
    <Surface background="surface" style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="title" weight="700" accessibilityRole="header">
          Settings
        </Text>
        <Card padding={spacing.lg} elevation="low" style={styles.menu}>
          <SettingsMenuRow
            label="Subby Pro"
            description="Upgrade, manage, restore"
            onPress={() => router.push('/settings/pro')}
            showDivider={false}
          />
          <SettingsMenuRow
            label="Theme"
            description="System, light, or dark"
            onPress={() => router.push('/settings/theme')}
          />
          <SettingsMenuRow
            label="Currency"
            description="Default for all amounts"
            onPress={() => router.push('/settings/currency')}
          />
          <SettingsMenuRow
            label="Budget"
            description="Monthly cap for the dashboard"
            onPress={() => router.push('/settings/budget')}
          />
          <SettingsMenuRow
            label="Notifications"
            description="Renewal-reminder alerts"
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingsMenuRow
            label="Account"
            description="Session, verify, sign out"
            onPress={() => router.push('/settings/account')}
          />
          {showDeveloper ? (
            <SettingsMenuRow
              label="Demo data"
              description="Seed data, test account"
              onPress={() => router.push('/settings/demo-data')}
            />
          ) : null}
          {showDeveloper ? (
            <SettingsMenuRow
              label="Danger zone"
              description="Wipe all subscription data"
              onPress={() => router.push('/settings/danger-zone')}
            />
          ) : null}
          <SettingsMenuRow
            label="About"
            description="Name, version, build"
            onPress={() => router.push('/settings/about')}
          />
        </Card>
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  menu: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
});
