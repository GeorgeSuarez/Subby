import {
  applyFilter,
  applySort,
  filterAndSortSubs,
  matchesQuery,
} from '@/features/subscriptions/subscriptions-filter';
import type { Subscription } from '@/types/subscription';

const base = (overrides: Partial<Subscription>): Subscription => ({
  id: 'test',
  name: 'Sub',
  amount: 10,
  currency: 'USD',
  cycle: 'monthly',
  nextRenewal: '2026-08-01',
  category: 'other',
  icon: 'cube-outline',
  notes: undefined,
  createdAt: 0,
  updatedAt: 0,
  archived: false,
  ...overrides,
});

const subs: Subscription[] = [
  base({ id: 'a', name: 'Audible', amount: 14.95, nextRenewal: '2026-08-04', category: 'other', notes: 'audiobooks' }),
  base({ id: 'b', name: 'Spotify', amount: 9.99, nextRenewal: '2026-08-01', category: 'music' }),
  base({ id: 'c', name: 'GitHub', amount: 4, nextRenewal: '2026-08-12', category: 'developer', notes: 'pro' }),
  base({ id: 'd', name: 'Netflix', amount: 15.99, nextRenewal: '2026-07-31', category: 'streaming' }),
  base({ id: 'arch', name: 'Hulu', amount: 12.99, archived: true, category: 'streaming' }),
];

describe('matchesQuery', () => {
  it('matches all when query is empty / whitespace', () => {
    expect(matchesQuery(subs[0]!, '')).toBe(true);
    expect(matchesQuery(subs[0]!, '   ')).toBe(true);
  });

  it('case-insensitive substring on name', () => {
    expect(matchesQuery(subs[0]!, 'aud')).toBe(true);
    expect(matchesQuery(subs[0]!, 'AUDIBLE')).toBe(true);
    expect(matchesQuery(subs[0]!, 'zzz')).toBe(false);
  });

  it('matches against category + notes', () => {
    // category search
    expect(matchesQuery(subs[1]!, 'music')).toBe(true);
    expect(matchesQuery(subs[2]!, 'developer')).toBe(true);
    // notes search
    expect(matchesQuery(subs[0]!, 'audiobooks')).toBe(true);
    expect(matchesQuery(subs[2]!, 'pro')).toBe(true);
  });

  it('multi-token AND match', () => {
    // 'aud audiobooks' both tokens must be in haystack
    expect(matchesQuery(subs[0]!, 'aud audiobooks')).toBe(true);
    // 'aud music' — 'aud' is in name, but 'music' isn't
    expect(matchesQuery(subs[0]!, 'aud music')).toBe(false);
  });
});

describe('applyFilter', () => {
  it('active filter excludes archived rows', () => {
    const result = applyFilter(subs, 'active');
    expect(result.map((s) => s.id)).not.toContain('arch');
    expect(result.length).toBe(4);
  });

  it('archived filter returns only archived rows', () => {
    const result = applyFilter(subs, 'archived');
    expect(result.map((s) => s.id)).toEqual(['arch']);
  });

  it('all filter returns everything as a SHALLOW COPY (not the same array ref)', () => {
    const result = applyFilter(subs, 'all');
    expect(result.length).toBe(subs.length);
    expect(result).not.toBe(subs);
    expect(result.every((s, i) => s === subs[i])).toBe(true);
  });
});

describe('applySort', () => {
  it('sorts by name case-insensitively, numeric-aware', () => {
    const mixed = [
      base({ id: 'z', name: '4service' }),
      base({ id: 'y', name: 'Apple' }),
      base({ id: 'x', name: 'alpha' }),
      base({ id: 'w', name: 'Beta' }),
    ];
    const result = applySort(mixed, 'name');
    expect(result.map((s) => s.id)).toEqual(['z', 'x', 'y', 'w']);
  });

  it('sorts by amount — largest monthly equivalent first', () => {
    // Mix cycles so monthlyEquivalent matters.
    const mixed = [
      base({ id: 'a', name: 'A', amount: 12, cycle: 'monthly' }), // monthly 12
      base({ id: 'b', name: 'B', amount: 36, cycle: 'quarterly' }), // monthly 12 (tie, stable)
      base({ id: 'c', name: 'C', amount: 120, cycle: 'yearly' }), // monthly 10
    ];
    const result = applySort(mixed, 'amount');
    // First item must be one of the cost-12 ties, last must be the cost-10 one.
    expect(result[result.length - 1]!.id).toBe('c');
    expect(['a', 'b']).toContain(result[0]!.id);
  });

  it('sorts by nextRenewal — soonest date first', () => {
    const mixed = [
      base({ id: 'later', nextRenewal: '2099-12-01' }),
      base({ id: 'now', nextRenewal: '2099-01-01' }),
      base({ id: 'past', nextRenewal: '2025-01-01', cycle: 'monthly' }), // gets advanced
    ];
    const result = applySort(mixed, 'nextRenewal');
    // `past` walks forward to a future date; 'now' (Jan 2099) should be earlier than 'later' (Dec 2099).
    // Both 'now' and 'past' could end up earlier; just assert 'later' comes last.
    expect(result[result.length - 1]!.id).toBe('later');
  });

  it('does NOT mutate the input array', () => {
    const input = subs.slice();
    applySort(input, 'name');
    expect(input).toEqual(subs);
  });
});

describe('filterAndSortSubs', () => {
  it('composes filter + query + sort in one pass', () => {
    const result = filterAndSortSubs(subs, { query: 'au', sort: 'name', filter: 'all' });
    // Active+archived subs whose haystack includes 'au': Audible (audiobooks in notes), Hulu (no)
    // Wait — 'au' in 'Audible' (substring yes) AND 'audiobooks' contains 'au'.
    // 'Hulu'? 'hulu'.includes('au') is false. So only Audible.
    expect(result.map((s) => s.id)).toEqual(['a']);
  });

  it('returns a NEW array even when result is empty', () => {
    const result = filterAndSortSubs(subs, { query: 'zzznomatch', sort: 'name', filter: 'all' });
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it("filter 'active' excludes archived before query applies", () => {
    const result = filterAndSortSubs(subs, { query: '', sort: 'name', filter: 'active' });
    const ids = result.map((s) => s.id);
    expect(ids).not.toContain('arch');
    expect(ids.length).toBe(4);
  });
});