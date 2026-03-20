/// <reference types="jest" />

jest.mock('../chatCatalog', () => ({
  getRoomDisplayName: jest.fn(() => 'Topic name'),
  getTimelineMessages: jest.fn(() => [
    { id: '$pinned', body: 'Pinned message' },
    { id: '$other', body: 'Other message' },
  ]),
}));

import { buildPinnedMessagesSnapshotFromRoom, getPinnedMessageIds } from '../pinnedMessages';

describe('pinnedMessages', () => {
  it('reads pinned message ids from room state', () => {
    const room = {
      currentState: {
        getStateEvents: jest.fn(() => ({
          getContent: () => ({ pinned: ['$a', '$b'] }),
        })),
      },
    };

    expect(getPinnedMessageIds(room as never)).toEqual(['$a', '$b']);
  });

  it('filters timeline messages down to pinned events', () => {
    const room = {
      currentState: {
        getStateEvents: jest.fn(() => ({
          getContent: () => ({ pinned: ['$pinned'] }),
        })),
      },
    };

    expect(
      buildPinnedMessagesSnapshotFromRoom({} as never, room as never, '@me:example.com')
    ).toEqual({
      roomName: 'Topic name',
      messages: [{ id: '$pinned', body: 'Pinned message' }],
    });
  });
});
