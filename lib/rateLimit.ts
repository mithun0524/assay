/**
 * Reading a 429 correctly.
 *
 * Three different things in this app answer with 429 and they want three
 * different responses from the user:
 *
 *   - the request throttle in proxy.ts   → wait 60s, it will pass
 *   - every free model busy at once      → wait ~15s, it will pass
 *   - OpenRouter's daily allowance gone  → waiting does nothing until 00:00 UTC;
 *                                          switch model or add credits
 *
 * The client used to treat all three as the first: it threw away the body the
 * server had carefully written, printed "wait 60 seconds", and locked the
 * composer for a minute. For the daily case that is advice that cannot work,
 * given in place of the advice that can.
 *
 * Retry-After is the signal for whether waiting is the answer. The server sends
 * it when it is, and omits it when it is not — so no header means show the
 * reason and leave the composer alone.
 */

export type RateLimitVerdict = {
  /** What to show the user. */
  message: string;
  /** How long to disable the composer. 0 = don't. */
  lockMs: number;
};

const FALLBACK_MESSAGE = 'Rate limited. Wait a moment and send again.';

export function interpretRateLimit(
  retryAfterHeader: string | null,
  serverMessage?: string | null
): RateLimitVerdict {
  const message = serverMessage?.trim() || FALLBACK_MESSAGE;

  if (!retryAfterHeader) return { message, lockMs: 0 };

  // Retry-After is seconds here. A malformed or negative value must not lock
  // the composer forever, or a bad header from an upstream proxy bricks the UI.
  const seconds = Number.parseInt(retryAfterHeader, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return { message, lockMs: 0 };

  return { message, lockMs: Math.min(seconds, 300) * 1000 };
}
