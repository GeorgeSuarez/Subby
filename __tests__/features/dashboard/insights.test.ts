import {
  biggestInsight,
  categoryInsight,
  currencyInsight,
  peakMonthInsight,
  pickInsight,
  savingsInsight,
  trialInsight,
} from '@/features/dashboard/insights';
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

describe('trialInsight', () => {
  it('fires for a trial ending within 3 days', () => {
    const insight = trialInsight([
      base({ id: 'a', name: 'Netflix', trialEnds: inDays(2) }),
    ]);
    expect(insight).not.toBeNull();
    expect(insight?.kind).toBe('trial');
    expect(insight?.text).toContain('Netflix');
    expect(insight?.text).toContain('ends in 2 days');
  });

  it('ignores distant and ended trials', () => {
    expect(trialInsight([base({ id: 'a', trialEnds: inDays(9) })])).toBeNull();
    expect(trialInsight([base({ id: 'a', trialEnds: inDays(-1) })])).toBeNull();
    expect(trialInsight([base({ id: 'a' })])).toBeNull();
  });
});

describe('savingsInsight', () => {
  it('suggests yearly billing when the discount is material', () => {
    const insight = savingsInsight(
      [base({ id: 'a', name: 'Spotify', amount: 10, cycle: 'monthly' })],
      USD,
    );
    expect(insight?.kind).toBe('savings');
    expect(insight?.text).toContain('Billed yearly');
    expect(insight?.text).toContain('/yr');
  });

  it('is silent when the savings are below 5% of annual spend', () => {
    // $2/mo monthly sub ($24/yr) vs a $480/yr yearly sub — savings ~$3.60/yr < 5%.
    const insight = savingsInsight(
      [
        base({ id: 'a', amount: 2, cycle: 'monthly' }),
        base({ id: 'b', amount: 480, cycle: 'yearly' }),
      ],
      USD,
    );
    expect(insight).toBeNull();
  });

  it('is silent with no monthly subscriptions', () => {
    expect(
      savingsInsight([base({ id: 'a', amount: 120, cycle: 'yearly' })], USD),
    ).toBeNull();
  });
});

describe('biggestInsight', () => {
  it('names the biggest subscription with 2+ active', () => {
    const insight = biggestInsight(
      [
        base({ id: 'a', name: 'Disney+', amount: 15.99, cycle: 'monthly' }),
        base({ id: 'b', name: 'Spotify', amount: 10, cycle: 'monthly' }),
      ],
      USD,
    );
    expect(insight?.kind).toBe('biggest');
    expect(insight?.text).toContain('Disney+');
    expect(insight?.text).toContain('/mo');
  });

  it('stays silent for a single subscription', () => {
    expect(
      biggestInsight([base({ id: 'a', amount: 10, cycle: 'monthly' })], USD),
    ).toBeNull();
  });
});

describe('categoryInsight', () => {
  it('fires when one category dominates half the spend across 2+ subs', () => {
    const insight = categoryInsight([
      base({ id: 'a', amount: 10, category: 'streaming' }),
      base({ id: 'b', amount: 10, category: 'streaming' }),
      base({ id: 'c', amount: 2, category: 'music' }),
    ]);
    expect(insight?.kind).toBe('category');
    expect(insight?.text).toMatch(/Streaming/);
    expect(insight?.text).toContain('%');
  });

  it('is silent when no category reaches 50%', () => {
    expect(
      categoryInsight([
        base({ id: 'a', amount: 5, category: 'streaming' }),
        base({ id: 'b', amount: 5, category: 'music' }),
        base({ id: 'c', amount: 3, category: 'other' }),
      ]),
    ).toBeNull();
  });
});

describe('peakMonthInsight', () => {
  it('flags a spike month above the steady monthly spend', () => {
    const insight = peakMonthInsight(
      [
        base({ id: 'a', amount: 10, cycle: 'monthly' }),
        base({
          id: 'b',
          name: 'iCloud+',
          amount: 120,
          cycle: 'yearly',
          nextRenewal: inDays(20),
        }),
      ],
      USD,
    );
    expect(insight?.kind).toBe('peak');
    expect(insight?.text).toContain('biggest month');
    expect(insight?.text).toContain('in renewals');
  });

  it('is silent without a spike', () => {
    expect(
      peakMonthInsight([base({ id: 'a', amount: 10, cycle: 'monthly' })], USD),
    ).toBeNull();
  });
});

describe('currencyInsight', () => {
  it('fires when multiple currencies are in use', () => {
    const insight = currencyInsight([
      base({ id: 'a', currency: 'USD' }),
      base({ id: 'b', currency: 'EUR' }),
    ]);
    expect(insight?.kind).toBe('currency');
    expect(insight?.text).toContain('2 currencies');
  });

  it('is silent with a single currency (or no subs)', () => {
    expect(currencyInsight([base({ id: 'a', currency: 'USD' })])).toBeNull();
    expect(currencyInsight([])).toBeNull();
  });
});

describe('pickInsight', () => {
  it('returns the first applicable rule in priority order', () => {
    // Trial (rule 1) outranks savings (rule 2).
    const insight = pickInsight(
      [
        base({ id: 'a', name: 'Netflix', trialEnds: inDays(2) }),
        base({ id: 'b', amount: 10, cycle: 'monthly' }),
      ],
      USD,
    );
    expect(insight?.kind).toBe('trial');
  });

  it('returns null when nothing applies', () => {
    expect(
      pickInsight([base({ id: 'a', amount: 120, cycle: 'yearly' })], USD),
    ).toBeNull();
  });
});
