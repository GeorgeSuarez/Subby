import { defaultDraft, validateDraft } from '@/features/auth/auth-helpers';
import { TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD } from '@/utils/constants';

describe('validateDraft', () => {
  it('accepts a valid sign-in draft', () => {
    expect(validateDraft({ email: 'ada@lovelace.dev', password: 'any', }, 'signIn')).toEqual({});
  });

  it('accepts the test account with its fixed password', () => {
    expect(
      validateDraft({ email: TEST_ACCOUNT_EMAIL, password: TEST_ACCOUNT_PASSWORD }, 'signIn'),
    ).toEqual({});
  });

  it('rejects the test account with a wrong password', () => {
    const errors = validateDraft({ email: TEST_ACCOUNT_EMAIL, password: 'wrong' }, 'signIn');
    expect(errors.password).toBe('Incorrect password for the test account.');
  });

  it('applies the fixed password rule on sign-up too', () => {
    const errors = validateDraft({ email: TEST_ACCOUNT_EMAIL, password: 'wrong' }, 'signUp');
    expect(errors.password).toBe('Incorrect password for the test account.');

    expect(
      validateDraft({ email: TEST_ACCOUNT_EMAIL, password: TEST_ACCOUNT_PASSWORD }, 'signUp'),
    ).toEqual({});
  });

  it('is case-insensitive for the test email check', () => {
    expect(
      validateDraft({ email: 'Test@Subby.App', password: TEST_ACCOUNT_PASSWORD }, 'signIn'),
    ).toEqual({});
  });

  it('accepts a valid sign-up draft', () => {
    expect(validateDraft({ email: 'ada@lovelace.dev', password: 'sup3r-secret', }, 'signUp')).toEqual({});
  });

  it('trims surrounding whitespace before checking the email', () => {
    expect(validateDraft({ email: '  ada@lovelace.dev  ', password: 'any' }, 'signIn')).toEqual({});
  });

  it('requires an email', () => {
    const errors = validateDraft({ email: '', password: 'any' }, 'signIn');
    expect(errors.email).toBe('Enter your email address.');
  });

  it('rejects a malformed email', () => {
    const errors = validateDraft({ email: 'not-an-email', password: 'any' }, 'signIn');
    expect(errors.email).toBe('Enter a valid email address.');
  });

  it('requires a password', () => {
    const errors = validateDraft({ email: 'ada@lovelace.dev', password: '' }, 'signIn');
    expect(errors.password).toBe('Enter your password.');
  });

  it('allows short passwords on sign-in', () => {
    expect(validateDraft({ email: 'ada@lovelace.dev', password: 'x' }, 'signIn').password).toBeUndefined();
  });

  it('enforces an 8-character minimum on sign-up', () => {
    const errors = validateDraft({ email: 'ada@lovelace.dev', password: 'short' }, 'signUp');
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
