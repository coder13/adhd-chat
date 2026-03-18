import type { MatrixClient } from 'matrix-js-sdk';

const DEFAULT_TYPING_RETRY_DELAY_MS = 60_000;

export type TypingRateLimitRef = {
  current: number;
};

function getRetryAfterMs(cause: unknown) {
  if (!cause || typeof cause !== 'object') {
    return null;
  }

  const error = cause as {
    data?: { retry_after_ms?: unknown };
    retry_after_ms?: unknown;
  };

  if (typeof error.data?.retry_after_ms === 'number') {
    return error.data.retry_after_ms;
  }

  if (typeof error.retry_after_ms === 'number') {
    return error.retry_after_ms;
  }

  return null;
}

export function getTypingRateLimitResetAt(cause: unknown, now = Date.now()) {
  if (!cause || typeof cause !== 'object') {
    return null;
  }

  const error = cause as {
    errcode?: unknown;
    httpStatus?: unknown;
  };

  if (error.errcode !== 'M_LIMIT_EXCEEDED' && error.httpStatus !== 429) {
    return null;
  }

  const retryAfterMs = getRetryAfterMs(cause) ?? DEFAULT_TYPING_RETRY_DELAY_MS;
  return now + Math.max(1_000, retryAfterMs);
}

export function isTypingRateLimited(
  typingRateLimitUntilRef: TypingRateLimitRef,
  now = Date.now()
) {
  return typingRateLimitUntilRef.current > now;
}

export async function sendTypingState({
  client,
  roomId,
  isTyping,
  timeoutMs,
  typingRateLimitUntilRef,
  onError,
}: {
  client: MatrixClient;
  roomId: string;
  isTyping: boolean;
  timeoutMs: number;
  typingRateLimitUntilRef: TypingRateLimitRef;
  onError: (cause: unknown) => void;
}) {
  if (isTypingRateLimited(typingRateLimitUntilRef)) {
    return false;
  }

  try {
    await client.sendTyping(roomId, isTyping, timeoutMs);
    if (typingRateLimitUntilRef.current !== 0) {
      typingRateLimitUntilRef.current = 0;
    }
    return true;
  } catch (cause) {
    const rateLimitResetAt = getTypingRateLimitResetAt(cause);
    if (rateLimitResetAt !== null) {
      typingRateLimitUntilRef.current = rateLimitResetAt;
      return false;
    }

    onError(cause);
    return false;
  }
}
