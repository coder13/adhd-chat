/// <reference types="jest" />

import {
  buildTimelineDaySections,
  formatTimelineDayLabel,
} from '../timelineDaySections';

function localTimestamp(
  year: number,
  monthIndex: number,
  day: number,
  hour = 12,
  minute = 0
) {
  return new Date(year, monthIndex, day, hour, minute).getTime();
}

describe('timelineDaySections', () => {
  it('formats recent labels as Today and Yesterday', () => {
    const now = localTimestamp(2026, 2, 17, 18);
    const today = localTimestamp(2026, 2, 17, 10);
    const yesterday = localTimestamp(2026, 2, 16, 9);

    expect(
      formatTimelineDayLabel(new Date(today).setHours(0, 0, 0, 0), now)
    ).toBe('Today');
    expect(
      formatTimelineDayLabel(
        new Date(yesterday).setHours(0, 0, 0, 0),
        now
      )
    ).toBe('Yesterday');
  });

  it('uses a calendar date for older messages and groups messages by day', () => {
    const now = localTimestamp(2026, 2, 17, 18);
    const olderDay = localTimestamp(2026, 2, 12, 8);
    const expectedOlderLabel = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(olderDay);

    const sections = buildTimelineDaySections(
      [
        {
          id: 'older-1',
          senderId: '@alex:example.com',
          senderName: 'Alex',
          body: 'Older day',
          timestamp: olderDay,
          isOwn: false,
          msgtype: 'm.text',
        },
        {
          id: 'older-2',
          senderId: '@alex:example.com',
          senderName: 'Alex',
          body: 'Still older day',
          timestamp: localTimestamp(2026, 2, 12, 17),
          isOwn: false,
          msgtype: 'm.text',
        },
        {
          id: 'today',
          senderId: '@me:example.com',
          senderName: 'Me',
          body: 'Today',
          timestamp: localTimestamp(2026, 2, 17, 9),
          isOwn: true,
          msgtype: 'm.text',
        },
      ],
      now
    );

    expect(sections).toEqual([
      expect.objectContaining({
        label: expectedOlderLabel,
        messages: [
          expect.objectContaining({ id: 'older-1' }),
          expect.objectContaining({ id: 'older-2' }),
        ],
      }),
      expect.objectContaining({
        label: 'Today',
        messages: [expect.objectContaining({ id: 'today' })],
      }),
    ]);
  });
});
