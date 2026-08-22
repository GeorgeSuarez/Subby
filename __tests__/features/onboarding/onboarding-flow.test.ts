import {
  ONBOARDING_STEPS,
  canAdvance,
  draftFromPrefs,
  initialDraft,
  nextStep,
  prevStep,
  shouldShowOnboarding,
  validateBudget,
} from '@/features/onboarding/onboarding-flow';

describe('ONBOARDING_STEPS', () => {
  it('runs welcome → currency → budget → reminders in order', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'welcome',
      'currency',
      'budget',
      'reminders',
    ]);
  });
});

describe('nextStep / prevStep', () => {
  it('walks forward through every step', () => {
    expect(nextStep('welcome')).toBe('currency');
    expect(nextStep('currency')).toBe('budget');
    expect(nextStep('budget')).toBe('reminders');
  });

  it('reminders is the last interactive step', () => {
    expect(nextStep('reminders')).toBeNull();
  });

  it('walks backward through every step', () => {
    expect(prevStep('reminders')).toBe('budget');
    expect(prevStep('budget')).toBe('currency');
    expect(prevStep('currency')).toBe('welcome');
  });

  it('never backs out of the flow from welcome', () => {
    expect(prevStep('welcome')).toBeNull();
  });
});

describe('validateBudget', () => {
  it('accepts an empty field as "not set" (0)', () => {
    expect(validateBudget('')).toEqual({ ok: true, value: 0 });
    expect(validateBudget('   ')).toEqual({ ok: true, value: 0 });
  });

  it('parses whole and decimal amounts', () => {
    expect(validateBudget('25')).toEqual({ ok: true, value: 25 });
    expect(validateBudget(' 12.5 ')).toEqual({ ok: true, value: 12.5 });
    expect(validateBudget('0')).toEqual({ ok: true, value: 0 });
  });

  it('rejects non-numeric input', () => {
    expect(validateBudget('abc').ok).toBe(false);
    expect(validateBudget('1,2.3').ok).toBe(false);
    expect(validateBudget('--5').ok).toBe(false);
    expect(validateBudget('Infinity').ok).toBe(false);
  });

  it('rejects negative amounts', () => {
    expect(validateBudget('-3').ok).toBe(false);
  });

  it('rejects non-finite numbers', () => {
    expect(validateBudget('1e400').ok).toBe(false);
  });
});

describe('canAdvance', () => {
  const draft = initialDraft('USD');

  it('welcome and reminders steps never block', () => {
    expect(canAdvance('welcome', draft)).toBe(true);
    expect(canAdvance('reminders', draft)).toBe(true);
  });

  it('currency step always advances (a default is preselected)', () => {
    expect(canAdvance('currency', draft)).toBe(true);
  });

  it('budget step follows validateBudget', () => {
    expect(canAdvance('budget', { ...draft, budget: '' })).toBe(true);
    expect(canAdvance('budget', { ...draft, budget: '40' })).toBe(true);
    expect(canAdvance('budget', { ...draft, budget: '-1' })).toBe(false);
    expect(canAdvance('budget', { ...draft, budget: 'free' })).toBe(false);
  });
});

describe('initialDraft / draftFromPrefs', () => {
  it('seeds defaults for a brand-new account', () => {
    expect(initialDraft('USD')).toEqual({
      currency: 'USD',
      budget: '',
      remindersEnabled: true,
    });
  });

  it('maps stored prefs onto the draft shape', () => {
    expect(
      draftFromPrefs({ currency: 'EUR', budget: 30, remindersEnabled: false }),
    ).toEqual({ currency: 'EUR', budget: '30', remindersEnabled: false });
  });

  it('renders an unset (0) budget as an empty field', () => {
    expect(
      draftFromPrefs({ currency: 'JPY', budget: 0, remindersEnabled: true })
        .budget,
    ).toBe('');
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
