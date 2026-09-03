/**
 * Native tab bar layout.
 *
 * Skill rule `navigation-native-navigators`: ALWAYS use native navigators —
 * `expo-router/unstable-native-tabs` (NativeTabs) wraps the platform's native
 * tab bar (UITabBarController on iOS, Material Bottom Navigation on Android).
 * Never swap to JS-based `@react-navigation/bottom-tabs`.
 *
 * Three tabs — Dashboard, Subscriptions, Settings. The "Add" action lives on
 * the dashboard as a floating button (`AddFab`) instead of a center tab.
 * Icons:
 *   - iOS: SF Symbols (built in, no asset files required)
 *   - Android: Material drawable names (resolved by `react-native-screens`)
 *
 * Quiet Ledger palette colors the tab bar via design tokens — deep ink-teal
 * accent for selected tint, warm paper/ink surfaces for background.
 */

import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import { useColorMode } from '@/design/theme';
import { darkPalette, lightPalette } from '@/design/tokens';

export default function TabsLayout() {
  const colorMode = useColorMode();
  const isDark = colorMode === 'dark';
  const palette = isDark ? darkPalette : lightPalette;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <NativeTabs
        backgroundColor={palette.surfaceElevated}
        iconColor={{ default: palette.textTertiary, selected: palette.accent }}
        labelStyle={{
          default: {
            color: palette.textTertiary,
            fontWeight: '500',
            fontSize: 10,
          },
          selected: { color: palette.accent, fontWeight: '600', fontSize: 10 },
        }}
      >
        {/* Dashboard — index.tsx */}
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: 'square.grid.2x2',
              selected: 'square.grid.2x2.fill',
            }}
            md="grid_view"
          />
        </NativeTabs.Trigger>

        {/* Subscriptions — subscriptions.tsx */}
        <NativeTabs.Trigger name="subscriptions">
          <NativeTabs.Trigger.Label>Subscriptions</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'list.bullet', selected: 'list.bullet.indent' }}
            md="list"
          />
        </NativeTabs.Trigger>

        {/* Settings — settings.tsx */}
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
            md="settings"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
