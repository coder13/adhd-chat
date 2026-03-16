/// <reference types="jest" />

import {
  getEmojiQuery,
  getEmojiSuggestions,
  insertEmojiQueryResult,
  replaceCompletedEmojiShortcodes,
} from '../../../lib/chat/emojis';

describe('composer emoji helpers', () => {
  it('detects trailing emoji queries after a colon', () => {
    expect(getEmojiQuery(':hea')).toBe('hea');
    expect(getEmojiQuery('hi :hea')).toBe('hea');
    expect(getEmojiQuery('hi:hea')).toBe(null);
  });

  it('returns useful suggestions for shortcode searches', () => {
    const suggestions = getEmojiSuggestions('heart');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((entry) => entry.shortcode === 'heart')).toBe(true);
  });

  it('replaces the active query when selecting a suggestion', () => {
    expect(insertEmojiQueryResult('hi :heart', '❤️')).toBe('hi ❤️ ');
    expect(insertEmojiQueryResult('hi', '❤️')).toBe('hi ❤️ ');
  });

  it('converts completed emoji shortcodes inline', () => {
    expect(replaceCompletedEmojiShortcodes('I :heart: you')).toBe('I ❤️ you');
    expect(replaceCompletedEmojiShortcodes(':rocket: launch')).toBe('🚀 launch');
  });
});
