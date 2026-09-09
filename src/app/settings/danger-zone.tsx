/**
 * Danger zone settings route — thin wrapper; UI lives in the settings feature.
 * Dev-only: the hub only links here for the test account.
 */

import { DangerZoneSection, SettingsDetailScreen } from '@/features/settings';

export default function DangerZoneSettingsRoute() {
  return (
    <SettingsDetailScreen>
      <DangerZoneSection />
    </SettingsDetailScreen>
  );
}
