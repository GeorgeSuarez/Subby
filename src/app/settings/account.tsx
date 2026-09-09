/**
 * Account settings route — thin wrapper; UI lives in the settings feature.
 */

import { AccountSection, SettingsDetailScreen } from '@/features/settings';

export default function AccountSettingsRoute() {
  return (
    <SettingsDetailScreen>
      <AccountSection />
    </SettingsDetailScreen>
  );
}
