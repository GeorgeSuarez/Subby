import { pickHeroState } from '@/features/dashboard/heroState';
import { pickInsightExcept } from '@/features/dashboard/insights';
import type { CurrencyCode, Subscription } from '@/types/subscription';

const USD: CurrencyCode = 'USD';

const base = (overrides: Partial<Subscription>): Subscription => ({
  id: 'test',
  name: 'Sub',
  amount: 12,
  currency: 'USD',
  cycle: 'monthly',
  nextRenewal: '2099-01-01',
  category: 'other',
  icon: 'cube-outline',
  notes: undefined,
  createdAt: 0,
  updatedAt: 0,
  archived: false,
  ...overrides,
});

/** ISO date exactly N days from today (UTC). */
function inDays(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe('pickHeroState', () => {
  it('defaults to the monthly-spend hero', () => {
    expect(pickHeroState([base({ id: 'a' })], 60)).toEqual({
      kind: 'default',
    });
  });

  it('names the soonest urgent trial and counts the rest', () => {
    const state = pickHeroState(
      [
        base({ id: 'a', name: 'Framer', trialEnds: inDays(2) }),
        base({ id: 'b', name: 'Linear', trialEnds: inDays(1) }),
        base({ id: 'c', name: 'Slow', trialEnds: inDays(9) }),
      ],
      60,
    );
    expect(state.kind).toBe('trial');
    if (state.kind !== 'trial') return;
    expect(state.trial.name).toBe('Linear');
    expect(state.more).toBe(1);
    expect(state.priceAfter).toBe(12);
  });

  it('prefers the trial hero over an over-budget state', () => {
    const state = pickHeroState(
      [base({ id: 'a', amount: 100, trialEnds: inDays(2) })],
      60,
    );
    expect(state.kind).toBe('trial');
  });

  it('shows the budget hero when already over', () => {
    const state = pickHeroState([base({ id: 'a', amount: 100 })], 60);
    expect(state.kind).toBe('budget');
    if (state.kind !== 'budget') return;
    expect(state.over).toBe(true);
    expect(state.overAmount).toBe(100 - 60);
  });

  it('shows the budget hero when only projected over', () => {
    // A $700/yr sub renewing this month costs $58.33/mo on paper but charges
    // $700 in reality — projected over a $60 budget without being over yet.
    const state = pickHeroState(
      [
        base({
          id: 'a',
          amount: 700,
          cycle: 'yearly',
          nextRenewal: inDays(5),
        }),
      ],
      60,
    );
    expect(state.kind).toBe('budget');
    if (state.kind !== 'budget') return;
    expect(state.over).toBe(false);
    expect(state.overAmount).toBeGreaterThan(0);
  });

  it('ignores the budget state when no budget is set', () => {
    expect(pickHeroState([base({ id: 'a', amount: 100 })], 0)).toEqual({
      kind: 'default',
    });
  });
});

describe('pickInsightExcept', () => {
  it('skips the excluded kind and returns the next one', () => {
    const insight = pickInsightExcept(
      [base({ id: 'a', name: 'Framer', trialEnds: inDays(2) })],
      USD,
      'trial',
    );
    // The trial topic belongs to the hero — the strip drops to savings.
    expect(insight?.kind).toBe('savings');
  });

  it('hides when nothing remains after the exclusion', () => {
    const insight = pickInsightExcept(
      [
        base({
          id: 'a',
          name: 'Framer',
          amount: 120,
          cycle: 'yearly',
          trialEnds: inDays(2),
        }),
      ],
      USD,
      'trial',
    );
    expect(insight).toBeNull();
  });

  it('behaves like pickInsight with no exclusion', () => {
    const insight = pickInsightExcept(
      [base({ id: 'a', name: 'Framer', trialEnds: inDays(2) })],
      USD,
      null,
    );
    expect(insight?.kind).toBe('trial');
  });
});
