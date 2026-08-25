import {
  canUseFeature,
  isProFeature,
  LIFETIME_PRODUCT_ID,
  PRO_FEATURES,
  PRO_PRODUCT_IDS,
  SUBSCRIPTION_PRODUCT_IDS,
  canAddSubscription,
  FREE_SUB_LIMIT,
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
  it('lists exactly the gated features', () => {
    // Closed registry, pruned to real gates. Re-add a key when the feature
    // ships; unknown keys stay free via isProFeature.
    expect(PRO_FEATURES).toEqual(['pieChart', 'budget', 'advancedReminders']);
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

describe('subscription limit', () => {
  it('caps free accounts at five active subscriptions', () => {
    expect(FREE_SUB_LIMIT).toBe(5);
    expect(canAddSubscription(4, false)).toBe(true);
    expect(canAddSubscription(5, false)).toBe(false);
    expect(canAddSubscription(6, false)).toBe(false);
  });

  it('lets Pro accounts track beyond the free limit', () => {
    expect(canAddSubscription(FREE_SUB_LIMIT, true)).toBe(true);
    expect(canAddSubscription(100, true)).toBe(true);
  });
});
