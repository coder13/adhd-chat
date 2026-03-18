/// <reference types="jest" />

import { restorePrependScrollPosition } from '../scrollAnchor';

describe('restorePrependScrollPosition', () => {
  it('keeps the same viewport after older items are prepended', () => {
    const element = document.createElement('div') as HTMLElement & {
      scrollHeight: number;
      scrollTop: number;
    };
    let scrollHeight = 1400;
    let scrollTop = 40;

    Object.defineProperties(element, {
      scrollHeight: {
        configurable: true,
        get: () => scrollHeight,
        set: (value: number) => {
          scrollHeight = value;
        },
      },
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = value;
        },
      },
    });

    expect(
      restorePrependScrollPosition(element, {
        scrollHeight: 1000,
        scrollTop: 40,
      })
    ).toBe(440);
    expect(element.scrollTop).toBe(440);
  });
});
