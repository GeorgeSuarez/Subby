import {
  CATEGORIES,
  CATEGORY_BY_SLUG,
  categoryMeta,
  cycleMeta,
  currencyMeta,
  DEFAULT_CURRENCY,
  DEFAULT_CATEGORY,
  TEST_ACCOUNT_EMAIL,
  isTestAccountEmail,
} from '@/utils/constants';

describe('CATEGORIES', () => {
  it('has the expected slugs', () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(slugs).toContain('streaming');
    expect(slugs).toContain('music');
    expect(slugs).toContain('developer');
    expect(slugs).toContain('fitness');
    expect(slugs).toContain('lifestyle');
    expect(slugs).toContain('other');
  });

  it('every slug has a label + icon', () => {
    for (const c of CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });
});

describe('categoryMeta', () => {
  it('returns the requested meta', () => {
    expect(categoryMeta('streaming').label).toBe('Streaming');
  });

  it('falls back to DEFAULT_CATEGORY for an unknown slug', () => {
    // @ts-expect-error — testing forward-compat with an unknown slug
    const meta = categoryMeta('space-travel');
    expect(meta).toBe(DEFAULT_CATEGORY);
  });
});

describe('CYCLES', () => {
  it('maps cycle to months', () => {
    expect(cycleMeta('monthly').months).toBe(1);
    expect(cycleMeta('quarterly').months).toBe(3);
    expect(cycleMeta('yearly').months).toBe(12);
  });
});

describe('CURRENCIES', () => {
  it('USD has 2 fraction digits', () => {
    expect(currencyMeta('USD').fractionDigits).toBe(2);
  });
  it('JPY has 0 fraction digits', () => {
    expect(currencyMeta('JPY').fractionDigits).toBe(0);
  });
});

describe('defaults', () => {
  it('DEFAULT_CURRENCY is USD', () => {
    expect(DEFAULT_CURRENCY).toBe('USD');
  });

  it('CATEGORY_BY_SLUG is keyed by each category', () => {
    const slugs = Object.keys(CATEGORY_BY_SLUG);
    for (const c of CATEGORIES) {
      expect(slugs).toContain(c.slug);
    }
  });
});

describe('test account rule', () => {
  it('accepts the exact test account email', () => {
    expect(isTestAccountEmail(TEST_ACCOUNT_EMAIL)).toBe(true);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(isTestAccountEmail('  Test@Subby.App  ')).toBe(true);
  });

  it('rejects every other account', () => {
    expect(isTestAccountEmail('ada@lovelace.dev')).toBe(false);
    expect(isTestAccountEmail('')).toBe(false);
    expect(isTestAccountEmail(null)).toBe(false);
    expect(isTestAccountEmail(undefined)).toBe(false);
  });
});
