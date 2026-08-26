import {
  ONBOARDING_STEPS,
  initialDraft,
  nextStep,
  prevStep,
  shouldShowOnboarding,
} from '@/features/onboarding/onboarding-flow';

describe('ONBOARDING_STEPS', () => {
  it('runs welcome → currency → reminders → pro in order (no budget — it is a Pro feature)', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'welcome',
      'currency',
      'reminders',
      'pro',
    ]);
  });
});

describe('nextStep / prevStep', () => {
  it('walks forward through every step', () => {
    expect(nextStep('welcome')).toBe('currency');
    expect(nextStep('currency')).toBe('reminders');
    expect(nextStep('reminders')).toBe('pro');
  });

  it('pro is the last interactive step', () => {
    expect(nextStep('pro')).toBeNull();
  });

  it('walks backward through every step', () => {
    expect(prevStep('pro')).toBe('reminders');
    expect(prevStep('reminders')).toBe('currency');
    expect(prevStep('currency')).toBe('welcome');
  });

  it('never backs out of the flow from welcome', () => {
    expect(prevStep('welcome')).toBeNull();
  });
});

describe('initialDraft', () => {
  it('seeds defaults for a brand-new account', () => {
    expect(initialDraft('USD')).toEqual({
      currency: 'USD',
      remindersEnabled: true,
    });
  });
});

describe('shouldShowOnboarding', () => {
  const completed: string[] = [];
  const base = {
    isSignedIn: true,
    userId: 'u1',
    completedUserIds: completed,
    subscriptionCount: 0,
  };

  it('shows for a fresh signed-in account with no subscriptions', () => {
    expect(shouldShowOnboarding(base)).toBe(true);
  });

  it('hides when signed out or without a user id', () => {
    expect(shouldShowOnboarding({ ...base, isSignedIn: false })).toBe(false);
    expect(shouldShowOnboarding({ ...base, userId: null })).toBe(false);
  });

  it('hides once this user completed the flow', () => {
    expect(shouldShowOnboarding({ ...base, completedUserIds: ['u1'] })).toBe(
      false,
    );
  });
  it('completions are keyed per user — another account still sees it', () => {
    expect(shouldShowOnboarding({ ...base, userId: 'u2' })).toBe(true);
  });

  it('never interrupts an account that already has subscriptions', () => {
    expect(shouldShowOnboarding({ ...base, subscriptionCount: 3 })).toBe(false);
  });

  it('does not count offline-queued-only rows as content', () => {
    // A queued (unsynced) change leaves local state untouched by design, so
    // the count the gate sees is synced rows only.
    expect(shouldShowOnboarding({ ...base, subscriptionCount: -1 })).toBe(
      false,
    );
  });
});
