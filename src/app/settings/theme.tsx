/**
 * Theme settings route — thin wrapper; UI lives in the settings feature.
 */

import { ThemeSection, SettingsDetailScreen } from '@/features/settings';

export default function ThemeSettingsRoute() {
  return (
    <SettingsDetailScreen>
      <ThemeSection />
    </SettingsDetailScreen>
  );
}
