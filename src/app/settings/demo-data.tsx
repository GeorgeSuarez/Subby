/**
 * Demo data settings route — thin wrapper; UI lives in the settings feature.
 * Dev-only: the hub only links here for the test account.
 */

import { DemoDataSection, SettingsDetailScreen } from '@/features/settings';

export default function DemoDataSettingsRoute() {
  return (
    <SettingsDetailScreen>
      <DemoDataSection />
    </SettingsDetailScreen>
  );
}
