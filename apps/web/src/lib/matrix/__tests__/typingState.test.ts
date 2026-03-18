/// <reference types="jest" />

import {
  getTypingRateLimitResetAt,
  isTypingRateLimited,
  sendTypingState,
} from '../typingState';

describe('typingState helpers', () => {
  it('extracts a rate-limit reset time from Matrix 429 errors', () => {
    const resetAt = getTypingRateLimitResetAt(
      {
        errcode: 'M_LIMIT_EXCEEDED',
        data: {
          retry_after_ms: 2500,
        },
      },
      10_000
    );

    expect(resetAt).toBe(12_500);
  });

  it('tracks typing backoff after a 429 response', async () => {
    const sendTyping = jest.fn(async () => {
      throw {
        errcode: 'M_LIMIT_EXCEEDED',
        data: {
          retry_after_ms: 5000,
        },
      };
    });
    const typingRateLimitUntilRef = { current: 0 };
    const onError = jest.fn();

    await expect(
      sendTypingState({
        client: { sendTyping } as never,
        roomId: '!room:example.com',
        isTyping: true,
        timeoutMs: 30_000,
        typingRateLimitUntilRef,
        onError,
      })
    ).resolves.toBe(false);

    expect(onError).not.toHaveBeenCalled();
    expect(typingRateLimitUntilRef.current).toBeGreaterThan(Date.now());
    expect(isTypingRateLimited(typingRateLimitUntilRef)).toBe(true);
  });

  it('does not retry typing requests while rate-limited', async () => {
    const sendTyping = jest.fn(async () => undefined);
    const typingRateLimitUntilRef = { current: Date.now() + 60_000 };
    const onError = jest.fn();

    await expect(
      sendTypingState({
        client: { sendTyping } as never,
        roomId: '!room:example.com',
        isTyping: false,
        timeoutMs: 30_000,
        typingRateLimitUntilRef,
        onError,
      })
    ).resolves.toBe(false);

    expect(sendTyping).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
