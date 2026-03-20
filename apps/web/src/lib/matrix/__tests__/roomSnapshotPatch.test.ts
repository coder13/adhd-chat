/// <reference types="jest" />

jest.mock('../chatCatalog', () => ({
  getRoomDisplayName: jest.fn(() => 'Conversation'),
  getTimelineMessages: jest.fn(() => []),
}));

jest.mock('../identity', () => ({
  getRoomIcon: jest.fn(() => null),
  getRoomTopic: jest.fn(() => null),
}));

jest.mock('../roomSnapshot', () => ({
  getRoomSubtitle: jest.fn(() => '2 members'),
}));

jest.mock('../threadCatalog', () => ({
  buildRoomThreadSnapshot: jest.fn(() => null),
  getRoomThreadSnapshots: jest.fn(() => []),
}));

jest.mock('../tandem', () => ({
  getTandemRoomMeta: jest.fn(() => ({})),
}));

jest.mock('../timelineEvents', () => ({
  getTimelineEventContent: jest.fn(() => ({})),
  isRenderableTimelineMessage: jest.fn(() => true),
}));

jest.mock('../timelineRelations', () => ({
  buildReactionIndex: jest.fn(() => new Map()),
}));

jest.mock('../timelineMessageResolver', () => ({
  resolveTimelineMessagesFromEvents: jest.fn(() => []),
}));

import type { RoomSnapshot } from '../roomSnapshot';
import { buildReactionIndex } from '../timelineRelations';
import { resolveTimelineMessagesFromEvents } from '../timelineMessageResolver';
import {
  patchRoomSnapshotReadReceipts,
  patchRoomSnapshotWithTimelineEvent,
} from '../roomSnapshotPatch';

function createSnapshot(): RoomSnapshot {
  const threadRoot = {
    id: '$thread-root',
    senderId: '@sam:example.com',
    senderName: 'Sam',
    body: 'Thread root',
    timestamp: 2,
    isOwn: false,
    msgtype: 'm.text',
    threadRootId: null,
    isThreadRoot: true,
    readByNames: [] as string[],
  };
  const threadReply = {
    id: '$thread-reply',
    senderId: '@sam:example.com',
    senderName: 'Sam',
    body: 'Thread reply',
    timestamp: 6,
    isOwn: false,
    msgtype: 'm.text',
    threadRootId: '$thread-root',
    isThreadRoot: false,
    readByNames: [] as string[],
  };
  const lateThreadReply = {
    id: '$thread-late-reply',
    senderId: '@sam:example.com',
    senderName: 'Sam',
    body: 'Late thread reply',
    timestamp: 16,
    isOwn: false,
    msgtype: 'm.text',
    threadRootId: '$thread-root',
    isThreadRoot: false,
    readByNames: [] as string[],
  };

  return {
    roomName: 'Conversation',
    roomDescription: null,
    roomIcon: null,
    roomAvatarUrl: null,
    roomSubtitle: '2 members',
    messages: [
      {
        id: '$main-1',
        senderId: '@sam:example.com',
        senderName: 'Sam',
        body: 'First',
        timestamp: 1,
        isOwn: false,
        msgtype: 'm.text',
        threadRootId: null,
        isThreadRoot: false,
        readByNames: [],
      },
      {
        id: '$main-2',
        senderId: '@sam:example.com',
        senderName: 'Sam',
        body: 'Second',
        timestamp: 5,
        isOwn: false,
        msgtype: 'm.text',
        threadRootId: null,
        isThreadRoot: false,
        readByNames: [],
      },
      {
        id: '$main-3',
        senderId: '@sam:example.com',
        senderName: 'Sam',
        body: 'Third',
        timestamp: 15,
        isOwn: false,
        msgtype: 'm.text',
        threadRootId: null,
        isThreadRoot: false,
        readByNames: [],
      },
    ],
    threads: [
      {
        rootMessageId: '$thread-root',
        rootMessage: threadRoot,
        replies: [threadReply, lateThreadReply],
        replyCount: 2,
        latestReply: lateThreadReply,
        hasCurrentUserParticipated: false,
      },
    ],
    isEncrypted: false,
    roomMeta: {},
  };
}

describe('patchRoomSnapshotReadReceipts', () => {
  it('incrementally patches main timeline receipts from the receipt event payload', () => {
    const snapshot = createSnapshot();
    const room = {
      findEventById: jest.fn((eventId: string) =>
        eventId === '$main-2'
          ? {
              getTs: () => 5,
            }
          : null
      ),
      getMember: jest.fn((userId: string) =>
        userId === '@alex:example.com'
          ? {
              membership: 'join',
              name: 'Alex',
              rawDisplayName: 'Alex',
            }
          : null
      ),
      getUsersReadUpTo: jest.fn(() => []),
    };

    const nextSnapshot = patchRoomSnapshotReadReceipts(
      snapshot,
      room as never,
      '@me:example.com',
      {
        content: {
          '$main-2': {
            'm.read': {
              '@alex:example.com': {
                thread_id: 'main',
              },
            },
          },
        },
      }
    );

    expect(nextSnapshot.messages[0].readByNames).toEqual(['Alex']);
    expect(nextSnapshot.messages[1].readByNames).toEqual(['Alex']);
    expect(nextSnapshot.messages[2].readByNames).toEqual([]);
    expect(nextSnapshot.threads[0].replies[0].readByNames).toEqual([]);
    expect(room.getUsersReadUpTo).not.toHaveBeenCalled();
  });

  it('incrementally patches threaded receipts only within the affected thread', () => {
    const snapshot = createSnapshot();
    const room = {
      findEventById: jest.fn((eventId: string) =>
        eventId === '$thread-reply'
          ? {
              getTs: () => 6,
            }
          : null
      ),
      getMember: jest.fn((userId: string) =>
        userId === '@alex:example.com'
          ? {
              membership: 'join',
              name: 'Alex',
              rawDisplayName: 'Alex',
            }
          : null
      ),
      getUsersReadUpTo: jest.fn(() => []),
    };

    const nextSnapshot = patchRoomSnapshotReadReceipts(
      snapshot,
      room as never,
      '@me:example.com',
      {
        content: {
          '$thread-reply': {
            'm.read': {
              '@alex:example.com': {
                thread_id: '$thread-root',
              },
            },
          },
        },
      }
    );

    expect(nextSnapshot.messages[0].readByNames).toEqual([]);
    expect(nextSnapshot.threads[0].rootMessage?.readByNames).toEqual(['Alex']);
    expect(nextSnapshot.threads[0].replies[0].readByNames).toEqual(['Alex']);
    expect(nextSnapshot.threads[0].replies[1].readByNames).toEqual([]);
    expect(nextSnapshot.threads[0].latestReply?.readByNames).toEqual([]);
    expect(room.getUsersReadUpTo).not.toHaveBeenCalled();
  });

  it('falls back to the full receipt recompute when the receipt payload cannot be narrowed', () => {
    const snapshot = createSnapshot();
    const eventMap = new Map([
      ['$main-1', { id: '$main-1' }],
      ['$main-2', { id: '$main-2' }],
      ['$main-3', { id: '$main-3' }],
      ['$thread-root', { id: '$thread-root' }],
      ['$thread-reply', { id: '$thread-reply' }],
      ['$thread-late-reply', { id: '$thread-late-reply' }],
    ]);
    const room = {
      findEventById: jest.fn((eventId: string) => eventMap.get(eventId) ?? null),
      getMember: jest.fn((userId: string) =>
        userId === '@alex:example.com'
          ? {
              membership: 'join',
              name: 'Alex',
              rawDisplayName: 'Alex',
            }
          : null
      ),
      getUsersReadUpTo: jest.fn((event: { id: string }) =>
        event.id === '$main-3' || event.id === '$thread-late-reply'
          ? ['@alex:example.com']
          : []
      ),
    };

    const nextSnapshot = patchRoomSnapshotReadReceipts(
      snapshot,
      room as never,
      '@me:example.com',
      {
        content: {},
      }
    );

    expect(nextSnapshot.messages[2].readByNames).toEqual(['Alex']);
    expect(nextSnapshot.threads[0].latestReply?.readByNames).toEqual(['Alex']);
    expect(room.getUsersReadUpTo).toHaveBeenCalled();
  });
});

describe('patchRoomSnapshotWithTimelineEvent', () => {
  it('incrementally patches edited messages without rebuilding the whole timeline', () => {
    const snapshot = createSnapshot();
    const targetEvent = {
      getId: () => '$main-2',
      replyEventId: null,
    };
    const room = {
      findEventById: jest.fn((eventId: string) =>
        eventId === '$main-2' ? targetEvent : null
      ),
      getMember: jest.fn((userId: string) =>
        userId === '@alex:example.com'
          ? {
              membership: 'join',
              name: 'Alex',
              rawDisplayName: 'Alex',
            }
          : null
      ),
      getUsersReadUpTo: jest.fn(() => ['@alex:example.com']),
    };
    (
      resolveTimelineMessagesFromEvents as jest.MockedFunction<
        typeof resolveTimelineMessagesFromEvents
      >
    ).mockReset();
    (
      resolveTimelineMessagesFromEvents as jest.MockedFunction<
        typeof resolveTimelineMessagesFromEvents
      >
    ).mockReturnValueOnce([
      {
        ...snapshot.messages[1],
        body: 'Edited',
        isEdited: true,
      },
    ]);

    const nextSnapshot = patchRoomSnapshotWithTimelineEvent(
      snapshot,
      {} as never,
      room as never,
      '@me:example.com',
      {
        getId: () => '$edit-1',
        getRelation: () => ({
          rel_type: 'm.replace',
          event_id: '$main-2',
        }),
      } as never
    );

    expect(nextSnapshot).not.toBeNull();
    if (!nextSnapshot) {
      throw new Error('Expected reaction patch to return a snapshot');
    }

    expect(nextSnapshot.messages[1]).toEqual(
      expect.objectContaining({
        id: '$main-2',
        body: 'Edited',
        isEdited: true,
        readByNames: ['Alex'],
      })
    );
    expect(nextSnapshot?.messages[0].body).toBe('First');
  });

  it('incrementally patches reactions for the affected message', () => {
    const snapshot = createSnapshot();
    const targetEvent = {
      getId: () => '$main-2',
    };
    const room = {
      findEventById: jest.fn((eventId: string) =>
        eventId === '$main-2' ? targetEvent : null
      ),
      relations: {
        getChildEventsForEvent: jest.fn(() => ({
          getRelations: () => [
            {
              getId: () => '$reaction-1',
            },
          ],
        })),
      },
      getMember: jest.fn(),
      getUsersReadUpTo: jest.fn(() => []),
    };
    (
      buildReactionIndex as jest.MockedFunction<typeof buildReactionIndex>
    ).mockReturnValueOnce(
      new Map([
        [
          '$main-2',
          [
            {
              key: '❤️',
              count: 1,
              isOwn: true,
              ownEventId: '$reaction-1',
              senderNames: ['Me'],
            },
          ],
        ],
      ])
    );

    const nextSnapshot = patchRoomSnapshotWithTimelineEvent(
      snapshot,
      {} as never,
      room as never,
      '@me:example.com',
      {
        getType: () => 'm.reaction',
        getId: () => '$reaction-1',
        getRelation: () => ({
          rel_type: 'm.annotation',
          event_id: '$main-2',
          key: '❤️',
        }),
      } as never
    );

    expect(nextSnapshot).not.toBeNull();
    if (!nextSnapshot) {
      throw new Error('Expected reaction patch to return a snapshot');
    }

    expect(nextSnapshot.messages[1].reactions).toEqual([
      expect.objectContaining({
        key: '❤️',
        count: 1,
        isOwn: true,
      }),
    ]);
  });

  it('incrementally patches reaction removals for redacted reactions', () => {
    const snapshot = {
      ...createSnapshot(),
      messages: createSnapshot().messages.map((message) =>
        message.id === '$main-2'
          ? {
              ...message,
              reactions: [
                {
                  key: '❤️',
                  count: 1,
                  isOwn: true,
                  ownEventId: '$reaction-1',
                  senderNames: ['Me'],
                },
              ],
            }
          : message
      ),
    };
    const redactedReactionEvent = {
      getId: () => '$reaction-1',
      getRelation: () => ({
        rel_type: 'm.annotation',
        event_id: '$main-2',
        key: '❤️',
      }),
    };
    const targetEvent = {
      getId: () => '$main-2',
    };
    const room = {
      findEventById: jest.fn((eventId: string) => {
        if (eventId === '$reaction-1') {
          return redactedReactionEvent;
        }

        if (eventId === '$main-2') {
          return targetEvent;
        }

        return null;
      }),
      relations: {
        getChildEventsForEvent: jest.fn(() => ({
          getRelations: () => [redactedReactionEvent],
        })),
      },
      getMember: jest.fn(),
      getUsersReadUpTo: jest.fn(() => []),
    };
    (
      buildReactionIndex as jest.MockedFunction<typeof buildReactionIndex>
    ).mockReturnValueOnce(new Map());

    const nextSnapshot = patchRoomSnapshotWithTimelineEvent(
      snapshot,
      {} as never,
      room as never,
      '@me:example.com',
      {
        getAssociatedId: () => '$reaction-1',
        isRedaction: () => true,
      } as never
    );

    expect(nextSnapshot).not.toBeNull();
    if (!nextSnapshot) {
      throw new Error('Expected reaction redaction patch to return a snapshot');
    }

    expect(nextSnapshot.messages[1].reactions).toEqual([]);
  });

  it('incrementally patches deleted messages without rebuilding the whole timeline', () => {
    const snapshot = createSnapshot();
    const targetEvent = {
      getId: () => '$main-3',
      replyEventId: null,
    };
    const room = {
      findEventById: jest.fn((eventId: string) =>
        eventId === '$main-3' ? targetEvent : null
      ),
      relations: {
        getAllChildEventsForEvent: jest.fn(() => []),
      },
      getMember: jest.fn((userId: string) =>
        userId === '@alex:example.com'
          ? {
              membership: 'join',
              name: 'Alex',
              rawDisplayName: 'Alex',
            }
          : null
      ),
      getUsersReadUpTo: jest.fn(() => ['@alex:example.com']),
    };
    (
      resolveTimelineMessagesFromEvents as jest.MockedFunction<
        typeof resolveTimelineMessagesFromEvents
      >
    ).mockReset();
    (
      resolveTimelineMessagesFromEvents as jest.MockedFunction<
        typeof resolveTimelineMessagesFromEvents
      >
    ).mockReturnValueOnce([
      {
        ...snapshot.messages[2],
        body: 'Message deleted',
        isDeleted: true,
        msgtype: 'm.notice',
      },
    ]);

    const nextSnapshot = patchRoomSnapshotWithTimelineEvent(
      snapshot,
      {} as never,
      room as never,
      '@me:example.com',
      {
        getAssociatedId: () => '$main-3',
        isRedaction: () => true,
      } as never
    );

    expect(nextSnapshot).not.toBeNull();
    if (!nextSnapshot) {
      throw new Error('Expected message redaction patch to return a snapshot');
    }

    expect(nextSnapshot.messages[2]).toEqual(
      expect.objectContaining({
        id: '$main-3',
        body: 'Message deleted',
        isDeleted: true,
        readByNames: ['Alex'],
      })
    );
  });
});
