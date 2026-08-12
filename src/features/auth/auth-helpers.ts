/**
 * Auth form helpers — pure, fully testable logic for the auth screens.
 *
 * Skill rules:
 *  - `state-ground-truth`: validation errors are DERIVED from the draft each
 *    render, never cached in state.
 *  - Copy per the frontend-design writing guide: plain verbs, specific errors
 *    that say what's wrong, no filler.
 */

export type AuthMode = 'signIn' | 'signUp';

export interface AuthDraft {
  email: string;
  password: string;
}

export type AuthFieldKey = keyof AuthDraft;

export type AuthErrors = Partial<Record<AuthFieldKey, string>>;

/** Per-mode copy. Action labels reuse the same verb as the headline. */
export interface AuthCopy {
  headline: string;
  subline: string;
  cta: string;
  switchPrompt: string;
  switchAction: string;
}

export const copyByMode: Record<AuthMode, AuthCopy> = {
  signIn: {
    headline: 'Sign in',
    subline: 'Track every subscription, all in one place.',
    cta: 'Sign in',
    switchPrompt: 'No account yet?',
    switchAction: 'Sign up',
  },
  signUp: {
    headline: 'Create your account',
    subline: 'Keep an eye on every renewal.',
    cta: 'Create account',
    switchPrompt: 'Already have an account?',
    switchAction: 'Sign in',
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function defaultDraft(): AuthDraft {
  return { email: '', password: '' };
}

/**
 * Validate a draft for the given mode. Returns the FIRST error per field.
 * Credentials are owned by Supabase; local validation only enforces format
 * (sign-up enforces a password minimum, sign-in requires it non-empty).
 */
export function validateDraft(draft: AuthDraft, mode: AuthMode): AuthErrors {
  const errors: AuthErrors = {};

  const email = draft.email.trim();
  if (!email) {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!draft.password) {
    errors.password = 'Enter your password.';
  } else if (mode === 'signUp' && draft.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  }

  return errors;
}
