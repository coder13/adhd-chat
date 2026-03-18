/// <reference types="jest" />

import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { useThreadComposerFocus } from '../useThreadComposerFocus';

const threadMessage = {
  id: '$thread-root',
  senderId: '@alex:matrix.org',
  senderName: 'Alex',
  body: 'Thread root',
  timestamp: Date.UTC(2026, 2, 17, 16, 0),
  isOwn: false,
  msgtype: 'm.text' as const,
};

describe('useThreadComposerFocus', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  beforeEach(() => {
    window.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    window.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('waits for thread context before focusing the composer', () => {
    const setFocus = jest.fn();
    const composerRef = {
      current: {
        setFocus,
      },
    } as unknown as RefObject<HTMLIonTextareaElement | null>;
    const { result, rerender } = renderHook(
      ({
        threadContextMessage,
      }: {
        threadContextMessage: typeof threadMessage | null;
      }) =>
        useThreadComposerFocus({
          composerRef,
          threadContextMessage,
          canInteractWithTimeline: true,
        }),
      {
        initialProps: {
          threadContextMessage: null as typeof threadMessage | null,
        },
      }
    );

    act(() => {
      result.current();
    });
    expect(setFocus).not.toHaveBeenCalled();

    rerender({ threadContextMessage: threadMessage });
    expect(setFocus).toHaveBeenCalledTimes(1);
  });

  it('focuses again for later thread-open requests while the thread is active', () => {
    const setFocus = jest.fn();
    const composerRef = {
      current: {
        setFocus,
      },
    } as unknown as RefObject<HTMLIonTextareaElement | null>;
    const { result } = renderHook(() =>
      useThreadComposerFocus({
        composerRef,
        threadContextMessage: threadMessage,
        canInteractWithTimeline: true,
      })
    );

    act(() => {
      result.current();
    });
    act(() => {
      result.current();
    });

    expect(setFocus).toHaveBeenCalledTimes(2);
  });
});
