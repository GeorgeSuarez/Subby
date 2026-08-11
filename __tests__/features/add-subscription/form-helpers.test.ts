import {
  defaultDraft,
  draftFromSubscription,
  errorsByField,
  parseISO,
  validateDraft,
} from '@/features/add-subscription/form-helpers';
import type { Subscription, SubscriptionDraft } from '@/types/subscription';

describe('parseISO', () => {
  it('parses valid YYYY-MM-DD', () => {
    expect(parseISO('2026-07-16')).toBeInstanceOf(Date);
    expect(parseISO('2099-12-31')).toBeInstanceOf(Date);
  });

  it('rejects malformed inputs', () => {
    expect(parseISO('')).toBeNull();
    expect(parseISO(undefined)).toBeNull();
    expect(parseISO('not-a-date')).toBeNull();
    expect(parseISO('2026/07/16')).toBeNull();
    expect(parseISO('2026-7-16')).toBeNull(); // requires 2-digit
    expect(parseISO('2026-13-01')).toBeNull(); // out-of-range month
    expect(parseISO('2026-02-30')).toBeNull(); // Feb 30 normalize-detected
  });

  it('accepts leap-day 2024-02-29', () => {
    expect(parseISO('2024-02-29')).toBeInstanceOf(Date);
  });

  it('trims surrounding whitespace', () => {
    expect(parseISO('  2026-07-16  ')).toBeInstanceOf(Date);
  });
});

describe('defaultDraft', () => {
  it('seeds sensible defaults when adding', () => {
    const d = defaultDraft('USD');
    expect(d.currency).toBe('USD');
    expect(d.cycle).toBe('monthly');
    expect(d.category).toBe('other');
    expect(d.icon).toBe('cube-outline'); // matches the 'other' category default
    expect(d.amount).toBe(''); // raw input starts empty
    expect(d.name).toBe('');
    // nextRenewal should be ~1 month from today and parse cleanly.
    expect(parseISO(d.nextRenewal)).toBeInstanceOf(Date);
  });

  it('honors the requested currency', () => {
    expect(defaultDraft('JPY').currency).toBe('JPY');
    expect(defaultDraft('EUR').currency).toBe('EUR');
  });
});

describe('draftFromSubscription', () => {
  it('copies editable fields only and returns a fresh object', () => {
    const sub: Subscription = {
      id: 'abc', name: 'Spotify', amount: 9.99, currency: 'USD', cycle: 'monthly',
      nextRenewal: '2026-08-01', category: 'music', icon: 'musical-notes-outline',
      color: '#1DB954', notes: 'Family plan', createdAt: 100, updatedAt: 200, archived: false,
    };
    const draft = draftFromSubscription(sub);
    // Match shape of SubscriptionDraft (no id/timestamps/archived).
    expect(draft).not.toHaveProperty('id');
    expect(draft).not.toHaveProperty('createdAt');
    expect(draft).not.toHaveProperty('updatedAt');
    expect(draft).not.toHaveProperty('archived');
    // Sensible copies.
    expect(draft.name).toBe('Spotify');
    expect(draft.amount).toBe('9.99'); // raw string, decimal preserved
    expect(draft.nextRenewal).toBe('2026-08-01');
  });

  it('does not share references with the original', () => {
    const sub: Subscription = {
      id: 'abc', name: 'X', amount: 1, currency: 'USD', cycle: 'monthly',
      nextRenewal: '2026-08-01', category: 'other', icon: 'cube-outline',
      createdAt: 0, updatedAt: 0, archived: false,
    };
    const draft = draftFromSubscription(sub);
    expect(draft).not.toBe(sub as unknown as SubscriptionDraft);
  });
});

describe('validateDraft', () => {
  const valid: SubscriptionDraft = {
    name: 'Netflix', amount: '9.99', currency: 'USD', cycle: 'monthly',
    nextRenewal: '2026-08-01', category: 'streaming', icon: 'film-outline',
  };

  it('returns no errors for a valid draft', () => {
    expect(validateDraft(valid)).toEqual([]);
  });

  it('rejects empty / whitespace-only name', () => {
    expect(
      validateDraft({ ...valid, name: '   ' }),
    ).toContainEqual({ field: 'name', message: 'Name is required' });
  });

  it('rejects names over 64 chars', () => {
    expect(
      validateDraft({ ...valid, name: 'x'.repeat(65) }),
    ).toContainEqual(expect.objectContaining({ field: 'name' }));
  });

  it('rejects zero, negative, non-finite amount', () => {
    expect(validateDraft({ ...valid, amount: '0' })[0]?.field).toBe('amount');
    expect(validateDraft({ ...valid, amount: '-5' })[0]?.field).toBe('amount');
    expect(validateDraft({ ...valid, amount: 'abc' })[0]?.field).toBe('amount');
  });

  it('accepts decimal strings and a trailing decimal point', () => {
    expect(validateDraft({ ...valid, amount: '9.99' })).toEqual([]);
    expect(validateDraft({ ...valid, amount: '9.' })).toEqual([]);
    expect(validateDraft({ ...valid, amount: '12' })).toEqual([]);
  });

  it('rejects absurdly large amounts', () => {
    expect(
      validateDraft({ ...valid, amount: '2000000' })[0]?.field,
    ).toBe('amount');
  });

  it('rejects unknown currency', () => {
    expect(
      validateDraft({ ...valid, currency: 'BAD' as SubscriptionDraft['currency'] })[0]?.field,
    ).toBe('currency');
  });

  it('rejects unknown cycle', () => {
    expect(
      validateDraft({ ...valid, cycle: 'fortnightly' as SubscriptionDraft['cycle'] })[0]?.field,
    ).toBe('cycle');
  });

  it('rejects invalid nextRenewal', () => {
    expect(validateDraft({ ...valid, nextRenewal: 'tomorrow' })[0]?.field).toBe('nextRenewal');
    expect(validateDraft({ ...valid, nextRenewal: '2026-13-01' })[0]?.field).toBe('nextRenewal');
  });

  it('rejects unknown category', () => {
    expect(
      validateDraft({ ...valid, category: 'space-travel' as SubscriptionDraft['category'] })[0]?.field,
    ).toBe('category');
  });

  it('rejects invalid color formats only when color is provided', () => {
    expect(validateDraft({ ...valid, color: '#abc' })[0]?.field).toBe(undefined);
    expect(validateDraft({ ...valid, color: 'banana' })[0]?.field).toBe('color');
  });

  it('caps notes at 280 characters', () => {
    const long = 'x'.repeat(281);
    expect(validateDraft({ ...valid, notes: long })[0]?.field).toBe('notes');
  });

  it('accepts a valid future trial end', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(validateDraft({ ...valid, trialEnds: tomorrow })).toEqual([]);
  });

  it('rejects a malformed or past trial end', () => {
    expect(validateDraft({ ...valid, trialEnds: 'not-a-date' })[0]?.field).toBe('trialEnds');
    expect(validateDraft({ ...valid, trialEnds: '2020-01-01' })[0]?.field).toBe('trialEnds');
  });

  it('allows an unset trial end', () => {
    expect(validateDraft(valid)).toEqual([]);
  });
});

describe('errorsByField', () => {
  it('collects first error per field into a map', () => {
    const map = errorsByField([
      { field: 'name', message: 'Name is required' },
      { field: 'amount', message: 'Too big' },
      { field: 'name', message: 'second instance ignored' },
    ]);
    expect(map.name).toBe('Name is required');
    expect(map.amount).toBe('Too big');
    expect(map.color).toBeUndefined();
  });

  it('returns an empty object for empty input', () => {
    expect(errorsByField([])).toEqual({});
  });
});