/**
 * Currency settings route — thin wrapper; UI lives in the settings feature.
 */

import { CurrencySection, SettingsDetailScreen } from '@/features/settings';

export default function CurrencySettingsRoute() {
  return (
    <SettingsDetailScreen>
      <CurrencySection />
    </SettingsDetailScreen>
  );
}
