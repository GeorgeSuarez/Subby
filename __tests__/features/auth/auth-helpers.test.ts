import {
  accountLabelFor,
  defaultDraft,
  needsDeferredVerification,
  validateDraft,
} from '@/features/auth/auth-helpers';

describe('validateDraft', () => {
  it('accepts a valid sign-in draft', () => {
    expect(
      validateDraft({ email: 'ada@lovelace.dev', password: 'any' }, 'signIn'),
    ).toEqual({});
  });

  it('accepts a valid sign-up draft', () => {
    expect(
      validateDraft(
        { email: 'ada@lovelace.dev', password: 'sup3r-secret' },
        'signUp',
      ),
    ).toEqual({});
  });

  it('trims surrounding whitespace before checking the email', () => {
    expect(
      validateDraft(
        { email: '  ada@lovelace.dev  ', password: 'any' },
        'signIn',
      ),
    ).toEqual({});
  });

  it('requires an email', () => {
    const errors = validateDraft({ email: '', password: 'any' }, 'signIn');
    expect(errors.email).toBe('Enter your email address.');
  });

  it('rejects a malformed email', () => {
    const errors = validateDraft(
      { email: 'not-an-email', password: 'any' },
      'signIn',
    );
    expect(errors.email).toBe('Enter a valid email address.');
  });

  it('requires a password', () => {
    const errors = validateDraft(
      { email: 'ada@lovelace.dev', password: '' },
      'signIn',
    );
    expect(errors.password).toBe('Enter your password.');
  });

  it('allows short passwords on sign-in', () => {
    expect(
      validateDraft({ email: 'ada@lovelace.dev', password: 'x' }, 'signIn')
        .password,
    ).toBeUndefined();
  });

  it('enforces an 8-character minimum on sign-up', () => {
    const errors = validateDraft(
      { email: 'ada@lovelace.dev', password: 'short' },
      'signUp',
    );
    expect(errors.password).toBe('Use at least 8 characters.');
  });

  it('reports at most one error per field', () => {
    const errors = validateDraft({ email: 'bad', password: '' }, 'signIn');
    expect(Object.keys(errors)).toEqual(['email', 'password']);
  });
});

describe('defaultDraft', () => {
  it('starts both fields empty', () => {
    expect(defaultDraft()).toEqual({ email: '', password: '' });
  });
});

describe('needsDeferredVerification', () => {
  const verified = {
    isSignedIn: true,
    isAnonymous: false,
    pendingVerificationEmail: null,
  };

  it('fires for an anonymous session with a pending email', () => {
    expect(
      needsDeferredVerification({
        ...verified,
        isAnonymous: true,
        pendingVerificationEmail: 'ada@lovelace.dev',
      }),
    ).toBe(true);
  });

  it('never fires when signed out, real, or without a pending email', () => {
    expect(needsDeferredVerification({ ...verified, isSignedIn: false })).toBe(
      false,
    );
    expect(needsDeferredVerification(verified)).toBe(false);
    expect(
      needsDeferredVerification({
        ...verified,
        pendingVerificationEmail: 'ada@lovelace.dev',
      }),
    ).toBe(false);
  });
});

describe('accountLabelFor', () => {
  it('marks the pending email as unverified for bridge accounts', () => {
    expect(
      accountLabelFor({
        isSignedIn: true,
        isAnonymous: true,
        pendingVerificationEmail: 'ada@lovelace.dev',
      }),
    ).toBe('ada@lovelace.dev (unverified)');
  });

  it('falls back to the unknown-user label otherwise', () => {
    expect(
      accountLabelFor({
        isSignedIn: true,
        isAnonymous: false,
        pendingVerificationEmail: null,
      }),
    ).toBe('Unknown user');
  });
});
