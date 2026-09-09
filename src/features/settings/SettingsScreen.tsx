/**
 * SettingsScreen — preference hub.
 *
 * A menu list: each row pushes the dedicated screen (see
 * `src/app/settings/`). Detail screens reuse the existing section
 * components unchanged.
 *
 * Skill rules:
 *  - `react-state-minimize`: no local screen state (the demo-info refresh
 *    mirrors `DemoDataSection`'s one-shot query for the Developer gating).
 *  - `list-performance-virtualize`: not applicable — nine static rows stay
 *    in a data-driven ScrollView (`items` + `map`) so flex can distribute
 *    them across the viewport; virtualization would only add overhead.
 *  - `ui-safe-area-scroll`: list uses `contentInsetAdjustmentBehavior`
 *    so the native tab bar's safe area is honored automatically.
 *  - `rendering-no-falsy-and`: ternaries only.
 */

import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { spacing } from '@/design/tokens';
import { SettingsMenuRow } from '@/features/settings/components/SettingsMenuRow';
import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { ENABLE_DEMO_DATA } from '@/utils/environment';

interface SettingsMenuItem {
  id: string;
  label: string;
  description: string;
  onPress: () => void;
}

function renderMenuItem(item: SettingsMenuItem) {
  return (
    <SettingsMenuRow
      key={item.id}
      label={item.label}
      description={item.description}
      onPress={item.onPress}
      showDivider={item.id !== 'pro'}
    />
  );
}

export function SettingsScreen() {
  const router = useRouter();

  const email = useAuthStore((s) => s.email);
  const demoInfo = useDemoDataStore((s) => s.info);
  const refreshDemoInfo = useDemoDataStore((s) => s.refresh);

  // Same one-shot status query `DemoDataSection` runs — the Developer rows
  // need it for their gating.
  useEffect(() => {
    void refreshDemoInfo(email);
  }, [refreshDemoInfo, email]);

  const showDeveloper = ENABLE_DEMO_DATA && demoInfo?.isAllowed === true;

  const items: SettingsMenuItem[] = [
    {
      id: 'pro',
      label: 'Subby Pro',
      description: 'Upgrade, manage, restore',
      onPress: () => router.push('/settings/pro'),
    },
    {
      id: 'theme',
      label: 'Theme',
      description: 'System, light, or dark',
      onPress: () => router.push('/settings/theme'),
    },
    {
      id: 'currency',
      label: 'Currency',
      description: 'Default for all amounts',
      onPress: () => router.push('/settings/currency'),
    },
    {
      id: 'budget',
      label: 'Budget',
      description: 'Monthly cap for the dashboard',
      onPress: () => router.push('/settings/budget'),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      description: 'Renewal-reminder alerts',
      onPress: () => router.push('/settings/notifications'),
    },
    {
      id: 'account',
      label: 'Account',
      description: 'Session, verify, sign out',
      onPress: () => router.push('/settings/account'),
    },
    ...(showDeveloper
      ? [
          {
            id: 'demo-data',
            label: 'Demo data',
            description: 'Seed data, test account',
            onPress: () => router.push('/settings/demo-data'),
          },
          {
            id: 'danger-zone',
            label: 'Danger zone',
            description: 'Wipe all subscription data',
            onPress: () => router.push('/settings/danger-zone'),
          },
        ]
      : []),
    {
      id: 'about',
      label: 'About',
      description: 'Name, version, build',
      onPress: () => router.push('/settings/about'),
    },
  ];

  const header = (
    <Text
      variant="title"
      weight="700"
      accessibilityRole="header"
      style={styles.header}
    >
      Settings
    </Text>
  );

  return (
    <Surface background="surface" style={styles.root}>
      <View style={styles.content}>
        {header}
        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {items.map(renderMenuItem)}
        </ScrollView>
      </View>
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
    flex: 1,
    padding: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  header: {
    paddingBottom: spacing.xs,
  },
  listContent: {
    flexGrow: 1,
  },
});
