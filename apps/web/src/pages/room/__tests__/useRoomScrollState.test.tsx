/// <reference types="jest" />

import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { useRoomScrollState } from '../useRoomScrollState';

function createScrollHost() {
  const element = document.createElement('div');
  const mutableElement = element as HTMLElement & {
    scrollHeight: number;
    clientHeight: number;
  };
  let scrollTop = 0;
  let scrollHeight = 0;
  let clientHeight = 0;

  Object.defineProperties(element, {
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    },
    scrollHeight: {
      configurable: true,
      get: () => scrollHeight,
      set: (value: number) => {
        scrollHeight = value;
      },
    },
    clientHeight: {
      configurable: true,
      get: () => clientHeight,
      set: (value: number) => {
        clientHeight = value;
      },
    },
  });

  return {
    element,
    setMetrics(next: {
      scrollTop?: number;
      scrollHeight?: number;
      clientHeight?: number;
    }) {
      if (typeof next.scrollTop === 'number') {
        element.scrollTop = next.scrollTop;
      }
      if (typeof next.scrollHeight === 'number') {
        mutableElement.scrollHeight = next.scrollHeight;
      }
      if (typeof next.clientHeight === 'number') {
        mutableElement.clientHeight = next.clientHeight;
      }
    },
  };
}

describe('useRoomScrollState', () => {
  it('loads older messages near the top', async () => {
    const scrollHost = createScrollHost();
    scrollHost.setMetrics({
      scrollTop: 320,
      scrollHeight: 1000,
      clientHeight: 300,
    });

    const contentRef = {
      current: null,
    } as RefObject<HTMLIonContentElement | null>;
    const scrollElementRef = {
      current: scrollHost.element,
    } as RefObject<HTMLElement | null>;
    const scrollToLatest = jest.fn();
    const loadOlderMessages = jest.fn(async () => undefined);

    const { result } = renderHook(() =>
      useRoomScrollState({
        roomId: '!room:example.com',
        contentRef,
        scrollElementRef,
        messageKeys: ['m1', 'm2'],
        scrollToLatest,
        canLoadOlderMessages: true,
        onLoadOlderMessages: loadOlderMessages,
      })
    );

    expect(scrollToLatest).toHaveBeenCalledWith(0);

    scrollHost.setMetrics({
      scrollTop: 40,
    });

    await act(async () => {
      scrollHost.element.dispatchEvent(new Event('scroll'));
      await Promise.resolve();
    });

    expect(loadOlderMessages).toHaveBeenCalledTimes(1);
    expect(result.current.showJumpToLatest).toBe(false);
  });
});
