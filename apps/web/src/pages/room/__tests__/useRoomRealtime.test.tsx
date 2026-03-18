/// <reference types="jest" />

import { act, renderHook } from '@testing-library/react';
import { RoomEvent, ThreadEvent } from 'matrix-js-sdk';
import type { RoomSnapshot } from '../../../lib/matrix/roomSnapshot';
import type {
  OptimisticReactionChange,
  OptimisticTimelineMessage,
} from '../../../lib/matrix/optimisticTimeline';
import { useRoomRealtime } from '../useRoomRealtime';

jest.mock('matrix-js-sdk', () => ({
  ClientEvent: {
    Sync: 'sync',
  },
  RoomEvent: {
    Timeline: 'Room.timeline',
    Receipt: 'Room.receipt',
    Name: 'Room.name',
    MyMembership: 'Room.myMembership',
    AccountData: 'Room.accountData',
    TimelineReset: 'Room.timelineReset',
    LocalEchoUpdated: 'Room.localEchoUpdated',
  },
  ThreadEvent: {
    New: 'Thread.new',
    Update: 'Thread.update',
    NewReply: 'Thread.newReply',
    Delete: 'Thread.delete',
  },
  RoomMemberEvent: {
    Typing: 'RoomMember.typing',
    Name: 'RoomMember.name',
  },
}));

jest.mock('../../../lib/matrix/pendingTandemRoom', () => ({
  clearPendingTandemRoom: jest.fn(),
  getPendingTandemRoom: jest.fn(() => null),
  subscribeToPendingTandemRooms: jest.fn(() => () => undefined),
}));

jest.mock('../../../lib/matrix/timelineEvents', () => ({
  getRoomTimelineEvents: jest.fn(() => []),
  isTimelineMessageEvent: jest.fn(() => false),
}));

jest.mock('../../../lib/matrix/typingIndicators', () => ({
  getTypingMemberNames: jest.fn(() => []),
  TYPING_IDLE_TIMEOUT_MS: 5000,
  TYPING_RENEWAL_INTERVAL_MS: 2000,
  TYPING_SERVER_TIMEOUT_MS: 30000,
}));

jest.mock('../../../lib/matrix/tandem', () => ({
  ensureTandemSpaceLinks: jest.fn(() => Promise.resolve()),
}));

class MockClient {
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  readonly room = { roomId: '!room:example.com' };

  on = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    const handlers = this.listeners.get(event) ?? new Set();
    handlers.add(handler);
    this.listeners.set(event, handlers);
  });

  off = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    this.listeners.get(event)?.delete(handler);
  });

  emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((handler) => {
      handler(...args);
    });
  }

  getRoom = jest.fn((roomId: string) =>
    roomId === this.room.roomId ? (this.room as never) : null
  );
}

class MockRoom {
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  readonly roomId = '!room:example.com';

  on = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    const handlers = this.listeners.get(event) ?? new Set();
    handlers.add(handler);
    this.listeners.set(event, handlers);
  });

  off = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    this.listeners.get(event)?.delete(handler);
  });

  emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((handler) => {
      handler(...args);
    });
  }
}

function createSnapshot(): RoomSnapshot {
  const rootMessage = {
    id: '$thread-root',
    senderId: '@alex:example.com',
    senderName: 'Alex',
    body: 'Thread root',
    timestamp: 1,
    isOwn: false,
    msgtype: 'm.text',
    threadRootId: null,
    isThreadRoot: true,
  };
  const replyMessage = {
    id: '$thread-reply',
    senderId: '@me:example.com',
    senderName: 'Me',
    body: 'Reply',
    timestamp: 2,
    isOwn: true,
    msgtype: 'm.text',
    threadRootId: '$thread-root',
    isThreadRoot: false,
  };

  return {
    roomName: 'Conversation',
    roomDescription: null,
    roomIcon: null,
    roomAvatarUrl: null,
    roomSubtitle: '2 members',
    messages: [rootMessage],
    threads: [
      {
        rootMessageId: '$thread-root',
        rootMessage,
        replies: [replyMessage],
        replyCount: 1,
        latestReply: replyMessage,
        hasCurrentUserParticipated: true,
      },
    ],
    isEncrypted: false,
    roomMeta: {},
  };
}

describe('useRoomRealtime', () => {
  it('passes threaded snapshot replies into optimistic reconciliation', () => {
    const snapshot = createSnapshot();
    const refresh = jest.fn(() => Promise.resolve());
    const refreshTangentTopics = jest.fn(() => Promise.resolve());
    const scrollToLatest = jest.fn();
    const navigate = jest.fn();
    const reconcileOptimisticTimeline = jest.fn(
      (
        _messages: RoomSnapshot['messages'],
        currentMessages: OptimisticTimelineMessage[]
      ) => currentMessages
    );
    const reconcileOptimisticReactionChanges = jest.fn(
      (
        _messages: RoomSnapshot['messages'],
        currentChanges: OptimisticReactionChange[]
      ) => currentChanges
    );
    const setOptimisticMessages = jest.fn();
    const setOptimisticReactionChanges = jest.fn();
    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: null,
      user: null,
      roomId: null,
      isReady: false,
      isPendingRoom: false,
      currentRoom: null,
      snapshot,
      refresh,
      refreshTangentTopics,
      canInteractWithTimeline: false,
      tangentRelationship: null,
      tangentSpaceId: null,
      draft: '',
      contentRef: { current: null },
      composerRef: { current: null },
      scrollToLatest,
      outgoingTypingRef: { current: false },
      lastTypingSentAtRef: { current: 0 },
      typingRateLimitUntilRef: { current: 0 },
      typingIdleTimeoutRef: { current: null },
      lastReadReceiptEventIdRef: { current: null },
      setOptimisticMessages,
      setOptimisticReactionChanges,
      reconcileOptimisticTimeline,
      reconcileOptimisticReactionChanges,
      navigate,
    };

    renderHook(() => useRoomRealtime(params));

    const optimisticTimelineUpdater = setOptimisticMessages.mock.calls[0][0] as (
      currentMessages: unknown[]
    ) => unknown[];
    const optimisticReactionUpdater = setOptimisticReactionChanges.mock.calls[0][0] as (
      currentChanges: unknown[]
    ) => unknown[];

    act(() => {
      optimisticTimelineUpdater([]);
      optimisticReactionUpdater([]);
    });

    expect(reconcileOptimisticTimeline).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: '$thread-root' }),
        expect.objectContaining({
          id: '$thread-reply',
          threadRootId: '$thread-root',
        }),
      ]),
      []
    );
    expect(reconcileOptimisticTimeline.mock.calls[0][0]).toHaveLength(2);
    expect(reconcileOptimisticReactionChanges.mock.calls[0][0]).toHaveLength(2);
  });

  it('refreshes when the active room emits a local echo update', async () => {
    const client = new MockClient();
    const user = { userId: '@me:example.com' };
    const snapshot: RoomSnapshot = {
      roomName: 'Conversation',
      roomDescription: null,
      roomIcon: null,
      roomAvatarUrl: null,
      roomSubtitle: '2 members',
      messages: [],
      threads: [],
      isEncrypted: false,
      roomMeta: {},
    };
    const refresh = jest.fn(() => Promise.resolve());
    const refreshTangentTopics = jest.fn(() => Promise.resolve());
    const setOptimisticMessages = jest.fn();
    const setOptimisticReactionChanges = jest.fn();
    const reconcileOptimisticTimeline = jest.fn(
      (
        _messages: RoomSnapshot['messages'],
        currentMessages: OptimisticTimelineMessage[]
      ) => currentMessages
    );
    const reconcileOptimisticReactionChanges = jest.fn(
      (
        _messages: RoomSnapshot['messages'],
        currentChanges: OptimisticReactionChange[]
      ) => currentChanges
    );
    const navigate = jest.fn();
    const scrollToLatest = jest.fn();
    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: client as never,
      user: user as never,
      roomId: client.room.roomId,
      isReady: false,
      isPendingRoom: false,
      currentRoom: null,
      snapshot,
      refresh,
      refreshTangentTopics,
      canInteractWithTimeline: false,
      tangentRelationship: null,
      tangentSpaceId: null,
      draft: '',
      contentRef: { current: null },
      composerRef: { current: null },
      scrollToLatest,
      outgoingTypingRef: { current: false },
      lastTypingSentAtRef: { current: 0 },
      typingRateLimitUntilRef: { current: 0 },
      typingIdleTimeoutRef: { current: null },
      lastReadReceiptEventIdRef: { current: null },
      setOptimisticMessages,
      setOptimisticReactionChanges,
      reconcileOptimisticTimeline,
      reconcileOptimisticReactionChanges,
      navigate,
    };

    renderHook(() => useRoomRealtime(params));

    await act(async () => {
      await Promise.resolve();
    });

    refresh.mockClear();

    act(() => {
      client.emit(
        RoomEvent.LocalEchoUpdated,
        { getId: () => '$thread-reply' },
        { roomId: '!other:example.com' }
      );
    });
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      client.emit(
        RoomEvent.LocalEchoUpdated,
        { getId: () => '$thread-reply' },
        { roomId: client.room.roomId }
      );
      await Promise.resolve();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes when the active room emits thread updates', async () => {
    const room = new MockRoom();
    const snapshot: RoomSnapshot = {
      roomName: 'Conversation',
      roomDescription: null,
      roomIcon: null,
      roomAvatarUrl: null,
      roomSubtitle: '2 members',
      messages: [],
      threads: [],
      isEncrypted: false,
      roomMeta: {},
    };
    const refresh = jest.fn(() => Promise.resolve());
    const refreshTangentTopics = jest.fn(() => Promise.resolve());
    const reconcileOptimisticTimeline = jest.fn(
      (
        _messages: RoomSnapshot['messages'],
        currentMessages: OptimisticTimelineMessage[]
      ) => currentMessages
    );
    const reconcileOptimisticReactionChanges = jest.fn(
      (
        _messages: RoomSnapshot['messages'],
        currentChanges: OptimisticReactionChange[]
      ) => currentChanges
    );
    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: null,
      user: null,
      roomId: room.roomId,
      isReady: false,
      isPendingRoom: false,
      currentRoom: room as never,
      snapshot,
      refresh,
      refreshTangentTopics,
      canInteractWithTimeline: false,
      tangentRelationship: null,
      tangentSpaceId: null,
      draft: '',
      contentRef: { current: null },
      composerRef: { current: null },
      scrollToLatest: jest.fn(),
      outgoingTypingRef: { current: false },
      lastTypingSentAtRef: { current: 0 },
      typingRateLimitUntilRef: { current: 0 },
      typingIdleTimeoutRef: { current: null },
      lastReadReceiptEventIdRef: { current: null },
      setOptimisticMessages: jest.fn(),
      setOptimisticReactionChanges: jest.fn(),
      reconcileOptimisticTimeline,
      reconcileOptimisticReactionChanges,
      navigate: jest.fn(),
    };

    renderHook(() => useRoomRealtime(params));

    refresh.mockClear();

    await act(async () => {
      room.emit(ThreadEvent.NewReply, { id: '$thread-root' }, { getId: () => '$thread-reply' });
      await Promise.resolve();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
