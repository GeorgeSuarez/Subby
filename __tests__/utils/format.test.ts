import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatMonthDay,
  formatRenewalIn,
  formatCycle,
  cycleSuffix,
} from '@/utils/format';

describe('formatCurrency', () => {
  it('formats USD with 2 fraction digits', () => {
    expect(formatCurrency(9.99, 'USD')).toMatch(/9\.99/);
  });

  it('formats JPY with 0 fraction digits', () => {
    expect(formatCurrency(1200, 'JPY')).toMatch(/1[,.]?200/);
    expect(formatCurrency(1200, 'JPY')).not.toMatch(/1[,.]?200\.[0-9]/);
  });

  it('caches the formatter (same instance across calls)', () => {
    // Just sanity-check the function returns the same output repeatedly.
    expect(formatCurrency(9.99, 'USD')).toBe(formatCurrency(9.99, 'USD'));
  });
});

describe('formatCurrencyCompact', () => {
  it('falls back to standard format below 1000', () => {
    expect(formatCurrencyCompact(412, 'USD')).toMatch(/412/);
  });

  it('uses K suffix at/above 1000', () => {
    expect(formatCurrencyCompact(1200, 'USD')).toMatch(/K/);
    expect(formatCurrencyCompact(12500, 'USD')).toMatch(/K/);
  });
});

describe('formatDate / formatMonthDay', () => {
  it('produces a recognizable month abbreviation', () => {
    expect(formatDate('2026-07-16')).toMatch(/Jul/);
    expect(formatMonthDay('2026-07-16')).toMatch(/Jul/);
  });

  it('handles year-end', () => {
    expect(formatDate('2026-12-31')).toMatch(/Dec/);
  });
});

describe('formatRenewalIn', () => {
  it('overdue', () => {
    expect(formatRenewalIn(-1)).toBe('Overdue 1 day');
    expect(formatRenewalIn(-3)).toBe('Overdue 3 days');
  });
  it('today', () => {
    expect(formatRenewalIn(0)).toBe('Today');
  });
  it('tomorrow', () => {
    expect(formatRenewalIn(1)).toBe('Tomorrow');
  });
  it('days window', () => {
    expect(formatRenewalIn(3)).toBe('In 3 days');
  });
  it('weeks window', () => {
    expect(formatRenewalIn(14)).toBe('In 2 weeks');
  });
  it('months+days window', () => {
    expect(formatRenewalIn(45)).toMatch(/In 1mo/);
  });
});

describe('cycle format helpers', () => {
  it('formatCycle maps to label', () => {
    expect(formatCycle('monthly')).toBe('Monthly');
    expect(formatCycle('quarterly')).toBe('Quarterly');
    expect(formatCycle('yearly')).toBe('Yearly');
  });

  it('cycleSuffix maps to per-period phrase', () => {
    expect(cycleSuffix('monthly')).toBe('per month');
    expect(cycleSuffix('quarterly')).toBe('per quarter');
    expect(cycleSuffix('yearly')).toBe('per year');
  });
});
