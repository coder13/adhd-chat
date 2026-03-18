/// <reference types="jest" />

jest.mock('../timelineMessageResolver', () => ({
  resolveTimelineMessagesFromEvents: jest.fn(),
}));

import { resolveTimelineMessagesFromEvents } from '../timelineMessageResolver';
import { getRoomThreadSnapshots } from '../threadCatalog';

function createEvent(
  id: string,
  timestamp: number,
  bundledThreadRelation?: {
    count?: number;
    current_user_participated?: boolean;
  }
) {
  return {
    getId: jest.fn(() => id),
    getTs: jest.fn(() => timestamp),
    getServerAggregatedRelation: jest.fn((relationType: string) =>
      relationType === 'm.thread' ? bundledThreadRelation ?? null : null
    ),
  };
}

describe('getRoomThreadSnapshots', () => {
  const resolveTimelineMessagesFromEventsMock =
    resolveTimelineMessagesFromEvents as jest.MockedFunction<
      typeof resolveTimelineMessagesFromEvents
    >;

  beforeEach(() => {
    resolveTimelineMessagesFromEventsMock.mockReset();
  });

  it('builds thread snapshots with reply counts, latest replies, and participation', () => {
    const rootEvent = createEvent('root-1', 100, {
      count: 4,
      current_user_participated: true,
    });
    const replyOneEvent = createEvent('reply-1', 150);
    const replyTwoEvent = createEvent('reply-2', 200);

    resolveTimelineMessagesFromEventsMock.mockImplementation(
      (_client, _room, _currentUserId, events) => {
        const firstEventId = events[0]?.getId();

        if (firstEventId === 'root-1') {
          return [
            {
              id: 'root-1',
              body: 'Root message',
              timestamp: 100,
            },
          ] as never;
        }

        return [
          {
            id: 'reply-1',
            body: 'First reply',
            timestamp: 150,
          },
          {
            id: 'reply-2',
            body: 'Latest reply',
            timestamp: 200,
          },
        ] as never;
      }
    );

    const snapshots = getRoomThreadSnapshots(
      {} as never,
      {
        getThreads: jest.fn(() => [
          {
            id: 'root-1',
            rootEvent,
            events: [replyOneEvent, replyTwoEvent],
            lastReply: jest.fn(() => replyTwoEvent),
            length: 2,
            hasCurrentUserParticipated: false,
          },
        ]),
        findEventById: jest.fn(() => null),
      } as never,
      '@me:matrix.org'
    );

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.rootMessageId).toBe('root-1');
    expect(snapshots[0]?.replyCount).toBe(4);
    expect(snapshots[0]?.hasCurrentUserParticipated).toBe(true);
    expect(snapshots[0]?.latestReply).toMatchObject({
      id: 'reply-2',
      body: 'Latest reply',
    });
    expect(snapshots[0]?.replies.map((reply) => reply.id)).toEqual([
      'reply-1',
      'reply-2',
    ]);
  });

  it('sorts threads by latest activity and skips unresolved roots', () => {
    const newerRootEvent = createEvent('root-new', 300);
    const olderRootEvent = createEvent('root-old', 100);
    const newerReplyEvent = createEvent('reply-new', 350);
    const olderReplyEvent = createEvent('reply-old', 150);

    resolveTimelineMessagesFromEventsMock.mockImplementation(
      (_client, _room, _currentUserId, events) => {
        const firstEventId = events[0]?.getId();

        if (firstEventId === 'root-new') {
          return [
            {
              id: 'root-new',
              body: 'New root',
              timestamp: 300,
            },
          ] as never;
        }

        if (firstEventId === 'root-old') {
          return [
            {
              id: 'root-old',
              body: 'Old root',
              timestamp: 100,
            },
          ] as never;
        }

        if (firstEventId === 'reply-new') {
          return [
            {
              id: 'reply-new',
              body: 'New reply',
              timestamp: 350,
            },
          ] as never;
        }

        if (firstEventId === 'reply-old') {
          return [
            {
              id: 'reply-old',
              body: 'Old reply',
              timestamp: 150,
            },
          ] as never;
        }

        return [];
      }
    );

    const snapshots = getRoomThreadSnapshots(
      {} as never,
      {
        getThreads: jest.fn(() => [
          {
            id: 'missing-root',
            rootEvent: null,
            events: [],
            lastReply: jest.fn(() => null),
            length: 0,
            hasCurrentUserParticipated: false,
          },
          {
            id: 'root-old',
            rootEvent: olderRootEvent,
            events: [olderReplyEvent],
            lastReply: jest.fn(() => olderReplyEvent),
            length: 1,
            hasCurrentUserParticipated: false,
          },
          {
            id: 'root-new',
            rootEvent: newerRootEvent,
            events: [newerReplyEvent],
            lastReply: jest.fn(() => newerReplyEvent),
            length: 1,
            hasCurrentUserParticipated: false,
          },
        ]),
        findEventById: jest.fn(() => null),
      } as never,
      '@me:matrix.org'
    );

    expect(snapshots.map((thread) => thread.rootMessageId)).toEqual([
      'root-new',
      'root-old',
    ]);
  });
});
