/**
 * Dashboard tab route — thin re-export from the dashboard feature module.
 *
 * Route files stay one-liners; the actual screen logic lives under
 * `src/features/dashboard/` so it can be unit-tested in isolation and reused
 * without pulling in expo-router internals.
 */

export { DashboardScreen as default } from '@/features/dashboard';
