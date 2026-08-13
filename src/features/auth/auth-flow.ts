/**
 * Reset/change password flow — the gatekeeping state machine.
 *
 * Answers "which form may this user see, and where do they go next" for the
 * reset-password and verify-password screens. Purely derived: inputs are
 * session facts (from `useAuthStore`) plus the URL params the screens parse.
 * No React, no router — the interface is the test surface.
 *
 * The `urlChecked` input exists because the recovery deep link is processed
 * asynchronously (Linking.getInitialURL) — a signed-in user opening a
 * recovery link must NOT be sent to the current-password step just because
 * that processing hasn't set `recoveryPending` yet.
 */

export type ResetFlowMode = 'entry' | 'recovery' | 'change' | 'verify';

export interface ResetFlowInput {
  /** A recovery session is active (code/link verified, or deep link opened). */
  recoveryPending: boolean;
  isSignedIn: boolean;
  /** True once the cold-start deep link has been processed (or skipped). */
  urlChecked: boolean;
  from: string | undefined;
  verified: string | undefined;
}

/** True when the URL carries the verify-password handoff into change mode. */
export function isChangeFlow(from: string | undefined, verified: string | undefined): boolean {
  return from === 'settings' && verified === '1';
}

/** The handoff link the verify-password screen navigates to after success. */
export const CHANGE_FLOW_LINK = '/reset-password?from=settings&verified=1' as const;

/** Resolve which mode the reset screen is in. */
export function resolveResetFlow(input: ResetFlowInput): ResetFlowMode {
  if (isChangeFlow(input.from, input.verified)) return 'change';
  if (input.recoveryPending) return 'recovery';
  if (input.urlChecked && input.isSignedIn) return 'verify';
  return 'entry';
}

/** The password form is shown in recovery and change modes. */
export function canSeePasswordForm(mode: ResetFlowMode): boolean {
  return mode === 'recovery' || mode === 'change';
}
