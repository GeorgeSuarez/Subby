/**
 * Settings tab stub.
 *
 * Real implementation lands in Step 10 (Theme toggle, currency picker,
 * danger zone). For now confirms the persisted UI store + theme store wire
 * together.
 */

import { StyleSheet } from 'react-native';

import { Card , Text , SegmentedControl } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { useColorMode, useThemeStore } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useCurrency } from '@/store/useUIStore';
import { CURRENCIES } from '@/utils/constants';
import type { ThemePreference } from '@/design/theme-resolve';

export default function SettingsScreen() {
  const colorMode = useColorMode();
  const setPreference = useThemeStore((s) => s.setPreference);
  const preference = useThemeStore((s) => s.preference);
  const currency = useCurrency();
  const resolvedPref: ThemePreference = preference ?? 'system';

  return (
    <Surface background="surface" style={styles.container}>
      <Card>
        <Text variant="headline" weight="600" color="textPrimary">Theme</Text>
        <Text variant="caption" color="textSecondary">
          Active scheme: {colorMode}
        </Text>
        <SegmentedControl
          segments={['system', 'light', 'dark']}
          selectedIndex={['system', 'light', 'dark'].indexOf(resolvedPref)}
          onSelect={(i) => setPreference((['system', 'light', 'dark'] as const)[i] ?? 'system')}
        />
      </Card>

      <Card>
        <Text variant="headline" weight="600" color="textPrimary">Currency</Text>
        <Text variant="body" color="textSecondary">{currency}</Text>
        <Text variant="caption" color="textTertiary">
          Available: {CURRENCIES.map((c) => c.code).join(', ')}
        </Text>
      </Card>

      <Text variant="caption" color="textTertiary">
        Settings screen — full implementation arrives in Step 10.
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
});