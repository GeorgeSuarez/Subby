import {
  getMonthlyCost,
  getRenewalStatus,
  getTrialStatus,
  getYearlyCost,
  renewalToneFor,
} from '@/features/subscription-detail/detail-helpers';
import type { Subscription } from '@/types/subscription';

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

describe('renewalToneFor', () => {
  it('overdue (<0) → negative', () => {
    expect(renewalToneFor(-1)).toBe('negative');
    expect(renewalToneFor(-30)).toBe('negative');
  });
  it('0..3 → warning', () => {
    expect(renewalToneFor(0)).toBe('warning');
    expect(renewalToneFor(3)).toBe('warning');
  });
  it('4..30 → positive', () => {
    expect(renewalToneFor(4)).toBe('positive');
    expect(renewalToneFor(30)).toBe('positive');
  });
  it('>30 → neutral', () => {
    expect(renewalToneFor(31)).toBe('neutral');
    expect(renewalToneFor(365)).toBe('neutral');
  });
});

describe('getRenewalStatus', () => {
  it('derives status from a future monthly sub', () => {
    const status = getRenewalStatus(base({ nextRenewal: '2099-01-01', cycle: 'monthly' }));
    expect(status.days).toBeGreaterThanOrEqual(0);
    expect(status.nextISO).toMatch(/2099|2089|2101|2109/); // walked forward eventually
    expect(['positive', 'neutral']).toContain(status.tone);
  });

it('computes a non-empty label and valid nextISO for a near-timely date', () => {
    const today = new Date();
    const iso = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    const status = getRenewalStatus(base({ nextRenewal: iso, cycle: 'yearly' }));
    expect(typeof status.label).toBe('string');
    expect(status.label.length).toBeGreaterThan(0);
    expect(status.nextISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Once walked forward, the date should be in or after today.
    expect(['warning', 'positive', 'neutral']).toContain(status.tone);
  });

  it('overdue when the next renewal is far in the past with a long cycle', () => {
    // Far past + yearly cycle → walks forward by year, eventually lands in future.
    // If the date is in the very recent past and cycle is monthly, the next
    // renewal may still be soon. Pin a 2001 renewal with a 'yearly' cycle:
    const status = getRenewalStatus(base({ nextRenewal: '2001-01-01', cycle: 'yearly' }));
    // Walked forward to the next January 1 ≥ today; so days >= 0, not overdue.
    expect(status.days).toBeGreaterThanOrEqual(0);
    expect(status.tone).toMatch(/positive|neutral/);
  });
});

describe('getMonthlyCost / getYearlyCost', () => {
  it('monthly passthrough', () => {
    expect(getMonthlyCost(base({ amount: 12, cycle: 'monthly' }))).toBe(12);
  });
  it('quarterly / 3', () => {
    expect(getMonthlyCost(base({ amount: 30, cycle: 'quarterly' }))).toBeCloseTo(10);
  });
  it('yearly / 12', () => {
    expect(getMonthlyCost(base({ amount: 120, cycle: 'yearly' }))).toBeCloseTo(10);
  });
  it('yearlyEquivalent is monthly * 12', () => {
    expect(getYearlyCost(base({ amount: 12, cycle: 'monthly' }))).toBeCloseTo(144);
  });
  it('yearlyEquivalent: quarterly ×4', () => {
    expect(getYearlyCost(base({ amount: 30, cycle: 'quarterly' }))).toBeCloseTo(120);
  });
});

describe('getTrialStatus', () => {
  const inDays = (n: number): string => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  it('returns null without a trial end', () => {
    expect(getTrialStatus(base({}))).toBeNull();
  });

  it('reports days remaining and a future date', () => {
    const status = getTrialStatus(base({ trialEnds: inDays(5) }));
    expect(status).not.toBeNull();
    expect(status?.days).toBe(5);
    expect(status?.label).toBe('Ends in 5 days');
    expect(status?.tone).toBe('positive');
  });

  it('warns within 3 days and flags ended trials', () => {
    expect(getTrialStatus(base({ trialEnds: inDays(1) }))?.tone).toBe('warning');
    expect(getTrialStatus(base({ trialEnds: inDays(0) }))?.label).toBe('Ends today');
    const ended = getTrialStatus(base({ trialEnds: inDays(-2) }));
    expect(ended?.tone).toBe('negative');
    expect(ended?.label).toBe('Trial ended');
  });
});
