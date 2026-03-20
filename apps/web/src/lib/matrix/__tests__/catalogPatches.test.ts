/// <reference types="jest" />

jest.mock('../chatCatalog', () => ({
  buildChatSummary: jest.fn(),
  buildContactSummariesForRoom: jest.fn(),
  compareChats: (left: { timestamp: number }, right: { timestamp: number }) =>
    right.timestamp - left.timestamp,
  compareContacts: (
    left: { lastMessageTs: number },
    right: { lastMessageTs: number }
  ) => right.lastMessageTs - left.lastMessageTs,
  getDirectRoomIds: jest.fn(),
}));

jest.mock('../spaceCatalog', () => ({
  buildTandemSpaceRoomCatalogFromLocalState: jest.fn(),
  buildTandemSpaceRoomSummary: jest.fn(),
  buildTandemSpaceSummary: jest.fn(),
  compareTandemSpaceRooms: (
    left: { timestamp: number },
    right: { timestamp: number }
  ) => right.timestamp - left.timestamp,
  compareTandemSpaces: (
    left: { timestamp: number },
    right: { timestamp: number }
  ) => right.timestamp - left.timestamp,
}));

jest.mock('../tandem', () => ({
  TANDEM_SPACE_EVENT_TYPE: 'com.tandem.space',
  getResolvedTandemRelationships: jest.fn(() => ({
    relationships: [],
  })),
  getTandemSpaceIdForRoom: jest.fn(() => null),
}));

import {
  applyContactCatalogRoomPatch,
  patchContactCatalogEntry,
  patchOtherChatCatalogEntry,
  patchTandemSpaceCatalogEntry,
  replaceTandemSpaceRoomCatalog,
} from '../catalogPatches';
import {
  buildChatSummary,
  buildContactSummariesForRoom,
  getDirectRoomIds,
} from '../chatCatalog';
import {
  buildTandemSpaceRoomCatalogFromLocalState,
  buildTandemSpaceSummary,
} from '../spaceCatalog';
import {
  getResolvedTandemRelationships,
  getTandemSpaceIdForRoom,
} from '../tandem';

const mockedBuildChatSummary = jest.mocked(buildChatSummary);
const mockedBuildContactSummariesForRoom = jest.mocked(buildContactSummariesForRoom);
const mockedBuildTandemSpaceRoomCatalogFromLocalState = jest.mocked(
  buildTandemSpaceRoomCatalogFromLocalState
);
const mockedBuildTandemSpaceSummary = jest.mocked(buildTandemSpaceSummary);
const mockedGetDirectRoomIds = jest.mocked(getDirectRoomIds);
const mockedGetResolvedTandemRelationships = jest.mocked(
  getResolvedTandemRelationships
);
const mockedGetTandemSpaceIdForRoom = jest.mocked(getTandemSpaceIdForRoom);

describe('catalogPatches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('patches a tandem space summary for the room that changed', () => {
    const room = {
      roomId: '!child:example.com',
      currentState: {
        getStateEvents: jest.fn(() => null),
      },
    };
    const spaceRoom = {
      roomId: '!space:example.com',
      getMyMembership: jest.fn(() => 'join'),
      currentState: {
        getStateEvents: jest.fn(() => ({ getType: () => 'com.tandem.space' })),
      },
    };
    const client = {
      getRoom: jest.fn((roomId: string) =>
        roomId === '!space:example.com' ? (spaceRoom as never) : null
      ),
    };

    mockedGetResolvedTandemRelationships.mockReturnValue({
      incomingInvites: [],
      outgoingInvites: [],
      relationships: [
        {
          inviteId: 'invite-1',
          partnerUserId: '@alex:example.com',
          sharedSpaceId: '!space:example.com',
          mainRoomId: '!main:example.com',
          createdAt: '2026-03-17T00:00:00.000Z',
          status: 'active',
        },
      ],
    });
    mockedGetTandemSpaceIdForRoom.mockReturnValue('!space:example.com');
    mockedBuildTandemSpaceSummary.mockReturnValue({
      spaceId: '!space:example.com',
      name: 'Updated hub',
      icon: null,
      description: null,
      partnerUserId: '@alex:example.com',
      mainRoomId: '!main:example.com',
      preview: 'Latest update',
      timestamp: 20,
      unreadCount: 3,
      roomCount: 2,
    });

    const nextSpaces = patchTandemSpaceCatalogEntry(
      [
        {
          spaceId: '!space:example.com',
          name: 'Old hub',
          icon: null,
          description: null,
          partnerUserId: '@alex:example.com',
          mainRoomId: '!main:example.com',
          preview: 'Old preview',
          timestamp: 5,
          unreadCount: 0,
          roomCount: 1,
        },
      ],
      client as never,
      '@me:example.com',
      null,
      room as never
    );

    expect(nextSpaces).toEqual([
      expect.objectContaining({
        spaceId: '!space:example.com',
        name: 'Updated hub',
        timestamp: 20,
      }),
    ]);
  });

  it('removes contacts for rooms that are no longer direct chats', async () => {
    const room = {
      roomId: '!room:example.com',
      getMyMembership: jest.fn(() => 'join'),
      loadMembersIfNeeded: jest.fn(() => Promise.resolve()),
    };
    const client = {
      getRoom: jest.fn(() => room as never),
    };

    mockedGetDirectRoomIds.mockReturnValue(new Set(['!other:example.com']));

    const nextContacts = await patchContactCatalogEntry(
      [
        {
          userId: '@alex:example.com',
          displayName: 'Alex',
          roomId: '!room:example.com',
          lastMessageTs: 10,
        },
        {
          userId: '@jamie:example.com',
          displayName: 'Jamie',
          roomId: '!other:example.com',
          lastMessageTs: 20,
        },
      ],
      client as never,
      '@me:example.com',
      '!room:example.com'
    );

    expect(nextContacts).toEqual([
      expect.objectContaining({
        roomId: '!other:example.com',
        userId: '@jamie:example.com',
      }),
    ]);
    expect(mockedBuildContactSummariesForRoom).not.toHaveBeenCalled();
  });

  it('applies contact room patches against the current catalog state', () => {
    const nextContacts = applyContactCatalogRoomPatch(
      [
        {
          userId: '@alex:example.com',
          displayName: 'Alex',
          roomId: '!old:example.com',
          lastMessageTs: 10,
        },
        {
          userId: '@jamie:example.com',
          displayName: 'Jamie',
          roomId: '!other:example.com',
          lastMessageTs: 20,
        },
      ],
      '!old:example.com',
      [
        {
          userId: '@alex:example.com',
          displayName: 'Alex',
          roomId: '!new:example.com',
          lastMessageTs: 30,
        },
      ]
    );

    expect(nextContacts).toEqual([
      expect.objectContaining({
        userId: '@alex:example.com',
        roomId: '!new:example.com',
        lastMessageTs: 30,
      }),
      expect.objectContaining({
        userId: '@jamie:example.com',
        roomId: '!other:example.com',
      }),
    ]);
  });

  it('rebuilds the full tandem space room catalog when the hub room changes', () => {
    mockedBuildTandemSpaceRoomCatalogFromLocalState.mockReturnValue([
      {
        id: '!room:example.com',
        name: 'Updated topic',
        icon: null,
        description: null,
        preview: 'Preview',
        timestamp: 30,
        unreadCount: 2,
        memberCount: 2,
        membership: 'join',
        isPinned: false,
        isArchived: false,
      },
    ]);

    const nextRooms = replaceTandemSpaceRoomCatalog(
      {} as never,
      '@me:example.com',
      '!space:example.com'
    );

    expect(nextRooms).toEqual([
      expect.objectContaining({
        id: '!room:example.com',
        name: 'Updated topic',
      }),
    ]);
    expect(mockedBuildTandemSpaceRoomCatalogFromLocalState).toHaveBeenCalledWith(
      {} as never,
      '@me:example.com',
      '!space:example.com'
    );
  });

  it('removes chats from the other-rooms list when they become primary', () => {
    const room = {
      roomId: '!room:example.com',
    };
    const client = {
      getRoom: jest.fn(() => room as never),
    };
    mockedGetTandemSpaceIdForRoom.mockReturnValue('!space:example.com');

    mockedBuildChatSummary.mockReturnValue({
      id: '!room:example.com',
      name: 'Main room',
      icon: null,
      preview: 'Preview',
      timestamp: 30,
      unreadCount: 0,
      isDirect: true,
      isEncrypted: true,
      memberCount: 2,
      nativeSpaceName: null,
      source: 'primary',
      isTandemMain: true,
      isPinned: false,
      isArchived: false,
    });

    const nextChats = patchOtherChatCatalogEntry(
      [
        {
          id: '!room:example.com',
          name: 'Old room',
          icon: null,
          preview: 'Preview',
          timestamp: 10,
          unreadCount: 0,
          isDirect: false,
          isEncrypted: false,
          memberCount: 2,
          nativeSpaceName: null,
          source: 'other',
          isTandemMain: false,
          isPinned: false,
          isArchived: false,
        },
      ],
      client as never,
      '@me:example.com',
      '!room:example.com'
    );

    expect(nextChats).toEqual([]);
  });

  it('keeps direct non-tandem chats in the other-rooms list', () => {
    const room = {
      roomId: '!room:example.com',
    };
    const client = {
      getRoom: jest.fn(() => room as never),
    };
    mockedGetTandemSpaceIdForRoom.mockReturnValue(null);

    mockedBuildChatSummary.mockReturnValue({
      id: '!room:example.com',
      name: 'Direct room',
      icon: null,
      preview: 'Preview',
      timestamp: 30,
      unreadCount: 0,
      isDirect: true,
      isEncrypted: true,
      memberCount: 2,
      nativeSpaceName: null,
      source: 'primary',
      isTandemMain: false,
      isPinned: false,
      isArchived: false,
    });

    const nextChats = patchOtherChatCatalogEntry(
      [],
      client as never,
      '@me:example.com',
      '!room:example.com'
    );

    expect(nextChats).toEqual([
      expect.objectContaining({
        id: '!room:example.com',
        source: 'primary',
      }),
    ]);
  });
});
