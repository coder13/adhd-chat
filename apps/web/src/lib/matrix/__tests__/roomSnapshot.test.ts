/// <reference types="jest" />

jest.mock('matrix-js-sdk', () => ({
  MsgType: {
    Text: 'm.text',
  },
  NotificationCountType: {
    Total: 'total',
  },
}));

jest.mock('../chatCatalog', () => ({
  getRoomDisplayName: jest.fn((room: { roomId?: string }) =>
    room.roomId === '!space:example.com' ? 'Shared Hub' : 'Conversation'
  ),
  getTimelineMessages: jest.fn(() => []),
}));

jest.mock('../identity', () => ({
  getRoomIcon: jest.fn(() => null),
  getRoomTopic: jest.fn(() => null),
}));

jest.mock('../roomThreads', () => ({
  ensureRoomThreadsLoaded: jest.fn(async () => undefined),
}));

jest.mock('../tandem', () => ({
  getTandemRoomMeta: jest.fn(() => ({})),
  getTandemSpaceIdForRoom: jest.fn(() => null),
}));

jest.mock('../threadCatalog', () => ({
  getRoomThreadSnapshots: jest.fn(() => []),
}));

const mockEndMatrixPerfTimer = jest.fn();
const mockStartMatrixPerfTimer = jest.fn(() => ({
  end: mockEndMatrixPerfTimer,
}));

jest.mock('../performanceMetrics', () => ({
  startMatrixPerfTimer: mockStartMatrixPerfTimer,
}));

import { getRoomThreadSnapshots } from '../threadCatalog';
import { startMatrixPerfTimer } from '../performanceMetrics';
import { ensureRoomThreadsLoaded } from '../roomThreads';
import { getTandemSpaceIdForRoom } from '../tandem';
import { buildRoomSnapshot, getAllSnapshotMessages } from '../roomSnapshot';

describe('getAllSnapshotMessages', () => {
  it('tolerates cached snapshots without a threads array', () => {
    const messages = getAllSnapshotMessages({
      roomName: 'Conversation',
      roomDescription: null,
      roomIcon: null,
      roomAvatarUrl: null,
      roomSubtitle: '2 members',
      messages: [
        {
          id: '$root',
          senderId: '@alex:example.com',
          senderName: 'Alex',
          body: 'Hello',
          timestamp: 1,
          isOwn: false,
          msgtype: 'm.text',
        },
      ],
      isEncrypted: false,
      roomMeta: {},
    } as never);

    expect(messages).toEqual([
      expect.objectContaining({
        id: '$root',
        body: 'Hello',
      }),
    ]);
  });
});

describe('buildRoomSnapshot', () => {
  beforeEach(() => {
    mockEndMatrixPerfTimer.mockClear();
    (
      startMatrixPerfTimer as jest.MockedFunction<typeof startMatrixPerfTimer>
    ).mockClear();
    (
      getTandemSpaceIdForRoom as jest.MockedFunction<
        typeof getTandemSpaceIdForRoom
      >
    ).mockReturnValue(null);
  });

  it('bootstraps room threads before reading thread snapshots', async () => {
    const room = {
      roomId: '!room:example.com',
      loadMembersIfNeeded: jest.fn(async () => undefined),
      currentState: {
        getStateEvents: jest.fn(() => null),
      },
      getAvatarUrl: jest.fn(() => null),
      getJoinedMemberCount: jest.fn(() => 2),
    };
    const client = {
      getHomeserverUrl: jest.fn(() => 'https://example.com'),
    };

    await buildRoomSnapshot(client as never, room as never, '@me:example.com');

    const ensureRoomThreadsLoadedMock =
      ensureRoomThreadsLoaded as jest.MockedFunction<typeof ensureRoomThreadsLoaded>;
    const getRoomThreadSnapshotsMock =
      getRoomThreadSnapshots as jest.MockedFunction<typeof getRoomThreadSnapshots>;

    expect(ensureRoomThreadsLoadedMock).toHaveBeenCalledWith(room);
    expect(getRoomThreadSnapshotsMock).toHaveBeenCalledWith(
      client,
      room,
      '@me:example.com'
    );
    expect(startMatrixPerfTimer).toHaveBeenCalledWith(
      'matrix.room.snapshot.build',
      { roomId: '!room:example.com' }
    );
    expect(mockEndMatrixPerfTimer).toHaveBeenCalledWith({
      messageCount: 0,
      threadCount: 0,
    });
    expect(
      ensureRoomThreadsLoadedMock.mock.invocationCallOrder[0]
    ).toBeLessThan(getRoomThreadSnapshotsMock.mock.invocationCallOrder[0]);
  });

  it('derives the room subtitle from the local Tandem space', async () => {
    (
      getTandemSpaceIdForRoom as jest.MockedFunction<
        typeof getTandemSpaceIdForRoom
      >
    ).mockReturnValue('!space:example.com');

    const room = {
      roomId: '!room:example.com',
      loadMembersIfNeeded: jest.fn(async () => undefined),
      currentState: {
        getStateEvents: jest.fn(() => null),
      },
      getAvatarUrl: jest.fn(() => null),
      getJoinedMemberCount: jest.fn(() => 2),
    };
    const client = {
      getHomeserverUrl: jest.fn(() => 'https://example.com'),
      getRoom: jest.fn((roomId: string) =>
        roomId === '!space:example.com'
          ? { roomId: '!space:example.com' }
          : room
      ),
    };

    const snapshot = await buildRoomSnapshot(
      client as never,
      room as never,
      '@me:example.com'
    );

    expect(snapshot.roomSubtitle).toBe('Shared Hub');
    expect(client.getRoom).toHaveBeenCalledWith('!space:example.com');
  });
});
