/// <reference types="jest" />

jest.mock('matrix-js-sdk', () => ({
  ClientEvent: {},
  Preset: {},
  Visibility: {},
}));

import {
  ensureTandemRelationshipRooms,
  recoverTandemRelationshipRooms,
  TANDEM_RELATIONSHIPS_EVENT_TYPE,
  type TandemRelationshipRecord,
} from '../tandem';

type MockRoom = {
  getMyMembership: jest.Mock<string | undefined, []>;
};

type MockClient = {
  getRoom: jest.Mock<MockRoom | null, [string | undefined]>;
  joinRoom: jest.Mock<Promise<void>, [string]>;
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
  return {
    getMyMembership: jest.fn(() => membership),
  };
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
