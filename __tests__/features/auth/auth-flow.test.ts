import {
  CHANGE_FLOW_LINK,
  canSeePasswordForm,
  isChangeFlow,
  resolveResetFlow,
  type ResetFlowMode,
  type ResetFlowInput,
} from '@/features/auth/auth-flow';

const base: ResetFlowInput = {
  recoveryPending: false,
  isSignedIn: false,
  urlChecked: true,
  from: undefined,
  verified: undefined,
};

const flow = (overrides: Partial<ResetFlowInput>): ResetFlowMode =>
  resolveResetFlow({ ...base, ...overrides });

describe('resolveResetFlow', () => {
  it('entry: signed out with no recovery session', () => {
    expect(flow({ isSignedIn: false, recoveryPending: false })).toBe('entry');
  });

  it('entry: signed in but the deep link has not been processed yet', () => {
    // The race guard: a recovery link may still be in flight — never bounce
    // a signed-in user to the verify step before urlChecked settles.
    expect(flow({ isSignedIn: true, urlChecked: false })).toBe('entry');
  });

  it('verify: signed in, deep link settled, no recovery session', () => {
    expect(flow({ isSignedIn: true, urlChecked: true })).toBe('verify');
  });

  it('recovery: recovery session active (signed in or out)', () => {
    expect(flow({ recoveryPending: true, isSignedIn: false })).toBe('recovery');
    expect(flow({ recoveryPending: true, isSignedIn: true, urlChecked: true })).toBe('recovery');
  });

  it('change: the verify-password handoff wins even with a stale recovery flag', () => {
    expect(
      flow({ from: 'settings', verified: '1', recoveryPending: true, isSignedIn: true }),
    ).toBe('change');
  });

  it('change: handoff params without recovery', () => {
    expect(flow({ from: 'settings', verified: '1' })).toBe('change');
  });
});

describe('isChangeFlow', () => {
  it('requires both the from and verified params', () => {
    expect(isChangeFlow('settings', '1')).toBe(true);
    expect(isChangeFlow('settings', undefined)).toBe(false);
    expect(isChangeFlow(undefined, '1')).toBe(false);
    expect(isChangeFlow('settings', '0')).toBe(false);
    expect(isChangeFlow('other', '1')).toBe(false);
  });
});

describe('canSeePasswordForm', () => {
  it('shows the form only in recovery and change modes', () => {
    expect(canSeePasswordForm('recovery')).toBe(true);
    expect(canSeePasswordForm('change')).toBe(true);
    expect(canSeePasswordForm('entry')).toBe(false);
    expect(canSeePasswordForm('verify')).toBe(false);
  });
});

describe('CHANGE_FLOW_LINK', () => {
  it('is the handoff the verify screen navigates to', () => {
    expect(CHANGE_FLOW_LINK).toBe('/reset-password?from=settings&verified=1');
  });
});
