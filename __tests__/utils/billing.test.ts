import {
  addMonths,
  budgetProgress,
  categoryBreakdown,
  daysBetween,
  daysUntilRenewal,
  groupByCategory,
  largestMonthly,
  monthlyEquivalent,
  monthlyForecast,
  nextRenewalAfter,
  parseDate,
  reminderDateFor,
  renewalsThisMonth,
  renewalsWithin,
  renewalUrgencyTone,
  toISODate,
  totalMonthlySpend,
  totalYearlySpend,
  yearlyEquivalent,
  yearlySavingsHint,
} from '@/utils/billing';
import type { Subscription } from '@/types/subscription';

const sub = (overrides: Partial<Subscription>): Subscription => ({
  id: 'test',
  name: 'Test',
  amount: 12,
  currency: 'USD',
  cycle: 'monthly',
  nextRenewal: '2026-07-16',
  category: 'streaming',
  icon: 'film-outline',
  color: '#000',
  notes: undefined,
  createdAt: 0,
  updatedAt: 0,
  archived: false,
  ...overrides,
});

describe('parseDate / toISODate', () => {
  it('round-trips YYYY-MM-DD', () => {
    expect(toISODate(parseDate('2026-02-14'))).toBe('2026-02-14');
    expect(toISODate(parseDate('2026-12-31'))).toBe('2026-12-31');
  });

  it('throws on bad input', () => {
    expect(() => parseDate('not-a-date')).toThrow();
    expect(() => parseDate('2026-13-01')).not.toThrow(); // JS will normalize invalid month -> overflow is silent here, just sanity-check we don't throw on a 13 month
  });
});

describe('addMonths', () => {
  it('adds months without changing the day', () => {
    expect(toISODate(addMonths(parseDate('2026-01-15'), 1))).toBe('2026-02-15');
    expect(toISODate(addMonths(parseDate('2026-01-15'), 12))).toBe(
      '2027-01-15',
    );
  });

  it('clamps Jan 31 + 1 month to Feb 28 (non-leap year)', () => {
    // 2026 is NOT a leap year.
    expect(toISODate(addMonths(parseDate('2026-01-31'), 1))).toBe('2026-02-28');
  });

  it('allows Feb 29 in a leap year', () => {
    // 2024 is a leap year.
    expect(toISODate(addMonths(parseDate('2024-01-31'), 1))).toBe('2024-02-29');
  });

  it('handles negative months (subtraction)', () => {
    expect(toISODate(addMonths(parseDate('2026-03-15'), -1))).toBe(
      '2026-02-15',
    );
  });
});

describe('daysBetween', () => {
  it('counts whole days between two dates', () => {
    expect(daysBetween(parseDate('2026-07-16'), parseDate('2026-07-23'))).toBe(
      7,
    );
    expect(daysBetween(parseDate('2026-07-16'), parseDate('2026-07-16'))).toBe(
      0,
    );
  });

  it('is negative if to < from', () => {
    expect(daysBetween(parseDate('2026-07-23'), parseDate('2026-07-16'))).toBe(
      -7,
    );
  });

  it('crosses DST without +/- off-by-one (UTC anchor)', () => {
    // US DST 2026 starts March 8. UTC-anchored math shouldn't drift.
    expect(daysBetween(parseDate('2026-03-01'), parseDate('2026-03-31'))).toBe(
      30,
    );
  });
});

describe('nextRenewalAfter', () => {
  it('returns the stored renewal when already in the future', () => {
    const result = nextRenewalAfter(
      { nextRenewal: '2099-01-01', cycle: 'monthly' },
      parseDate('2026-07-16'),
    );
    expect(result).toBe('2099-01-01');
  });

  it('advances monthly by 1 month when the stored date is past', () => {
    const result = nextRenewalAfter(
      { nextRenewal: '2026-06-01', cycle: 'monthly' },
      parseDate('2026-07-16'),
    );
    // 2026-06-01 -> 2026-07-01 (still past) -> 2026-08-01 (future yes!)
    expect(result).toBe('2026-08-01');
  });

  it('advances quarterly by 3 months', () => {
    const result = nextRenewalAfter(
      { nextRenewal: '2026-04-01', cycle: 'quarterly' },
      parseDate('2026-07-16'),
    );
    // 2026-04-01 -> 2026-07-01 (still past) -> 2026-10-01 (future yes!)
    expect(result).toBe('2026-10-01');
  });

  it('advances yearly by 12 months', () => {
    const result = nextRenewalAfter(
      { nextRenewal: '2026-01-01', cycle: 'yearly' },
      parseDate('2026-07-16'),
    );
    expect(result).toBe('2027-01-01');
  });
});

describe('daysUntilRenewal', () => {
  // Real "today" drifts, so we test the wrapper only loosely — positive when future.
  it('returns a non-negative integer when the next renewal is in the future', () => {
    const days = daysUntilRenewal({
      nextRenewal: '2099-01-01',
      cycle: 'monthly',
    });
    expect(days).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(days)).toBe(true);
  });
});

describe('monthlyEquivalent / yearlyEquivalent', () => {
  it('monthly pass-through', () => {
    expect(monthlyEquivalent({ amount: 12, cycle: 'monthly' })).toBe(12);
  });
  it('quarterly divided by 3', () => {
    expect(monthlyEquivalent({ amount: 30, cycle: 'quarterly' })).toBeCloseTo(
      10,
    );
  });
  it('yearly divided by 12', () => {
    expect(monthlyEquivalent({ amount: 120, cycle: 'yearly' })).toBeCloseTo(10);
  });
  it('yearlyEquivalent is monthly * 12', () => {
    expect(yearlyEquivalent({ amount: 12, cycle: 'monthly' })).toBeCloseTo(144);
    expect(yearlyEquivalent({ amount: 120, cycle: 'yearly' })).toBeCloseTo(120);
  });
});

describe('aggregates', () => {
  const subs = [
    sub({ id: 'a', amount: 12, cycle: 'monthly' }),
    sub({ id: 'b', amount: 36, cycle: 'quarterly' }), // monthly = 12
    sub({ id: 'c', amount: 120, cycle: 'yearly' }), // monthly = 10
    sub({ id: 'arch', amount: 999, cycle: 'monthly', archived: true }),
  ];

  it('totalMonthlySpend excludes archived', () => {
    expect(totalMonthlySpend(subs)).toBeCloseTo(12 + 12 + 10); // 34
  });

  it('totalYearlySpend excludes archived', () => {
    expect(totalYearlySpend(subs)).toBeCloseTo(144 + 144 + 120); // 408
  });

  it('largestMonthly returns the highest monthly equivalent among active', () => {
    const best = largestMonthly(subs);
    expect(best?.id).toBe('a'); // 12 ties with b; first-wins behavior
  });

  it('largestMonthly returns null when only archived subs remain', () => {
    expect(largestMonthly([sub({ id: 'x', archived: true })])).toBeNull();
  });
});

describe('renewalsWithin', () => {
  const today = parseDate('2026-07-16');
  const subs = [
    sub({ id: 'soon', nextRenewal: '2026-07-19' }), // 3 days out
    sub({ id: 'later', nextRenewal: '2026-09-01' }), // way out
    sub({ id: 'past', nextRenewal: '2026-05-01', cycle: 'monthly' }), // advances to 2026-08-01
    sub({ id: 'archived', nextRenewal: '2026-07-17', archived: true }),
  ];

  it('lists subs renewing within the window, sorted by soonest', () => {
    const result = renewalsWithin(subs, 30, today);
    const ids = result.map((s) => s.id);
    expect(ids).toContain('soon');
    expect(ids).toContain('past'); // next renewal is 2026-08-01 (16 days out)
    expect(ids).not.toContain('later');
    expect(ids).not.toContain('archived');
    // soonest should come first
    expect(ids[0]).toBe('soon');
  });
});

describe('groupByCategory', () => {
  it('buckets active subs by category', () => {
    const subs = [
      sub({ id: 'a', category: 'streaming' }),
      sub({ id: 'b', category: 'streaming' }),
      sub({ id: 'c', category: 'music' }),
      sub({ id: 'd', category: 'music', archived: true }),
    ];
    const map = groupByCategory(subs);
    expect(map.get('streaming')?.length).toBe(2);
    expect(map.get('music')?.length).toBe(1);
    expect(map.has('utilities')).toBe(false);
  });
});

describe('renewalsThisMonth', () => {
  const from = parseDate('2026-07-16'); // mid-July

  it('sums actual charge amounts from today through end of month', () => {
    const subs = [
      sub({ id: 'a', amount: 10, nextRenewal: '2026-07-20' }), // in window
      sub({ id: 'b', amount: 20, nextRenewal: '2026-07-31' }), // last day of month
      sub({ id: 'c', amount: 30, nextRenewal: '2026-08-01' }), // next month — out
    ];
    const result = renewalsThisMonth(subs, from);
    expect(result.count).toBe(2);
    expect(result.total).toBe(30);
  });

  it('rolls a renewal dated today into the next cycle (excluded)', () => {
    // Matches app-wide semantics: a same-day renewal counts as already charged
    // and advances to the next cycle (see `nextRenewalAfter`).
    const result = renewalsThisMonth(
      [sub({ id: 'a', amount: 5, nextRenewal: '2026-07-16' })],
      from,
    );
    expect(result.count).toBe(0);
    expect(result.total).toBe(0);
  });

  it('charges yearly subs at their full amount', () => {
    const result = renewalsThisMonth(
      [
        sub({
          id: 'a',
          amount: 120,
          cycle: 'yearly',
          nextRenewal: '2026-07-25',
        }),
      ],
      from,
    );
    expect(result.total).toBe(120);
  });

  it('excludes archived subs and returns zeroes for an empty list', () => {
    const result = renewalsThisMonth(
      [sub({ id: 'a', amount: 10, nextRenewal: '2026-07-20', archived: true })],
      from,
    );
    expect(result).toEqual({ total: 0, count: 0 });
    expect(renewalsThisMonth([], from)).toEqual({ total: 0, count: 0 });
  });
});

describe('categoryBreakdown', () => {
  it('groups by category, converts to monthly equivalents, and sorts desc', () => {
    const subs = [
      sub({
        id: 'a',
        amount: 12,
        category: 'streaming',
        nextRenewal: '2026-07-20',
      }),
      sub({
        id: 'b',
        amount: 120,
        cycle: 'yearly',
        category: 'music',
        nextRenewal: '2026-07-20',
      }), // 10/mo
      sub({
        id: 'c',
        amount: 6,
        category: 'streaming',
        nextRenewal: '2026-07-20',
      }),
      sub({
        id: 'd',
        amount: 999,
        category: 'music',
        archived: true,
        nextRenewal: '2026-07-20',
      }),
    ];
    const items = categoryBreakdown(subs);
    expect(items[0]?.category).toBe('streaming'); // 18 > 10
    expect(items[0]?.monthlyTotal).toBeCloseTo(18);
    expect(items[0]?.count).toBe(2);
    expect(items[1]?.category).toBe('music');
    expect(items[1]?.monthlyTotal).toBeCloseTo(10);
    // share = 18/28 and 10/28
    expect(items[0]?.share).toBeCloseTo(18 / 28);
    expect(items[1]?.share).toBeCloseTo(10 / 28);
  });

  it('returns an empty list when there are no active subs', () => {
    expect(categoryBreakdown([])).toEqual([]);
    expect(categoryBreakdown([sub({ id: 'a', archived: true })])).toEqual([]);
  });
});

describe('budgetProgress', () => {
  it('treats an unset budget as neutral', () => {
    expect(budgetProgress(50, 0)).toEqual({
      pct: 0,
      over: false,
      overAmount: 0,
    });
    expect(budgetProgress(50, -5)).toEqual({
      pct: 0,
      over: false,
      overAmount: 0,
    });
  });

  it('reports progress under budget', () => {
    expect(budgetProgress(25, 100)).toEqual({
      pct: 0.25,
      over: false,
      overAmount: 0,
    });
  });

  it('clamps at 100% when spending exactly the budget', () => {
    expect(budgetProgress(100, 100)).toEqual({
      pct: 1,
      over: false,
      overAmount: 0,
    });
  });

  it('flags over-budget with the excess amount', () => {
    const result = budgetProgress(130, 100);
    expect(result.pct).toBe(1);
    expect(result.over).toBe(true);
    expect(result.overAmount).toBe(30);
  });
});

describe('renewalUrgencyTone', () => {
  it('is critical within 3 days', () => {
    expect(renewalUrgencyTone(0)).toBe('critical');
    expect(renewalUrgencyTone(3)).toBe('critical');
  });

  it('is soon within 7 days', () => {
    expect(renewalUrgencyTone(4)).toBe('soon');
    expect(renewalUrgencyTone(7)).toBe('soon');
  });

  it('is calm beyond a week', () => {
    expect(renewalUrgencyTone(8)).toBe('calm');
    expect(renewalUrgencyTone(45)).toBe('calm');
  });
});

describe('yearlySavingsHint', () => {
  it('estimates a 15% discount for monthly subs', () => {
    const hint = yearlySavingsHint({ amount: 10, cycle: 'monthly' });
    expect(hint).not.toBeNull();
    // 120/yr -> ~102/yr at 15% off -> ~18 saved
    expect(hint?.estimatedYearlyPrice).toBeCloseTo(102);
    expect(hint?.savingsPerYear).toBeCloseTo(18);
  });

  it('returns null for non-monthly cycles', () => {
    expect(yearlySavingsHint({ amount: 120, cycle: 'yearly' })).toBeNull();
    expect(yearlySavingsHint({ amount: 30, cycle: 'quarterly' })).toBeNull();
  });
});

describe('monthlyForecast', () => {
  const from = parseDate('2026-07-16');

  it('buckets actual charges into the months their renewals land', () => {
    const subs = [
      sub({ id: 'a', amount: 10, nextRenewal: '2026-07-20' }), // every month
      sub({ id: 'b', amount: 120, cycle: 'yearly', nextRenewal: '2026-08-01' }), // Aug + next Aug
      sub({ id: 'c', amount: 999, nextRenewal: '2026-07-20', archived: true }),
    ];
    const series = monthlyForecast(subs, 14, from);
    expect(series.length).toBe(14);
    expect(series[0]).toEqual({ month: '2026-07', total: 10, count: 1 });
    expect(series[1]).toEqual({ month: '2026-08', total: 130, count: 2 }); // 10 + 120
    // 12 months later the yearly sub lands again.
    expect(series[13]).toEqual({ month: '2027-08', total: 130, count: 2 });
  });

  it('emits a contiguous series with zeroes for quiet months', () => {
    const series = monthlyForecast(
      [sub({ id: 'a', amount: 5, nextRenewal: '2027-01-01' })],
      3,
      from,
    );
    expect(series.map((m) => m.month)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(series.every((m) => m.total === 0 && m.count === 0)).toBe(true);
  });
});

describe('reminderDateFor', () => {
  it('lands the day before the renewal at 09:00 UTC', () => {
    const d = reminderDateFor('2026-08-01');
    expect(toISODate(d)).toBe('2026-07-31');
    expect(d.getUTCHours()).toBe(9);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it('supports a custom lead time', () => {
    expect(toISODate(reminderDateFor('2026-08-01', 3))).toBe('2026-07-29');
  });
});
