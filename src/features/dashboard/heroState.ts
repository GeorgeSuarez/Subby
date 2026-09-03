/**
 * Dashboard hero state — pure adaptive hero selection.
 *
 * Priority chain (grill Q6): a trial ending within 3 days outranks everything
 * (it expires), then an over-budget or projected-over money state, then the
 * default monthly-spend hero. No timers, no state: fully deterministic for a
 * given set of subscriptions and budget.
 *
 * Skill rules:
 *  - `react-state-minimize`: everything is derived during render.
 *  - No React / RN imports so this module is fully Jest-testable in Node.
 *    It derives from `@/utils/billing` helpers (not dependency-free, but
 *    free of UI framework imports).
 */

import {
  activeTrials,
  monthlyEquivalent,
  projectedMonthEndSpend,
  totalMonthlySpend,
  type ActiveTrial,
} from '@/utils/billing';
import type { Subscription } from '@/types/subscription';

/** A trial ending within this many days takes over the hero. */
export const HERO_TRIAL_WINDOW_DAYS = 3;

export type HeroState =
  | {
      kind: 'trial';
      /** Soonest-ending urgent trial. */
      trial: ActiveTrial;
      /** Monthly-equivalent price once the trial converts. */
      priceAfter: number;
      /** Additional urgent trials beyond the named one. */
      moreCount: number;
    }
  | {
      kind: 'budget';
      /** True when already over (not merely projected over). */
      over: boolean;
      /** Actual overage, or projected overage when only projected. */
      overAmount: number;
      budget: number;
      projected: number;
    }
  | { kind: 'default' };

/**
 * Pick the hero state. Trial urgency first, then money trouble, then the
 * default spend anchor. A zero/negative budget disables the budget state.
 */
export function pickHeroState(
  subs: readonly Subscription[],
  budget: number,
): HeroState {
  const urgent = activeTrials(subs).filter(
    (t) => t.days <= HERO_TRIAL_WINDOW_DAYS,
  );
  const first = urgent[0];
  if (first) {
    const sub = subs.find((s) => s.id === first.id);
    return {
      kind: 'trial',
      trial: first,
      priceAfter: sub ? monthlyEquivalent(sub) : 0,
      moreCount: urgent.length - 1,
    };
  }

  if (Number.isFinite(budget) && budget > 0) {
    const monthly = totalMonthlySpend(subs);
    const projection = projectedMonthEndSpend(subs);
    // Already over spends the budget; otherwise the projection may still
    // land over — one shape, two triggers.
    const over = monthly > budget;
    const overAmount = (over ? monthly : projection.projected) - budget;
    if (overAmount > 0) {
      return {
        kind: 'budget',
        over,
        overAmount,
        budget,
        projected: projection.projected,
      };
    }
  }

  return { kind: 'default' };
}
