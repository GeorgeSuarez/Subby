/**
 * Notifications settings route — thin wrapper; UI lives in the settings feature.
 */

import { RemindersSection, SettingsDetailScreen } from '@/features/settings';

export default function NotificationsSettingsRoute() {
  return (
    <SettingsDetailScreen>
      <RemindersSection />
    </SettingsDetailScreen>
  );
}
