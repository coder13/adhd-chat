/// <reference types="jest" />

import {
  formatTypingIndicator,
  getTypingMemberNames,
} from '../typingIndicators';

describe('typing indicator helpers', () => {
  it('returns sorted joined members who are typing except the current user', () => {
    expect(
      getTypingMemberNames(
        [
          {
            userId: '@me:example.com',
            name: 'Me',
            typing: true,
            membership: 'join',
          },
          {
            userId: '@zoe:example.com',
            name: 'Zoe',
            typing: true,
            membership: 'join',
          },
          {
            userId: '@alex:example.com',
            name: 'Alex',
            typing: true,
            membership: 'join',
          },
          {
            userId: '@sam:example.com',
            name: 'Sam',
            typing: true,
            membership: 'leave',
          },
        ],
        '@me:example.com'
      )
    ).toEqual(['Alex', 'Zoe']);
  });

  it('formats one or two typing names cleanly', () => {
    expect(formatTypingIndicator(['Alex'])).toBe('Alex is typing...');
    expect(formatTypingIndicator(['Alex', 'Zoe'])).toBe(
      'Alex and Zoe are typing...'
    );
  });

  it('collapses longer typing lists into a compact summary', () => {
    expect(formatTypingIndicator(['Alex', 'Zoe', 'Sam', 'Kai'])).toBe(
      'Alex, Zoe, and 2 others are typing...'
    );
  });
});
