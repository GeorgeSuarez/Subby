/**
 * About settings route — thin wrapper; UI lives in the settings feature.
 */

import { AboutSection, SettingsDetailScreen } from '@/features/settings';

export default function AboutSettingsRoute() {
  return (
    <SettingsDetailScreen>
      <AboutSection />
    </SettingsDetailScreen>
  );
}
