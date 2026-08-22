/**
 * Getting Started flow — the first-run wizard's state machine.
 *
 * Answers "which step may this user see, and can they move on" for the
 * onboarding screen. Purely derived: inputs are session facts (from
 * `useAuthStore`), store prefs, and the raw form draft. No React, no router,
 * no RN — the interface is the test surface.
 *
 * The wizard is a linear sequence of steps ending in a synthetic `done`
 * marker; `nextStep` returns null past the end so the screen can commit and
 * route to the tabs. Budget is optional: an empty field commits as 0
 * ("not set"), matching how `user_prefs.budget` treats it.
 *
 * The show-gate (`shouldShowOnboarding`) is deliberately conservative: it
 * only fires for a signed-in account with zero synced subscriptions whose
 * user id hasn't completed the flow before — upgrading users with data are
 * never interrupted.
 */

import type { CurrencyCode } from '@/types/subscription';

export type OnboardingStep = 'welcome' | 'currency' | 'budget' | 'reminders';

/** Ordered interactive steps; `done` is reached via nextStep(reminders) === null. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'welcome',
  'currency',
  'budget',
  'reminders',
] as const;

/** The wizard draft — mirrors what each step edits, in raw form-field shape. */
export interface OnboardingDraft {
  currency: CurrencyCode;
  /** Raw text input; '' means "not set" (commits as budget 0). */
  budget: string;
  remindersEnabled: boolean;
}

/** Step forward; null when the current step is the last one. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(step);
  if (i === -1 || i === ONBOARDING_STEPS.length - 1) return null;
  // SAFETY: i is a valid index strictly below length-1, so i+1 is in bounds.
  return ONBOARDING_STEPS[i + 1] ?? null;
}

/** Step back; null from the first step (nothing before welcome). */
export function prevStep(step: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(step);
  if (i <= 0) return null;
  // SAFETY: i > 0 here, so i-1 is a valid index.
  return ONBOARDING_STEPS[i - 1] ?? null;
}

/**
 * Validate the raw budget field. Empty/whitespace means "not set" → 0.
 * Anything else must parse to a finite, non-negative number.
 */
export function validateBudget(
  raw: string,
): { ok: true; value: number } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: 0 };
  const value = Number(trimmed);
  // Number('') is 0 and Number('Infinity') is Infinity — both handled by
  // the empty-string check above and the isFinite guard here.
  if (!Number.isFinite(value) || value < 0) return { ok: false };
  return { ok: true, value };
}

/**
 * Can the user leave this step? Only the budget step can block (invalid
 * input); every other step has a valid default or is a pure toggle.
 */
export function canAdvance(
  _step: OnboardingStep,
  draft: OnboardingDraft,
): boolean {
  return validateBudget(draft.budget).ok;
}

/** Defaults for a brand-new account. */
export function initialDraft(currency: CurrencyCode): OnboardingDraft {
  return { currency, budget: '', remindersEnabled: true };
}

/** Inputs for the show-gate, all cheaply available at render time. */
export interface ShowGateInput {
  isSignedIn: boolean;
  /** Supabase user id — completions are keyed per account. */
  userId: string | null;
  completedUserIds: readonly string[];
  /** Count of synced subscriptions visible to this account. */
  subscriptionCount: number;
}

/**
 * True only for a signed-in, never-onboarded account with zero subscriptions.
 * Existing accounts with data are untouched by app updates; a queued-only
 * (offline) change leaves local state empty, matching the sync coordinator's
 * queue-invisible design.
 */
export function shouldShowOnboarding(input: ShowGateInput): boolean {
  if (!input.isSignedIn) return false;
  if (input.userId === null) return false;
  if (input.completedUserIds.includes(input.userId)) return false;
  // Exactly zero — any other value counts as content so a miscomputed or
  // negative count can never trigger an unwanted interruption.
  return input.subscriptionCount === 0;
}
