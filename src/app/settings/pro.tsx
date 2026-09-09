/**
 * Subby Pro settings route — thin wrapper; UI lives in the settings feature.
 */

import { ProSection, SettingsDetailScreen } from '@/features/settings';

export default function ProSettingsRoute() {
  return (
    <SettingsDetailScreen>
      <ProSection />
    </SettingsDetailScreen>
  );
}
