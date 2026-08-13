/**
 * Classify data-layer errors: a session that died server-side (user deleted,
 * tokens revoked, FK violation from a stale user id) must sign the user out
 * with a clear message instead of surfacing a raw database error.
 */

/** Message surfaced on the sign-in screen when the session died server-side. */
export const SESSION_EXPIRED_MESSAGE =
  'Your session expired — please sign in again.';

export function isSessionExpiredError(e: Error): boolean {
  return (
    /auth session missing|invalid jwt|jwt.*expired|refresh token.*invalid/i.test(
      e.message,
    ) || /violates foreign key constraint/i.test(e.message)
  );
}
