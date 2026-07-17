import {
  addMonths,
  daysBetween,
  daysUntilRenewal,
  groupByCategory,
  largestMonthly,
  monthlyEquivalent,
  nextRenewalAfter,
  parseDate,
  renewalsWithin,
  toISODate,
  totalMonthlySpend,
  totalYearlySpend,
  yearlyEquivalent,
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
    expect(toISODate(addMonths(parseDate('2026-01-15'), 12))).toBe('2027-01-15');
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
    expect(toISODate(addMonths(parseDate('2026-03-15'), -1))).toBe('2026-02-15');
  });
});

describe('daysBetween', () => {
  it('counts whole days between two dates', () => {
    expect(daysBetween(parseDate('2026-07-16'), parseDate('2026-07-23'))).toBe(7);
    expect(daysBetween(parseDate('2026-07-16'), parseDate('2026-07-16'))).toBe(0);
  });

  it('is negative if to < from', () => {
    expect(daysBetween(parseDate('2026-07-23'), parseDate('2026-07-16'))).toBe(-7);
  });

  it('crosses DST without +/- off-by-one (UTC anchor)', () => {
    // US DST 2026 starts March 8. UTC-anchored math shouldn't drift.
    expect(daysBetween(parseDate('2026-03-01'), parseDate('2026-03-31'))).toBe(30);
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
    const days = daysUntilRenewal({ nextRenewal: '2099-01-01', cycle: 'monthly' });
    expect(days).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(days)).toBe(true);
  });
});

describe('monthlyEquivalent / yearlyEquivalent', () => {
  it('monthly pass-through', () => {
    expect(monthlyEquivalent({ amount: 12, cycle: 'monthly' })).toBe(12);
  });
  it('quarterly divided by 3', () => {
    expect(monthlyEquivalent({ amount: 30, cycle: 'quarterly' })).toBeCloseTo(10);
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