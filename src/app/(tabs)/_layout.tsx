/**
 * Native tab bar layout.
 *
 * Skill rule `navigation-native-navigators`: ALWAYS use native navigators —
 * `expo-router/unstable-native-tabs` (NativeTabs) wraps the platform's native
 * tab bar (UITabBarController on iOS, Material Bottom Navigation on Android).
 * Never swap to JS-based `@react-navigation/bottom-tabs`.
 *
 * Four tabs — Dashboard, Subscriptions, Add (center action), Settings. The
 * center "Add" tab is a transparent redirect that opens the
 * `/subscription/add` modal and immediately returns the user to their previous
 * tab when dismissed. Icons:
 *   - iOS: SF Symbols (built in, no asset files required)
 *   - Android: Material drawable names (resolved by `react-native-screens`)
 *
 * The dark-first palette colors the tab bar via the design tokens defined in
 * Step 2 — accent `#22D3EE` is used for the selected tint so the active tab
 * reads on the dark surface.
 */

import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useColorMode } from "@/design/theme";
import { darkPalette, lightPalette } from "@/design/tokens";

export default function TabsLayout() {
  const colorMode = useColorMode();
  const isDark = colorMode === "dark";
  const palette = isDark ? darkPalette : lightPalette;

  return (
    <NativeTabs
      backgroundColor={palette.surfaceElevated}
      iconColor={{ default: palette.textTertiary, selected: palette.accent }}
      labelStyle={{
        default: {
          color: palette.textTertiary,
          fontWeight: "500",
          fontSize: 10,
        },
        selected: { color: palette.accent, fontWeight: "600", fontSize: 10 },
      }}
    >
      {/* Dashboard — index.tsx */}
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
          md="grid_view"
        />
      </NativeTabs.Trigger>

      {/* Subscriptions — subscriptions.tsx */}
      <NativeTabs.Trigger name="subscriptions">
        <NativeTabs.Trigger.Label>Subscriptions</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "list.bullet", selected: "list.bullet.indent" }}
          md="list"
        />
      </NativeTabs.Trigger>

      {/* Add — center action tab. Redirects to /subscription/add modal. */}
      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Label>Add</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "plus", selected: "plus.app.fill" }}
          md="add"
        />
      </NativeTabs.Trigger>

      {/* Settings — settings.tsx */}
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          md="settings"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
