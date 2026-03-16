/// <reference types="jest" />

import {
  prefersDesktopComposerShortcuts,
  shouldSubmitComposerOnEnter,
} from '../composerBehavior';

describe('composer behavior', () => {
  it('submits enter on fine-pointer environments', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as never;

    expect(prefersDesktopComposerShortcuts()).toBe(true);
    expect(
      shouldSubmitComposerOnEnter({
        key: 'Enter',
        shiftKey: false,
        isComposing: false,
      })
    ).toBe(true);
  });

  it('keeps enter as newline on touch-style environments', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as never;

    expect(prefersDesktopComposerShortcuts()).toBe(false);
    expect(
      shouldSubmitComposerOnEnter({
        key: 'Enter',
        shiftKey: false,
        isComposing: false,
      })
    ).toBe(false);
  });

  it('never submits while shift-enter or IME composition is active', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as never;

    expect(
      shouldSubmitComposerOnEnter({
        key: 'Enter',
        shiftKey: true,
        isComposing: false,
      })
    ).toBe(false);
    expect(
      shouldSubmitComposerOnEnter({
        key: 'Enter',
        shiftKey: false,
        isComposing: true,
      })
    ).toBe(false);
  });
});
