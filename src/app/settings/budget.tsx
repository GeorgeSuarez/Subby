/**
 * Budget settings route — thin wrapper; UI lives in the settings feature.
 */

import { BudgetSection, SettingsDetailScreen } from '@/features/settings';

export default function BudgetSettingsRoute() {
  return (
    <SettingsDetailScreen>
      <BudgetSection />
    </SettingsDetailScreen>
  );
}
