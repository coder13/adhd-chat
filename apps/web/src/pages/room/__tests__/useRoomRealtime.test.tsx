/// <reference types="jest" />

import { act, renderHook } from '@testing-library/react';
import { RoomEvent, ThreadEvent } from 'matrix-js-sdk';
import type { SetStateAction } from 'react';
import type { RoomSnapshot } from '../../../lib/matrix/roomSnapshot';
import type {
  OptimisticReactionChange,
  OptimisticTimelineMessage,
} from '../../../lib/matrix/optimisticTimeline';
import { useRoomRealtime } from '../useRoomRealtime';

const roomSnapshotPatchModule: {
  patchRoomSnapshotFromTimeline: jest.Mock;
  patchRoomSnapshotReadReceipts: jest.Mock;
  patchRoomSnapshotWithThreadEvent: jest.Mock;
  patchRoomSnapshotWithTimelineEvent: jest.Mock;
} = jest.requireMock('../../../lib/matrix/roomSnapshotPatch');
const performanceMetricsModule: {
  incrementMatrixPerfCounter: jest.Mock;
  startMatrixPerfTimer: jest.Mock;
} = jest.requireMock('../../../lib/matrix/performanceMetrics');

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

jest.mock('../../../lib/matrix/roomSnapshotPatch', () => ({
  patchRoomSnapshotMetadata: jest.fn((snapshot: RoomSnapshot) => snapshot),
  patchRoomSnapshotFromTimeline: jest.fn((snapshot: RoomSnapshot) => snapshot),
  patchRoomSnapshotReadReceipts: jest.fn((snapshot: RoomSnapshot) => snapshot),
  patchRoomSnapshotWithThreadEvent: jest.fn((snapshot: RoomSnapshot) => snapshot),
  patchRoomSnapshotWithTimelineEvent: jest.fn(() => null),
}));

jest.mock('../../../lib/matrix/performanceMetrics', () => ({
  incrementMatrixPerfCounter: jest.fn(),
  startMatrixPerfTimer: jest.fn(() => ({
    end: jest.fn(),
  })),
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
  getMembers = jest.fn(() => []);

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
  beforeEach(() => {
    performanceMetricsModule.incrementMatrixPerfCounter.mockClear();
    performanceMetricsModule.startMatrixPerfTimer.mockClear();
  });

  it('passes threaded snapshot replies into optimistic reconciliation', () => {
    const snapshot = createSnapshot();
    const refresh = jest.fn(() => Promise.resolve());
    const updateSnapshot = jest.fn();
    const updateTangentTopics = jest.fn();
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
    const setOptimisticMessages = jest.fn<
      void,
      [SetStateAction<OptimisticTimelineMessage[]>]
    >();
    const setOptimisticReactionChanges = jest.fn<
      void,
      [SetStateAction<OptimisticReactionChange[]>]
    >();
    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: null,
      user: null,
      roomId: null,
      isReady: false,
      isPendingRoom: false,
      currentRoom: null,
      snapshot,
      refresh,
      updateSnapshot: updateSnapshot as never,
      updateTangentTopics: updateTangentTopics as never,
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

    const [optimisticTimelineUpdater] = setOptimisticMessages.mock.calls[0] ?? [];
    const [optimisticReactionUpdater] =
      setOptimisticReactionChanges.mock.calls[0] ?? [];

    if (
      typeof optimisticTimelineUpdater !== 'function' ||
      typeof optimisticReactionUpdater !== 'function'
    ) {
      throw new Error('Expected optimistic state updaters to be registered');
    }

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

  it('patches room metadata when the active room emits a name change', async () => {
    const client = new MockClient();
    const user = { userId: '@me:example.com' };
    const snapshot = createSnapshot();
    const refresh = jest.fn(() => Promise.resolve());
    const updateSnapshot = jest.fn((updater: (currentValue: RoomSnapshot) => RoomSnapshot) =>
      updater(snapshot)
    );
    const updateTangentTopics = jest.fn();
    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: client as never,
      user: user as never,
      roomId: client.room.roomId,
      isReady: false,
      isPendingRoom: false,
      currentRoom: null,
      snapshot,
      refresh,
      updateSnapshot: updateSnapshot as never,
      updateTangentTopics: updateTangentTopics as never,
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
      reconcileOptimisticTimeline: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentMessages: OptimisticTimelineMessage[]
        ) => currentMessages
      ),
      reconcileOptimisticReactionChanges: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentChanges: OptimisticReactionChange[]
        ) => currentChanges
      ),
      navigate: jest.fn(),
    };

    renderHook(() => useRoomRealtime(params));

    await act(async () => {
      await Promise.resolve();
    });

    refresh.mockClear();
    updateSnapshot.mockClear();

    await act(async () => {
      client.emit(RoomEvent.Name, client.room);
      await Promise.resolve();
    });

    expect(refresh).not.toHaveBeenCalled();
    expect(updateSnapshot).toHaveBeenCalledTimes(1);
  });

  it('patches room metadata for live state events in the timeline', async () => {
    const client = new MockClient();
    const user = { userId: '@me:example.com' };
    const snapshot = createSnapshot();
    const refresh = jest.fn(() => Promise.resolve());
    const updateSnapshot = jest.fn(
      (updater: (currentValue: RoomSnapshot) => RoomSnapshot) => updater(snapshot)
    );
    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: client as never,
      user: user as never,
      roomId: client.room.roomId,
      isReady: false,
      isPendingRoom: false,
      currentRoom: null,
      snapshot,
      refresh,
      updateSnapshot: updateSnapshot as never,
      updateTangentTopics: jest.fn() as never,
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
      reconcileOptimisticTimeline: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentMessages: OptimisticTimelineMessage[]
        ) => currentMessages
      ),
      reconcileOptimisticReactionChanges: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentChanges: OptimisticReactionChange[]
        ) => currentChanges
      ),
      navigate: jest.fn(),
    };

    renderHook(() => useRoomRealtime(params));

    refresh.mockClear();
    updateSnapshot.mockClear();

    await act(async () => {
      client.emit(
        RoomEvent.Timeline,
        {
          getStateKey: () => '',
          getType: () => 'm.room.topic',
        },
        client.room,
        false,
        false,
        { liveEvent: true }
      );
      await Promise.resolve();
    });

    expect(refresh).not.toHaveBeenCalled();
    expect(updateSnapshot).toHaveBeenCalledTimes(3);
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
    const updateSnapshot = jest.fn((updater: (currentValue: RoomSnapshot) => RoomSnapshot) =>
      updater(snapshot)
    );
    const updateTangentTopics = jest.fn();
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
      updateSnapshot: updateSnapshot as never,
      updateTangentTopics: updateTangentTopics as never,
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

    expect(refresh).not.toHaveBeenCalled();
    expect(updateSnapshot).toHaveBeenCalledTimes(2);
  });

  it('uses incremental timeline patching for a simple live message event', async () => {
    const client = new MockClient();
    const user = { userId: '@me:example.com' };
    const snapshot = createSnapshot();
    const refresh = jest.fn(() => Promise.resolve());
    const updateSnapshot = jest.fn(
      (updater: (currentValue: RoomSnapshot) => RoomSnapshot) => updater(snapshot)
    );
    roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent.mockClear();
    roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent.mockReturnValueOnce({
      ...snapshot,
      messages: [
        ...snapshot.messages,
        {
          id: '$next',
          senderId: '@alex:example.com',
          senderName: 'Alex',
          body: 'Next message',
          timestamp: 3,
          isOwn: false,
          msgtype: 'm.text',
          threadRootId: null,
          isThreadRoot: false,
        },
      ],
    });
    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: client as never,
      user: user as never,
      roomId: client.room.roomId,
      isReady: false,
      isPendingRoom: false,
      currentRoom: null,
      snapshot,
      refresh,
      updateSnapshot: updateSnapshot as never,
      updateTangentTopics: jest.fn() as never,
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
      reconcileOptimisticTimeline: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentMessages: OptimisticTimelineMessage[]
        ) => currentMessages
      ),
      reconcileOptimisticReactionChanges: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentChanges: OptimisticReactionChange[]
        ) => currentChanges
      ),
      navigate: jest.fn(),
    };

    renderHook(() => useRoomRealtime(params));

    roomSnapshotPatchModule.patchRoomSnapshotFromTimeline.mockClear();

    await act(async () => {
      client.emit(
        RoomEvent.Timeline,
        {
          getStateKey: () => undefined,
          getType: () => 'm.room.message',
        },
        client.room,
        false,
        false,
        { liveEvent: true }
      );
      await Promise.resolve();
    });

    expect(roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent).toHaveBeenCalled();
    expect(roomSnapshotPatchModule.patchRoomSnapshotFromTimeline).not.toHaveBeenCalled();
  });

  it('counts a full timeline rebuild when live timeline patching falls back', async () => {
    const client = new MockClient();
    const user = { userId: '@me:example.com' };
    const snapshot = createSnapshot();
    const refresh = jest.fn(() => Promise.resolve());
    const updateSnapshot = jest.fn(
      (updater: (currentValue: RoomSnapshot) => RoomSnapshot) => updater(snapshot)
    );
    roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent.mockClear();
    roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent.mockReturnValue(null);
    roomSnapshotPatchModule.patchRoomSnapshotFromTimeline.mockClear();

    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: client as never,
      user: user as never,
      roomId: client.room.roomId,
      isReady: false,
      isPendingRoom: false,
      currentRoom: null,
      snapshot,
      refresh,
      updateSnapshot: updateSnapshot as never,
      updateTangentTopics: jest.fn() as never,
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
      reconcileOptimisticTimeline: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentMessages: OptimisticTimelineMessage[]
        ) => currentMessages
      ),
      reconcileOptimisticReactionChanges: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentChanges: OptimisticReactionChange[]
        ) => currentChanges
      ),
      navigate: jest.fn(),
    };

    renderHook(() => useRoomRealtime(params));

    await act(async () => {
      client.emit(
        RoomEvent.Timeline,
        {
          getStateKey: () => undefined,
          getType: () => 'm.room.message',
        },
        client.room,
        false,
        false,
        { liveEvent: true }
      );
      await Promise.resolve();
    });

    expect(performanceMetricsModule.incrementMatrixPerfCounter).toHaveBeenCalledWith(
      'matrix.room.realtime.full_timeline_patch_requested',
      expect.objectContaining({
        roomId: client.room.roomId,
        reason: 'timeline_fallback',
        eventType: 'm.room.message',
      })
    );
    expect(performanceMetricsModule.startMatrixPerfTimer).toHaveBeenCalledWith(
      'matrix.room.realtime.full_timeline_patch',
      expect.objectContaining({
        roomId: client.room.roomId,
        reason: 'timeline_fallback',
      })
    );
    expect(roomSnapshotPatchModule.patchRoomSnapshotFromTimeline).toHaveBeenCalled();
  });

  it('uses incremental timeline patching for an edited live message event', async () => {
    const client = new MockClient();
    const user = { userId: '@me:example.com' };
    const snapshot = createSnapshot();
    const refresh = jest.fn(() => Promise.resolve());
    const updateSnapshot = jest.fn(
      (updater: (currentValue: RoomSnapshot) => RoomSnapshot) => updater(snapshot)
    );
    roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent.mockClear();
    roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent.mockReturnValueOnce({
      ...snapshot,
      messages: snapshot.messages.map((message) =>
        message.id === '$thread-root'
          ? {
              ...message,
              body: 'Edited root',
              isEdited: true,
            }
          : message
      ),
    });
    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: client as never,
      user: user as never,
      roomId: client.room.roomId,
      isReady: false,
      isPendingRoom: false,
      currentRoom: null,
      snapshot,
      refresh,
      updateSnapshot: updateSnapshot as never,
      updateTangentTopics: jest.fn() as never,
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
      reconcileOptimisticTimeline: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentMessages: OptimisticTimelineMessage[]
        ) => currentMessages
      ),
      reconcileOptimisticReactionChanges: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentChanges: OptimisticReactionChange[]
        ) => currentChanges
      ),
      navigate: jest.fn(),
    };

    renderHook(() => useRoomRealtime(params));

    roomSnapshotPatchModule.patchRoomSnapshotFromTimeline.mockClear();

    await act(async () => {
      client.emit(
        RoomEvent.Timeline,
        {
          getRelation: () => ({
            rel_type: 'm.replace',
            event_id: '$thread-root',
          }),
          getStateKey: () => undefined,
          getType: () => 'm.room.message',
        },
        client.room,
        false,
        false,
        { liveEvent: true }
      );
      await Promise.resolve();
    });

    expect(roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent).toHaveBeenCalled();
    expect(roomSnapshotPatchModule.patchRoomSnapshotFromTimeline).not.toHaveBeenCalled();
  });

  it('uses incremental timeline patching for a live reaction event', async () => {
    const client = new MockClient();
    const user = { userId: '@me:example.com' };
    const snapshot = createSnapshot();
    const refresh = jest.fn(() => Promise.resolve());
    const updateSnapshot = jest.fn(
      (updater: (currentValue: RoomSnapshot) => RoomSnapshot) => updater(snapshot)
    );
    roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent.mockClear();
    roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent.mockReturnValueOnce({
      ...snapshot,
      messages: snapshot.messages.map((message) =>
        message.id === '$thread-root'
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
    });
    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: client as never,
      user: user as never,
      roomId: client.room.roomId,
      isReady: false,
      isPendingRoom: false,
      currentRoom: null,
      snapshot,
      refresh,
      updateSnapshot: updateSnapshot as never,
      updateTangentTopics: jest.fn() as never,
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
      reconcileOptimisticTimeline: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentMessages: OptimisticTimelineMessage[]
        ) => currentMessages
      ),
      reconcileOptimisticReactionChanges: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentChanges: OptimisticReactionChange[]
        ) => currentChanges
      ),
      navigate: jest.fn(),
    };

    renderHook(() => useRoomRealtime(params));

    roomSnapshotPatchModule.patchRoomSnapshotFromTimeline.mockClear();

    await act(async () => {
      client.emit(
        RoomEvent.Timeline,
        {
          getRelation: () => ({
            rel_type: 'm.annotation',
            event_id: '$thread-root',
            key: '❤️',
          }),
          getStateKey: () => undefined,
          getType: () => 'm.reaction',
        },
        client.room,
        false,
        false,
        { liveEvent: true }
      );
      await Promise.resolve();
    });

    expect(roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent).toHaveBeenCalled();
    expect(roomSnapshotPatchModule.patchRoomSnapshotFromTimeline).not.toHaveBeenCalled();
  });

  it('uses incremental timeline patching for a live redaction event', async () => {
    const client = new MockClient();
    const user = { userId: '@me:example.com' };
    const snapshot = createSnapshot();
    const refresh = jest.fn(() => Promise.resolve());
    const updateSnapshot = jest.fn(
      (updater: (currentValue: RoomSnapshot) => RoomSnapshot) => updater(snapshot)
    );
    roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent.mockClear();
    roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent.mockReturnValueOnce({
      ...snapshot,
      messages: snapshot.messages.map((message) =>
        message.id === '$thread-root'
          ? {
              ...message,
              body: 'Message deleted',
              isDeleted: true,
            }
          : message
      ),
    });
    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: client as never,
      user: user as never,
      roomId: client.room.roomId,
      isReady: false,
      isPendingRoom: false,
      currentRoom: null,
      snapshot,
      refresh,
      updateSnapshot: updateSnapshot as never,
      updateTangentTopics: jest.fn() as never,
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
      reconcileOptimisticTimeline: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentMessages: OptimisticTimelineMessage[]
        ) => currentMessages
      ),
      reconcileOptimisticReactionChanges: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentChanges: OptimisticReactionChange[]
        ) => currentChanges
      ),
      navigate: jest.fn(),
    };

    renderHook(() => useRoomRealtime(params));

    roomSnapshotPatchModule.patchRoomSnapshotFromTimeline.mockClear();

    await act(async () => {
      client.emit(
        RoomEvent.Timeline,
        {
          getAssociatedId: () => '$thread-root',
          getStateKey: () => undefined,
          getType: () => 'm.room.redaction',
          isRedaction: () => true,
        },
        client.room,
        false,
        false,
        { liveEvent: true }
      );
      await Promise.resolve();
    });

    expect(roomSnapshotPatchModule.patchRoomSnapshotWithTimelineEvent).toHaveBeenCalled();
    expect(roomSnapshotPatchModule.patchRoomSnapshotFromTimeline).not.toHaveBeenCalled();
  });

  it('patches the snapshot when the active room emits a receipt', async () => {
    const client = new MockClient();
    const user = { userId: '@me:example.com' };
    const snapshot = createSnapshot();
    const refresh = jest.fn(() => Promise.resolve());
    const updateSnapshot = jest.fn((updater: (currentValue: RoomSnapshot) => RoomSnapshot) =>
      updater(snapshot)
    );
    const updateTangentTopics = jest.fn();
    const params: Parameters<typeof useRoomRealtime>[0] = {
      client: client as never,
      user: user as never,
      roomId: client.room.roomId,
      isReady: false,
      isPendingRoom: false,
      currentRoom: null,
      snapshot,
      refresh,
      updateSnapshot: updateSnapshot as never,
      updateTangentTopics: updateTangentTopics as never,
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
      reconcileOptimisticTimeline: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentMessages: OptimisticTimelineMessage[]
        ) => currentMessages
      ),
      reconcileOptimisticReactionChanges: jest.fn(
        (
          _messages: RoomSnapshot['messages'],
          currentChanges: OptimisticReactionChange[]
        ) => currentChanges
      ),
      navigate: jest.fn(),
    };

    renderHook(() => useRoomRealtime(params));

    refresh.mockClear();
    roomSnapshotPatchModule.patchRoomSnapshotReadReceipts.mockClear();
    const receiptEvent = {
      getContent: () => ({
        '$thread-root': {
          'm.read': {
            '@alex:example.com': {
              thread_id: '$thread-root',
            },
          },
        },
      }),
    };

    await act(async () => {
      client.emit(RoomEvent.Receipt, receiptEvent, { roomId: client.room.roomId });
      await Promise.resolve();
    });

    expect(refresh).not.toHaveBeenCalled();
    expect(updateSnapshot).toHaveBeenCalledTimes(1);
    expect(roomSnapshotPatchModule.patchRoomSnapshotReadReceipts).toHaveBeenCalledWith(
      snapshot,
      client.room,
      user.userId,
      receiptEvent
    );
  });

  it('patches the snapshot when the active room emits thread updates', async () => {
    const client = new MockClient();
    const user = { userId: '@me:example.com' };
    const room = new MockRoom();
    client.getRoom = jest.fn((roomId: string) =>
      roomId === room.roomId ? (room as never) : null
    );
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
    const updateSnapshot = jest.fn((updater: (currentValue: RoomSnapshot) => RoomSnapshot) =>
      updater(snapshot)
    );
    const updateTangentTopics = jest.fn();
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
      client: client as never,
      user: user as never,
      roomId: room.roomId,
      isReady: false,
      isPendingRoom: false,
      currentRoom: room as never,
      snapshot,
      refresh,
      updateSnapshot: updateSnapshot as never,
      updateTangentTopics: updateTangentTopics as never,
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
    roomSnapshotPatchModule.patchRoomSnapshotFromTimeline.mockClear();
    roomSnapshotPatchModule.patchRoomSnapshotWithThreadEvent.mockClear();

    await act(async () => {
      room.emit(ThreadEvent.NewReply, { id: '$thread-root' }, { getId: () => '$thread-reply' });
      await Promise.resolve();
    });

    expect(refresh).not.toHaveBeenCalled();
    expect(updateSnapshot).toHaveBeenCalledTimes(1);
    expect(roomSnapshotPatchModule.patchRoomSnapshotWithThreadEvent).toHaveBeenCalledWith(
      snapshot,
      client,
      room,
      user.userId,
      { id: '$thread-root' },
      undefined
    );
    expect(roomSnapshotPatchModule.patchRoomSnapshotFromTimeline).not.toHaveBeenCalled();
  });
});
