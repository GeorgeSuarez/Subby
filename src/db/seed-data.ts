/**
 * Pure seed drafts (no DB imports). Testable in plain Node.
 *
 * Renewal dates are computed relative to today so the dashboard isn't a
 * barren wasteland of "Overdue 400 days" entries on first install.
 */

import { toISODate, todayUTC, addMonths } from '@/utils/billing';
import type { SubscriptionDraft } from '@/types/subscription';

/** Build the seed drafts relative to today so renewals are imminent. */
export function seedDrafts(today: Date = todayUTC()): SubscriptionDraft[] {
  const inDays = (n: number) => toISODate(new Date(today.getTime() + n * 86_400_000));
  const inMonths = (n: number) => toISODate(addMonths(today, n));

  return [
    {
      name: 'Netflix',
      amount: 15.99,
      currency: 'USD',
      cycle: 'monthly',
      nextRenewal: inDays(2),
      category: 'streaming',
      icon: 'film-outline',
      color: '#E50914',
      notes: 'Standard plan, 1080p.',
    },
    {
      name: 'Spotify',
      amount: 11.99,
      currency: 'USD',
      cycle: 'monthly',
      nextRenewal: inDays(5),
      category: 'music',
      icon: 'musical-notes-outline',
      color: '#1DB954',
    },
    {
      name: 'iCloud+',
      amount: 2.99,
      currency: 'USD',
      cycle: 'monthly',
      nextRenewal: inDays(12),
      category: 'cloud',
      icon: 'cloud-outline',
      color: '#3A82F7',
      notes: '200 GB tier.',
    },
    {
      name: 'GitHub',
      amount: 4,
      currency: 'USD',
      cycle: 'monthly',
      nextRenewal: inDays(8),
      category: 'developer',
      icon: 'logo-github',
      color: '#8B949E',
    },
    {
      name: 'Figma',
      amount: 12,
      currency: 'USD',
      cycle: 'monthly',
      nextRenewal: inDays(18),
      category: 'productivity',
      icon: 'brush-outline',
      color: '#A259FF',
    },
    {
      name: 'Disney+',
      amount: 109.99,
      currency: 'USD',
      cycle: 'yearly',
      nextRenewal: inMonths(3),
      category: 'streaming',
      icon: 'film-outline',
      color: '#113CCF',
    },
    {
      name: 'New York Times',
      amount: 25,
      currency: 'USD',
      cycle: 'monthly',
      nextRenewal: inDays(1),
      category: 'news',
      icon: 'newspaper-outline',
      color: '#000000',
    },
  ];
}