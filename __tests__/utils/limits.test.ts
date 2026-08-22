import {
  canUseFeature,
  isProFeature,
  LIFETIME_PRODUCT_ID,
  PRO_FEATURES,
  PRO_PRODUCT_IDS,
  proFeatureLabel,
  SUBSCRIPTION_PRODUCT_IDS,
} from '@/utils/limits';

describe('PRO_PRODUCT_IDS', () => {
  it('contains the three expected SKUs', () => {
    expect(PRO_PRODUCT_IDS).toEqual([
      'subby_pro_monthly',
      'subby_pro_yearly',
      'subby_pro_lifetime',
    ]);
  });

  it('lifetime is the third id', () => {
    expect(LIFETIME_PRODUCT_ID).toBe('subby_pro_lifetime');
    expect(SUBSCRIPTION_PRODUCT_IDS).toEqual([
      'subby_pro_monthly',
      'subby_pro_yearly',
    ]);
  });
});

describe('PRO_FEATURES', () => {
  it('includes the gated feature keys', () => {
    expect(PRO_FEATURES).toContain('pieChart');
    expect(PRO_FEATURES).toContain('budget');
    expect(PRO_FEATURES).toContain('forecast');
    expect(PRO_FEATURES).toContain('export');
    expect(PRO_FEATURES).toContain('advancedReminders');
    expect(PRO_FEATURES).toContain('trialsNudge');
  });

  it('proFeatureLabel returns a non-empty label for each', () => {
    for (const f of PRO_FEATURES) {
      expect(proFeatureLabel(f).length).toBeGreaterThan(0);
    }
  });
});

describe('isProFeature', () => {
  it('returns true for every PRO_FEATURES entry', () => {
    for (const f of PRO_FEATURES) {
      expect(isProFeature(f)).toBe(true);
    }
  });

  it('returns false for unknown keys (future features stay free by default)', () => {
    expect(isProFeature('unknown')).toBe(false);
    expect(isProFeature('search')).toBe(false);
    expect(isProFeature('')).toBe(false);
  });
});

describe('canUseFeature', () => {
  it('free users cannot use Pro features', () => {
    for (const f of PRO_FEATURES) {
      expect(canUseFeature(f, false)).toBe(false);
    }
  });

  it('Pro users can use every feature', () => {
    for (const f of PRO_FEATURES) {
      expect(canUseFeature(f, true)).toBe(true);
    }
    expect(canUseFeature('search', true)).toBe(true);
  });

  it('free users can use non-Pro features', () => {
    expect(canUseFeature('search', false)).toBe(true);
    expect(canUseFeature('archive', false)).toBe(true);
  });
});

describe('regression: unlimited subs', () => {
  it('adding any number of subs is allowed for both tiers (no FREE_SUB_LIMIT)', () => {
    // The old cap was 5. Now subs are always unlimited — verify the module
    // does not export a FREE_SUB_LIMIT constant.
    const mod = require('@/utils/limits') as Record<string, unknown>;
    expect(mod.FREE_SUB_LIMIT).toBeUndefined();
    expect(mod.canAddSubscription).toBeUndefined();
  });
});
