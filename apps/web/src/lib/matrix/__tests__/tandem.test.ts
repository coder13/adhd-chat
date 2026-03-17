/// <reference types="jest" />

jest.mock('matrix-js-sdk', () => ({
  ClientEvent: {},
  Preset: {},
  Visibility: {},
}));

import {
  deleteTandemRoom,
  ensureTandemRelationshipRooms,
  getTandemMembershipPolicy,
  getTandemSpaceIdForRoom,
  joinTandemRoom,
  leaveTandemRoom,
  recoverTandemRelationshipRooms,
  TANDEM_RELATIONSHIPS_EVENT_TYPE,
  type TandemRelationshipRecord,
} from '../tandem';

type MockRoom = {
  roomId: string;
  getMyMembership: jest.Mock<string | undefined, []>;
  getMembers: jest.Mock<Array<{ userId: string; membership: string }>, []>;
  getAccountData: jest.Mock<{ getContent: () => Record<string, unknown> } | null, [string]>;
  leave: jest.Mock<Promise<void>, []>;
  currentState: {
    getStateEvents: jest.Mock<
      | {
          getContent: () => {
            kind?: string;
            spaceId?: string;
            canonical?: boolean;
          };
          getStateKey?: () => string | undefined;
        }
      | Array<{
          getContent: () => {
            kind?: string;
            spaceId?: string;
            canonical?: boolean;
          };
          getStateKey?: () => string | undefined;
        }>
      | null,
      [string, string?]
    >;
  };
  __stateEvents: Map<
    string,
    Array<{
      content: { kind?: string; spaceId?: string; canonical?: boolean };
      stateKey?: string;
    }>
  >;
};

type MockClient = {
  getRoom: jest.Mock<MockRoom | null, [string | undefined]>;
  joinRoom: jest.Mock<Promise<void>, [string]>;
  leave: jest.Mock<Promise<void>, [string]>;
  forget: jest.Mock<Promise<object>, [string, boolean?]>;
  kick: jest.Mock<Promise<object>, [string, string, string?]>;
  sendStateEvent: jest.Mock<Promise<unknown>, [string, string, Record<string, unknown>, string?]>;
  setRoomAccountData: jest.Mock<Promise<void>, [string, string, Record<string, unknown>]>;
  getAccountData: jest.Mock<
    {
      getContent: () => {
        incomingInvites: [];
        outgoingInvites: [];
        relationships: TandemRelationshipRecord[];
      };
    } | null,
    [string]
  >;
  getUserId: jest.Mock<string, []>;
  getRooms: jest.Mock<unknown[], []>;
};

function createRoom(membership: string | undefined): MockRoom {
  const stateEvents = new Map<
    string,
    Array<{
      content: { kind?: string; spaceId?: string; canonical?: boolean };
      stateKey?: string;
    }>
  >();

  return {
    roomId: '!room:matrix.org',
    getMyMembership: jest.fn(() => membership),
    getMembers: jest.fn(() => [
      { userId: '@sam:matrix.org', membership: membership ?? 'join' },
      { userId: '@alex:matrix.org', membership: 'join' },
    ]),
    getAccountData: jest.fn((_eventType: string) => null),
    leave: jest.fn(async () => {}),
    currentState: {
      getStateEvents: jest.fn((eventType: string, stateKey?: string) => {
        const events = stateEvents.get(eventType) ?? [];
        const matched =
          typeof stateKey === 'undefined'
            ? events
            : events.filter((event) => event.stateKey === stateKey);

        if (matched.length === 0) {
          return null;
        }

        const normalized = matched.map((event) => ({
          getContent: () => event.content,
          getStateKey: () => event.stateKey,
        }));

        if (typeof stateKey !== 'undefined') {
          return normalized[0] ?? null;
        }

        return normalized.length === 1 ? normalized[0] : normalized;
      }),
    },
    __stateEvents: stateEvents,
  };
}

function withStateEvent(
  room: MockRoom,
  eventType: string,
  content: { kind?: string; spaceId?: string; canonical?: boolean },
  stateKey?: string
) {
  const existing = room.__stateEvents.get(eventType) ?? [];
  existing.push({ content, stateKey: typeof stateKey === 'undefined' ? '' : stateKey });
  room.__stateEvents.set(eventType, existing);

  return room;
}

function createClient({
  roomsById = {},
  relationships = [],
}: {
  roomsById?: Record<string, MockRoom | null>;
  relationships?: TandemRelationshipRecord[];
} = {}) {
  const client: MockClient = {
    getRoom: jest.fn((roomId: string | undefined) =>
      roomId ? roomsById[roomId] ?? null : null
    ),
    joinRoom: jest.fn<Promise<void>, [string]>(async (_roomId: string) => {}),
    leave: jest.fn<Promise<void>, [string]>(async (_roomId: string) => {}),
    forget: jest.fn<Promise<object>, [string, boolean?]>(async () => ({})),
    kick: jest.fn<Promise<object>, [string, string, string?]>(async () => ({})),
    sendStateEvent: jest.fn<
      Promise<unknown>,
      [string, string, Record<string, unknown>, string?]
    >(async () => ({})),
    setRoomAccountData: jest.fn<
      Promise<void>,
      [string, string, Record<string, unknown>]
    >(async () => {}),
    getAccountData: jest.fn((eventType: string) => {
      if (eventType !== TANDEM_RELATIONSHIPS_EVENT_TYPE) {
        return null;
      }

      return {
        getContent: () => ({
          incomingInvites: [],
          outgoingInvites: [],
          relationships,
        }),
      };
    }),
    getUserId: jest.fn(() => '@sam:matrix.org'),
    getRooms: jest.fn(() => [] as unknown[]),
  };

  return client;
}

describe('tandem room recovery', () => {
  it('resolves a Tandem space from canonical m.space.parent links', () => {
    const topicRoom = withStateEvent(
      {
        ...createRoom('join'),
        roomId: '!topic:matrix.org',
      },
      'm.space.parent',
      { canonical: true },
      '!space:matrix.org'
    );
    const spaceRoom = withStateEvent(
      {
        ...createRoom('join'),
        roomId: '!space:matrix.org',
      },
      'com.tandem.space',
      {}
    );
    const client = createClient({
      roomsById: {
        '!topic:matrix.org': topicRoom,
        '!space:matrix.org': spaceRoom,
      },
    });

    expect(getTandemSpaceIdForRoom(client as never, topicRoom as never)).toBe(
      '!space:matrix.org'
    );
  });

  it('joins only Tandem rooms that are not already joined', async () => {
    const client = createClient({
      roomsById: {
        '!space:matrix.org': createRoom('invite'),
        '!main:matrix.org': createRoom('join'),
      },
    });

    const result = await ensureTandemRelationshipRooms(client as never, {
      sharedSpaceId: '!space:matrix.org',
      mainRoomId: '!main:matrix.org',
    });

    expect(client.joinRoom).toHaveBeenCalledTimes(1);
    expect(client.joinRoom).toHaveBeenCalledWith('!space:matrix.org');
    expect(result).toEqual({
      recoveredRoomIds: ['!space:matrix.org'],
      failedRoomIds: [],
    });
  });

  it('reports failed Tandem room recovery attempts', async () => {
    const client = createClient({
      roomsById: {
        '!space:matrix.org': createRoom('invite'),
      },
    });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    client.joinRoom.mockImplementation(async (roomId: string) => {
      if (roomId === '!space:matrix.org') {
        throw new Error('join failed');
      }
    });

    const result = await ensureTandemRelationshipRooms(client as never, {
      sharedSpaceId: '!space:matrix.org',
      mainRoomId: '!main:matrix.org',
    });

    expect(result.failedRoomIds).toEqual(['!space:matrix.org']);
    expect(result.recoveredRoomIds).toEqual(['!main:matrix.org']);
    consoleErrorSpy.mockRestore();
  });

  it('replays recovery across all accepted Tandem relationships', async () => {
    const client = createClient({
      roomsById: {
        '!space-a:matrix.org': createRoom('invite'),
        '!main-a:matrix.org': createRoom('join'),
        '!space-b:matrix.org': createRoom('join'),
        '!main-b:matrix.org': createRoom('leave'),
      },
      relationships: [
        {
          inviteId: 'invite-a',
          partnerUserId: '@alex:matrix.org',
          sharedSpaceId: '!space-a:matrix.org',
          mainRoomId: '!main-a:matrix.org',
          createdAt: '2026-03-15T00:00:00.000Z',
          status: 'active',
        },
        {
          inviteId: 'invite-b',
          partnerUserId: '@jamie:matrix.org',
          sharedSpaceId: '!space-b:matrix.org',
          mainRoomId: '!main-b:matrix.org',
          createdAt: '2026-03-15T00:00:00.000Z',
          status: 'active',
        },
      ],
    });

    const result = await recoverTandemRelationshipRooms(client as never);

    expect(client.joinRoom).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      recoveredRoomIds: ['!space-a:matrix.org', '!main-b:matrix.org'],
      failedRoomIds: [],
    });
  });
});

describe('milestone 1 membership policy', () => {
  it('allows leave flows only for Tandem topic rooms', () => {
    const client = createClient();
    const childRoom = withStateEvent(
      {
        ...createRoom('join'),
        roomId: '!topic:matrix.org',
      },
      'com.tandem.room',
      { kind: 'tandem-child-room', spaceId: '!space:matrix.org' }
    );
    const mainRoom = withStateEvent(
      {
        ...createRoom('join'),
        roomId: '!main:matrix.org',
      },
      'com.tandem.room',
      { kind: 'tandem-main-room', spaceId: '!space:matrix.org' }
    );

    expect(getTandemMembershipPolicy(client as never, childRoom as never))
      .toMatchObject({
        roomKind: 'tandem-child-room',
        supportsJoin: true,
        supportsLeave: true,
      });
    expect(getTandemMembershipPolicy(client as never, mainRoom as never))
      .toMatchObject({
        roomKind: 'tandem-main-room',
        supportsJoin: true,
        supportsLeave: false,
      });
  });

  it('blocks unsupported non-Tandem room membership actions', async () => {
    const client = createClient();
    const room = {
      ...createRoom('invite'),
      roomId: '!other:matrix.org',
    };

    await expect(
      joinTandemRoom(client as never, room as never)
    ).rejects.toThrow('Unavailable here.');
    await expect(
      leaveTandemRoom(client as never, room as never)
    ).rejects.toThrow('Unavailable here.');
  });

  it('leaves supported Tandem topic rooms', async () => {
    const client = createClient();
    const room = withStateEvent(
      {
        ...createRoom('join'),
        roomId: '!topic:matrix.org',
      },
      'com.tandem.room',
      { kind: 'tandem-child-room', spaceId: '!space:matrix.org' }
    );

    await leaveTandemRoom(client as never, room as never);

    expect(client.leave).toHaveBeenCalledWith('!topic:matrix.org');
  });

  it('deletes extra Tandem topics by unlinking and forgetting the room', async () => {
    const room = withStateEvent(
      {
        ...createRoom('join'),
        roomId: '!topic:matrix.org',
      },
      'com.tandem.room',
      { kind: 'tandem-child-room', spaceId: '!space:matrix.org' }
    );
    const client = createClient({
      roomsById: {
        '!topic:matrix.org': room,
      },
    });

    await deleteTandemRoom(client as never, room as never);

    expect(client.sendStateEvent).toHaveBeenNthCalledWith(
      1,
      '!space:matrix.org',
      'm.space.child',
      {},
      '!topic:matrix.org'
    );
    expect(client.sendStateEvent).toHaveBeenNthCalledWith(
      2,
      '!topic:matrix.org',
      'm.space.parent',
      {},
      '!space:matrix.org'
    );
    expect(client.kick).toHaveBeenCalledWith(
      '!topic:matrix.org',
      '@alex:matrix.org',
      'Topic deleted'
    );
    expect(client.leave).toHaveBeenCalledWith('!topic:matrix.org');
    expect(client.forget).toHaveBeenCalledWith('!topic:matrix.org', true);
  });

  it('does not allow deleting the main Tandem topic', async () => {
    const client = createClient();
    const room = withStateEvent(
      {
        ...createRoom('join'),
        roomId: '!main:matrix.org',
      },
      'com.tandem.room',
      { kind: 'tandem-main-room', spaceId: '!space:matrix.org' }
    );

    await expect(
      deleteTandemRoom(client as never, room as never)
    ).rejects.toThrow('Only extra topics can be deleted.');
  });
});
