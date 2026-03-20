/// <reference types="jest" />

import { renderHook } from '@testing-library/react';
import { useMatrixViewResource } from '../useMatrixViewResource';
import { useRoomSnapshotStore } from '../useRoomSnapshotStore';
import type { RoomSnapshot } from '../../lib/matrix/roomSnapshot';
import { persistNormalizedRoomSnapshot } from '../../lib/matrix/store/matrixViewActions';

jest.mock('../useMatrixViewResource', () => ({
  useMatrixViewResource: jest.fn(),
}));

jest.mock('../../lib/matrix/store/matrixViewActions', () => ({
  createInitialRoomSnapshot: jest.fn(
    (): RoomSnapshot =>
      ({
        roomName: '',
        roomTopic: null,
        roomDescription: null,
        roomIcon: null,
        roomAvatarUrl: null,
        roomSubtitle: '',
        messages: [],
        threads: [],
        isEncrypted: false,
        roomMeta: {},
      }) as RoomSnapshot
  ),
  loadRoomSnapshotAction: jest.fn(),
  paginateRoomSnapshotAction: jest.fn(),
  persistNormalizedRoomSnapshot: jest.fn(),
  refreshRoomSnapshotAction: jest.fn(),
}));

describe('useRoomSnapshotStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMatrixViewResource as jest.Mock).mockReturnValue({
      data: {
        roomName: '',
        roomDescription: null,
        roomIcon: null,
        roomAvatarUrl: null,
        roomSubtitle: '',
        messages: [],
        threads: [],
        isEncrypted: false,
        roomMeta: {},
      },
      error: null,
      hasCachedData: false,
      isLoading: false,
      isRefreshing: false,
      clear: jest.fn(),
      refresh: jest.fn(),
      updateData: jest.fn((updater: unknown) => updater),
    });
  });

  it('keeps wrapped callbacks stable when room context is unchanged', () => {
    const props = {
      client: null,
      enabled: false,
      roomId: '!room:example.org',
      userId: '@user:example.org',
    };
    const { result, rerender } = renderHook(
      (nextProps: typeof props) => useRoomSnapshotStore(nextProps),
      {
        initialProps: props,
      }
    );

    const firstRefresh = result.current.refresh;
    const firstUpdateData = result.current.updateData;
    const firstPaginateBack = result.current.paginateBack;

    rerender(props);

    expect(result.current.refresh).toBe(firstRefresh);
    expect(result.current.updateData).toBe(firstUpdateData);
    expect(result.current.paginateBack).toBe(firstPaginateBack);
  });

  it('normalizes cached message ownership from sender id', () => {
    (useMatrixViewResource as jest.Mock).mockReturnValue({
      data: {
        roomName: 'Room',
        roomDescription: null,
        roomIcon: null,
        roomAvatarUrl: null,
        roomSubtitle: '1 member',
        messages: [
          {
            id: '$one',
            senderId: '@user:example.org',
            senderName: 'Cailyn',
            body: 'hello',
            timestamp: 1,
            isOwn: false,
            msgtype: 'm.text',
            reactions: [],
            mentionedUserIds: [],
            threadRootId: null,
            isThreadRoot: false,
          },
        ],
        threads: [],
        isEncrypted: false,
        roomMeta: {},
      },
      error: null,
      hasCachedData: true,
      isLoading: false,
      isRefreshing: false,
      clear: jest.fn(),
      refresh: jest.fn(),
      updateData: jest.fn((updater: unknown) => updater),
    });

    const { result } = renderHook(() =>
      useRoomSnapshotStore({
        client: null,
        enabled: false,
        roomId: '!room:example.org',
        userId: '@user:example.org',
      })
    );

    expect(result.current.data.messages[0]?.isOwn).toBe(true);
  });

  it('persists normalized ownership when updating snapshot data', () => {
    const baseSnapshot: RoomSnapshot = {
      roomName: 'Room',
      roomDescription: null,
      roomIcon: null,
      roomAvatarUrl: null,
      roomSubtitle: '1 member',
      messages: [],
      threads: [],
      isEncrypted: false,
      roomMeta: {},
    };
    const baseUpdateData = jest.fn(
      (
        updater: RoomSnapshot | ((currentValue: RoomSnapshot) => RoomSnapshot)
      ) =>
        typeof updater === 'function' ? updater(baseSnapshot) : updater
    );

    (useMatrixViewResource as jest.Mock).mockReturnValue({
      data: baseSnapshot,
      error: null,
      hasCachedData: true,
      isLoading: false,
      isRefreshing: false,
      clear: jest.fn(),
      refresh: jest.fn(),
      updateData: baseUpdateData,
    });

    const { result } = renderHook(() =>
      useRoomSnapshotStore({
        client: null,
        enabled: false,
        roomId: '!room:example.org',
        userId: '@user:example.org',
      })
    );

    result.current.updateData({
      roomName: 'Room',
      roomDescription: null,
      roomIcon: null,
      roomAvatarUrl: null,
      roomSubtitle: '1 member',
      messages: [
        {
          id: '$one',
          senderId: '@user:example.org',
          senderName: 'Cailyn',
          body: 'hello',
          timestamp: 1,
          isOwn: false,
          msgtype: 'm.text',
          reactions: [],
          mentionedUserIds: [],
          threadRootId: null,
          isThreadRoot: false,
        },
      ],
      threads: [],
      isEncrypted: false,
      roomMeta: {},
    });

    expect(baseUpdateData).toHaveBeenCalled();
    expect(persistNormalizedRoomSnapshot).toHaveBeenCalledWith(
      '@user:example.org',
      '!room:example.org',
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            id: '$one',
            isOwn: true,
          }),
        ],
      })
    );
  });
});
