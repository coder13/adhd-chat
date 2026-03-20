import {
  ClientEvent,
  RoomEvent,
  RoomMemberEvent,
  ThreadEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  type Room as MatrixRoom,
} from 'matrix-js-sdk';
import { useEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { RoomSnapshot } from '../../lib/matrix/roomSnapshot';
import { getAllSnapshotMessages } from '../../lib/matrix/roomSnapshot';
import {
  patchRoomSnapshotMetadata,
  patchRoomSnapshotFromTimeline,
  patchRoomSnapshotReadReceipts,
  patchRoomSnapshotWithThreadEvent,
  patchRoomSnapshotWithTimelineEvent,
} from '../../lib/matrix/roomSnapshotPatch';
import {
  patchTandemSpaceRoomCatalogEntry,
  replaceTandemSpaceRoomCatalog,
} from '../../lib/matrix/catalogPatches';
import {
  isTypingRateLimited,
  sendTypingState,
  type TypingRateLimitRef,
} from '../../lib/matrix/typingState';
import {
  clearPendingTandemRoom,
  getPendingTandemRoom,
  subscribeToPendingTandemRooms,
  type PendingTandemRoomRecord,
} from '../../lib/matrix/pendingTandemRoom';
import { getTandemSpaceIdForRoom } from '../../lib/matrix/tandem';
import {
  getTypingMemberNames,
  TYPING_IDLE_TIMEOUT_MS,
  TYPING_RENEWAL_INTERVAL_MS,
  TYPING_SERVER_TIMEOUT_MS,
} from '../../lib/matrix/typingIndicators';
import { ensureTandemSpaceLinks } from '../../lib/matrix/tandem';
import { useMatrixRoomEvents } from '../../hooks/useMatrixRoomEvents';
import { useThrottledRefresh } from '../../hooks/useThrottledRefresh';
import type { MatrixClientContextValue } from '../../hooks/useMatrixClient/context';
import type { OptimisticReactionChange, OptimisticTimelineMessage } from '../../lib/matrix/optimisticTimeline';
import { prefersDesktopComposerShortcuts } from '../../lib/chat/composerBehavior';
import type { TandemSpaceRoomSummary } from '../../lib/matrix/spaceCatalog';
import {
  incrementMatrixPerfCounter,
  startMatrixPerfTimer,
} from '../../lib/matrix/performanceMetrics';

const ROOM_LOAD_TIMEOUT_MS = 15000;
const ROOM_METADATA_TIMELINE_EVENT_TYPES = new Set([
  'm.room.topic',
  'm.room.encryption',
  'm.space.parent',
  'com.tandem.identity',
  'com.tandem.room',
]);

interface UseRoomRealtimeParams {
  client: MatrixClient | null;
  user: MatrixClientContextValue['user'];
  roomId: string | null;
  isReady: boolean;
  isPendingRoom: boolean;
  currentRoom: Room | null;
  snapshot: RoomSnapshot;
  refresh: () => Promise<unknown>;
  updateSnapshot: (
    updater: RoomSnapshot | ((currentValue: RoomSnapshot) => RoomSnapshot)
  ) => RoomSnapshot;
  updateTangentTopics: (
    updater:
      | TandemSpaceRoomSummary[]
      | ((
          currentValue: TandemSpaceRoomSummary[]
        ) => TandemSpaceRoomSummary[])
  ) => TandemSpaceRoomSummary[];
  canInteractWithTimeline: boolean;
  tangentRelationship: { sharedSpaceId: string; partnerUserId: string } | null;
  tangentSpaceId: string | null;
  draft: string;
  contentRef: RefObject<HTMLIonContentElement | null>;
  composerRef: RefObject<HTMLIonTextareaElement | null>;
  scrollToLatest: (duration?: number) => void;
  outgoingTypingRef: RefObject<boolean>;
  lastTypingSentAtRef: RefObject<number>;
  typingRateLimitUntilRef: TypingRateLimitRef;
  typingIdleTimeoutRef: RefObject<number | null>;
  lastReadReceiptEventIdRef: RefObject<string | null>;
  setOptimisticMessages: Dispatch<SetStateAction<OptimisticTimelineMessage[]>>;
  setOptimisticReactionChanges: Dispatch<SetStateAction<OptimisticReactionChange[]>>;
  reconcileOptimisticTimeline: (
    messages: RoomSnapshot['messages'],
    optimisticMessages: OptimisticTimelineMessage[]
  ) => OptimisticTimelineMessage[];
  reconcileOptimisticReactionChanges: (
    messages: RoomSnapshot['messages'],
    currentChanges: OptimisticReactionChange[]
  ) => OptimisticReactionChange[];
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

export function useRoomRealtime({
  client,
  user,
  roomId,
  isReady,
  isPendingRoom,
  currentRoom,
  snapshot,
  refresh,
  updateSnapshot,
  updateTangentTopics,
  canInteractWithTimeline,
  tangentRelationship,
  tangentSpaceId,
  draft,
  contentRef,
  composerRef,
  scrollToLatest,
  outgoingTypingRef,
  lastTypingSentAtRef,
  typingRateLimitUntilRef,
  typingIdleTimeoutRef,
  lastReadReceiptEventIdRef,
  setOptimisticMessages,
  setOptimisticReactionChanges,
  reconcileOptimisticTimeline,
  reconcileOptimisticReactionChanges,
  navigate,
}: UseRoomRealtimeParams) {
  const [typingMemberNames, setTypingMemberNames] = useState<string[]>([]);
  const [pendingRoom, setPendingRoom] = useState<PendingTandemRoomRecord | null>(() =>
    getPendingTandemRoom(roomId)
  );
  const baselineViewportHeightRef = useRef<number | null>(null);
  const keyboardOpenRef = useRef(false);
  const lastReceiptEventRef = useRef<MatrixEvent | null>(null);
  const fullTimelinePatchReasonRef = useRef<string>('manual');
  const patchRoomTimeline = useThrottledRefresh(
    async () => {
      if (!client || !user || !roomId) {
        return;
      }

      const room = client.getRoom(roomId);
      if (!room) {
        return;
      }

      const timer = startMatrixPerfTimer('matrix.room.realtime.full_timeline_patch', {
        roomId,
        reason: fullTimelinePatchReasonRef.current,
      });
      updateSnapshot((currentValue) =>
        patchRoomSnapshotFromTimeline(currentValue, client, room, user.userId)
      );
      timer.end();
    },
    { intervalMs: 400 }
  );
  const patchRoomReceipts = useThrottledRefresh(
    async () => {
      if (!client || !user || !roomId) {
        return;
      }

      const room = client.getRoom(roomId);
      if (!room) {
        return;
      }

      updateSnapshot((currentValue) =>
        patchRoomSnapshotReadReceipts(
          currentValue,
          room,
          user.userId,
          lastReceiptEventRef.current
        )
      );
    },
    { intervalMs: 200 }
  );
  const patchRoomMetadata = useThrottledRefresh(
    async () => {
      if (!client || !user || !roomId) {
        return;
      }

      const room = client.getRoom(roomId);
      if (!room) {
        return;
      }

      updateSnapshot((currentValue) =>
        patchRoomSnapshotMetadata(currentValue, client, room, user.userId)
      );
    },
    { intervalMs: 200 }
  );

  useEffect(() => {
    if (isPendingRoom || !client || !user || !roomId) {
      return;
    }

    let roomLoadTimeoutId: number | null = null;

    const resolveMissingRoom = () => {
      void refresh();
    };

    const queueMissingRoomTimeout = () => {
      if (roomLoadTimeoutId !== null) {
        window.clearTimeout(roomLoadTimeoutId);
      }
      roomLoadTimeoutId = window.setTimeout(resolveMissingRoom, ROOM_LOAD_TIMEOUT_MS);
    };

    const updateRoomState = async () => {
      const room = client.getRoom(roomId);
      if (!room) {
        queueMissingRoomTimeout();
        return;
      }

      try {
        if (roomLoadTimeoutId !== null) {
          window.clearTimeout(roomLoadTimeoutId);
          roomLoadTimeoutId = null;
        }
        await refresh();
      } catch (cause) {
        console.error(cause);
      } finally {
        // Timeline refreshes should not force the user to the bottom.
      }
    };

    const handleSync = () => {
      // Sync fires continuously during normal client operation. Only use it to
      // recover if the room is still missing locally after navigation/startup.
      if (client.getRoom(roomId)) {
        return;
      }

      void updateRoomState();
    };

    void updateRoomState();

    const handleTimeline = (
      event: MatrixEvent,
      eventRoom: MatrixRoom | undefined,
      _toStartOfTimeline: boolean | undefined,
      _removed: boolean,
      data: { liveEvent?: boolean }
    ) => {
      if (!data.liveEvent || eventRoom?.roomId !== roomId) {
        return;
      }
      let patchedIncrementally = false;
      updateSnapshot((currentValue) => {
        const patchedSnapshot = patchRoomSnapshotWithTimelineEvent(
          currentValue,
          client,
          eventRoom,
          user.userId,
          event
        );
        if (!patchedSnapshot) {
          return currentValue;
        }

        patchedIncrementally = true;
        return patchedSnapshot;
      });

      if (!patchedIncrementally) {
        const eventType =
          typeof event.getType === 'function' ? event.getType() : undefined;
        fullTimelinePatchReasonRef.current = 'timeline_fallback';
        incrementMatrixPerfCounter(
          'matrix.room.realtime.full_timeline_patch_requested',
          {
            roomId,
            reason: 'timeline_fallback',
            eventType,
          }
        );
        patchRoomTimeline();
      }

      if (
        event.getStateKey() !== undefined &&
        ROOM_METADATA_TIMELINE_EVENT_TYPES.has(event.getType())
      ) {
        patchRoomMetadata();
      }
    };

    const handleRoomAccountData = (_event: MatrixEvent, eventRoom: MatrixRoom) => {
      if (eventRoom.roomId === roomId) {
        patchRoomMetadata();
      }
    };

    const handleReceipt = (event: MatrixEvent, eventRoom: MatrixRoom) => {
      if (eventRoom.roomId === roomId) {
        lastReceiptEventRef.current = event;
        patchRoomReceipts();
      }
    };

    const handleLocalEchoUpdated = (
      event: MatrixEvent,
      eventRoom: MatrixRoom
    ) => {
      if (eventRoom.roomId === roomId) {
        const eventType =
          typeof event.getType === 'function' ? event.getType() : undefined;
        let patchedIncrementally = false;
        updateSnapshot((currentValue) => {
          const patchedSnapshot = patchRoomSnapshotWithTimelineEvent(
            currentValue,
            client,
            eventRoom,
            user.userId,
            event
          );
          if (!patchedSnapshot) {
            return currentValue;
          }

          patchedIncrementally = true;
          return patchedSnapshot;
        });

        if (!patchedIncrementally) {
          fullTimelinePatchReasonRef.current = 'local_echo_fallback';
          incrementMatrixPerfCounter(
            'matrix.room.realtime.full_timeline_patch_requested',
            {
              roomId,
              reason: 'local_echo_fallback',
              eventType,
            }
          );
          patchRoomTimeline();
        }
      }
    };

    const handleRoomName = (eventRoom: MatrixRoom) => {
      if (eventRoom.roomId === roomId || eventRoom.roomId === tangentSpaceId) {
        patchRoomMetadata();
      }
    };

    const handleRoomMembership = (eventRoom: MatrixRoom) => {
      if (eventRoom.roomId === roomId) {
        patchRoomMetadata();
      }
    };

    const handleTimelineReset = (eventRoom: MatrixRoom | undefined) => {
      if (eventRoom?.roomId === roomId) {
        fullTimelinePatchReasonRef.current = 'timeline_reset';
        incrementMatrixPerfCounter(
          'matrix.room.realtime.full_timeline_patch_requested',
          {
            roomId,
            reason: 'timeline_reset',
          }
        );
        patchRoomTimeline();
      }
    };

    client.on(ClientEvent.Sync, handleSync);
    client.on(RoomEvent.Timeline, handleTimeline);
    client.on(RoomEvent.LocalEchoUpdated, handleLocalEchoUpdated);
    client.on(RoomEvent.Receipt, handleReceipt);
    client.on(RoomEvent.Name, handleRoomName);
    client.on(RoomEvent.MyMembership, handleRoomMembership);
    client.on(RoomEvent.AccountData, handleRoomAccountData);
    client.on(RoomEvent.TimelineReset, handleTimelineReset);

    return () => {
      if (roomLoadTimeoutId !== null) {
        window.clearTimeout(roomLoadTimeoutId);
      }
      client.off(ClientEvent.Sync, handleSync);
      client.off(RoomEvent.Timeline, handleTimeline);
      client.off(RoomEvent.LocalEchoUpdated, handleLocalEchoUpdated);
      client.off(RoomEvent.Receipt, handleReceipt);
      client.off(RoomEvent.Name, handleRoomName);
      client.off(RoomEvent.MyMembership, handleRoomMembership);
      client.off(RoomEvent.AccountData, handleRoomAccountData);
      client.off(RoomEvent.TimelineReset, handleTimelineReset);
    };
  }, [
    client,
    contentRef,
    isPendingRoom,
    patchRoomMetadata,
    patchRoomReceipts,
    patchRoomTimeline,
    refresh,
    roomId,
    tangentSpaceId,
    updateSnapshot,
    user,
  ]);

  useEffect(() => {
    setOptimisticMessages((currentMessages) =>
      reconcileOptimisticTimeline(getAllSnapshotMessages(snapshot), currentMessages)
    );
  }, [reconcileOptimisticTimeline, setOptimisticMessages, snapshot]);

  useEffect(() => {
    setOptimisticReactionChanges((currentChanges) =>
      reconcileOptimisticReactionChanges(
        getAllSnapshotMessages(snapshot),
        currentChanges
      )
    );
  }, [reconcileOptimisticReactionChanges, setOptimisticReactionChanges, snapshot]);

  useEffect(() => {
    if (!roomId || !isPendingRoom) {
      setPendingRoom(null);
      return;
    }

    const syncPendingRoom = () => {
      setPendingRoom(getPendingTandemRoom(roomId));
    };

    syncPendingRoom();
    return subscribeToPendingTandemRooms(syncPendingRoom);
  }, [isPendingRoom, roomId]);

  useEffect(() => {
    if (isPendingRoom || !currentRoom || !roomId) {
      return;
    }

    const patchThreadSnapshot = (
      thread: { id: string },
      options?: { remove?: boolean }
    ) => {
      updateSnapshot((currentValue) =>
        patchRoomSnapshotWithThreadEvent(
          currentValue,
          client!,
          currentRoom,
          user!.userId,
          thread,
          options
        )
      );
    };

    const handleThreadNew = (thread: { id: string }) => {
      patchThreadSnapshot(thread);
    };

    const handleThreadUpdate = (thread: { id: string }) => {
      patchThreadSnapshot(thread);
    };

    const handleThreadNewReply = (thread: { id: string }) => {
      patchThreadSnapshot(thread);
    };

    const handleThreadDelete = (thread: { id: string }) => {
      patchThreadSnapshot(thread, { remove: true });
    };

    currentRoom.on(ThreadEvent.New, handleThreadNew);
    currentRoom.on(ThreadEvent.Update, handleThreadUpdate);
    currentRoom.on(ThreadEvent.NewReply, handleThreadNewReply);
    currentRoom.on(ThreadEvent.Delete, handleThreadDelete);

    return () => {
      currentRoom.off(ThreadEvent.New, handleThreadNew);
      currentRoom.off(ThreadEvent.Update, handleThreadUpdate);
      currentRoom.off(ThreadEvent.NewReply, handleThreadNewReply);
      currentRoom.off(ThreadEvent.Delete, handleThreadDelete);
    };
  }, [client, currentRoom, isPendingRoom, roomId, updateSnapshot, user]);

  useEffect(() => {
    if (!isPendingRoom || !pendingRoom?.roomId) {
      return;
    }

    if (!client?.getRoom(pendingRoom.roomId)) {
      return;
    }

    clearPendingTandemRoom(pendingRoom.pendingRoomId);
    navigate(`/room/${encodeURIComponent(pendingRoom.roomId)}`, { replace: true });
  }, [client, isPendingRoom, navigate, pendingRoom]);

  useEffect(() => {
    if (isPendingRoom || !client || !user || !tangentRelationship || !roomId) {
      return;
    }

    void ensureTandemSpaceLinks({
      client,
      spaceId: tangentRelationship.sharedSpaceId,
      roomIds: [roomId],
      userIds: [user.userId, tangentRelationship.partnerUserId],
    }).catch((cause) => {
      console.error('Failed to repair Tandem room links', cause);
    });
  }, [client, isPendingRoom, roomId, tangentRelationship, user]);

  useMatrixRoomEvents({
    client,
    enabled: Boolean(client && user && isReady && tangentSpaceId),
    onRoomChange: (changedRoom) => {
      if (!client || !user || !tangentSpaceId) {
        return;
      }

      if (changedRoom.roomId === tangentSpaceId) {
        updateTangentTopics(
          replaceTandemSpaceRoomCatalog(client, user.userId, tangentSpaceId)
        );
        return;
      }

      const changedRoomSpaceId = getTandemSpaceIdForRoom(client, changedRoom);
      if (changedRoomSpaceId !== tangentSpaceId) {
        return;
      }

      updateTangentTopics((currentValue) =>
        patchTandemSpaceRoomCatalogEntry(
          currentValue,
          client,
          user.userId,
          tangentSpaceId,
          changedRoom.roomId
        )
      );
    },
  });

  useEffect(() => {
    if (isPendingRoom || !currentRoom || !user) {
      setTypingMemberNames([]);
      return;
    }

    if (!client || !roomId) {
      return;
    }

    const updateTypingMembers = () => {
      setTypingMemberNames(getTypingMemberNames(currentRoom.getMembers(), user.userId));
    };

    const handleTypingChange = (_event: MatrixEvent, member: { roomId: string }) => {
      if (member.roomId !== roomId) {
        return;
      }
      updateTypingMembers();
    };

    const handleMemberNameChange = (
      _event: MatrixEvent,
      member: { roomId: string; typing?: boolean }
    ) => {
      if (member.roomId !== roomId || !member.typing) {
        return;
      }
      updateTypingMembers();
    };

    updateTypingMembers();
    client.on(RoomMemberEvent.Typing, handleTypingChange);
    client.on(RoomMemberEvent.Name, handleMemberNameChange);

    return () => {
      client.off(RoomMemberEvent.Typing, handleTypingChange);
      client.off(RoomMemberEvent.Name, handleMemberNameChange);
    };
  }, [client, currentRoom, isPendingRoom, roomId, user]);

  useEffect(() => {
    const activeClient = client;
    const activeRoomId = roomId;

    if (typingIdleTimeoutRef.current !== null) {
      window.clearTimeout(typingIdleTimeoutRef.current);
      typingIdleTimeoutRef.current = null;
    }

    if (
      !activeClient ||
      !activeRoomId ||
      !canInteractWithTimeline ||
      isPendingRoom ||
      draft.length === 0
    ) {
      if (!outgoingTypingRef.current) {
        return;
      }

      outgoingTypingRef.current = false;
      lastTypingSentAtRef.current = 0;
      if (!activeClient || !activeRoomId) {
        return;
      }
      void sendTypingState({
        client: activeClient,
        roomId: activeRoomId,
        isTyping: false,
        timeoutMs: TYPING_SERVER_TIMEOUT_MS,
        typingRateLimitUntilRef,
        onError: (cause: unknown) => {
          console.error('Failed to clear typing state', cause);
        },
      });
      return;
    }

    const now = Date.now();
    if (isTypingRateLimited(typingRateLimitUntilRef, now)) {
      return;
    }

    if (
      !outgoingTypingRef.current ||
      now - lastTypingSentAtRef.current >= TYPING_RENEWAL_INTERVAL_MS
    ) {
      outgoingTypingRef.current = true;
      lastTypingSentAtRef.current = now;
      void sendTypingState({
        client: activeClient,
        roomId: activeRoomId,
        isTyping: true,
        timeoutMs: TYPING_SERVER_TIMEOUT_MS,
        typingRateLimitUntilRef,
        onError: (cause: unknown) => {
          console.error('Failed to send typing state', cause);
        },
      });
    }

    typingIdleTimeoutRef.current = window.setTimeout(() => {
      if (!outgoingTypingRef.current) {
        return;
      }

      outgoingTypingRef.current = false;
      lastTypingSentAtRef.current = 0;
      void sendTypingState({
        client: activeClient,
        roomId: activeRoomId,
        isTyping: false,
        timeoutMs: TYPING_SERVER_TIMEOUT_MS,
        typingRateLimitUntilRef,
        onError: (cause: unknown) => {
          console.error('Failed to clear typing state', cause);
        },
      });
    }, TYPING_IDLE_TIMEOUT_MS);

    return () => {
      if (typingIdleTimeoutRef.current !== null) {
        window.clearTimeout(typingIdleTimeoutRef.current);
        typingIdleTimeoutRef.current = null;
      }
    };
  }, [
    canInteractWithTimeline,
    client,
    draft,
    isPendingRoom,
    outgoingTypingRef,
    lastTypingSentAtRef,
    roomId,
    typingRateLimitUntilRef,
    typingIdleTimeoutRef,
  ]);

  useEffect(() => {
    if (!client || !currentRoom || !user || isPendingRoom || !canInteractWithTimeline) {
      return;
    }

    const sendLatestReadReceipt = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      const latestIncomingMessage = [...(snapshot.messages ?? [])]
        .reverse()
        .find((message) => !message.isOwn);
      const latestIncomingEvent = latestIncomingMessage
        ? currentRoom.findEventById(latestIncomingMessage.id)
        : null;

      if (!latestIncomingEvent) {
        return;
      }

      const latestIncomingEventId = latestIncomingEvent.getId();
      if (
        !latestIncomingEventId ||
        lastReadReceiptEventIdRef.current === latestIncomingEventId
      ) {
        return;
      }

      void client.sendReadReceipt(latestIncomingEvent).then(() => {
        lastReadReceiptEventIdRef.current = latestIncomingEventId;
      }).catch((cause: unknown) => {
        console.error('Failed to send read receipt', cause);
      });
    };

    sendLatestReadReceipt();
    window.addEventListener('focus', sendLatestReadReceipt);
    document.addEventListener('visibilitychange', sendLatestReadReceipt);

    return () => {
      window.removeEventListener('focus', sendLatestReadReceipt);
      document.removeEventListener('visibilitychange', sendLatestReadReceipt);
    };
  }, [
    canInteractWithTimeline,
    client,
    currentRoom,
    isPendingRoom,
    lastReadReceiptEventIdRef,
    snapshot.messages,
    user,
  ]);

  useEffect(() => {
    if (!roomId || isPendingRoom || !canInteractWithTimeline) {
      return;
    }

    if (!prefersDesktopComposerShortcuts()) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      void composerRef.current?.setFocus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [canInteractWithTimeline, composerRef, isPendingRoom, roomId]);

  useEffect(() => {
    if (typeof window === 'undefined' || prefersDesktopComposerShortcuts()) {
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const updateKeyboardViewport = () => {
      const viewportHeight = viewport.height;
      const previousBaseline = baselineViewportHeightRef.current;

      if (previousBaseline === null || viewportHeight > previousBaseline) {
        baselineViewportHeightRef.current = viewportHeight;
      }

      const baselineHeight =
        Math.max(baselineViewportHeightRef.current ?? viewportHeight, viewportHeight);
      const keyboardInset = baselineHeight - viewportHeight;
      const keyboardOpen = keyboardInset > 120;

      if (keyboardOpen && !keyboardOpenRef.current) {
        keyboardOpenRef.current = true;
        window.requestAnimationFrame(() => {
          scrollToLatest();
        });
        window.setTimeout(() => {
          scrollToLatest();
        }, 180);
        return;
      }

      if (!keyboardOpen && keyboardOpenRef.current) {
        keyboardOpenRef.current = false;
        composerRef.current?.blur();
      }
    };

    updateKeyboardViewport();
    viewport.addEventListener('resize', updateKeyboardViewport);

    return () => {
      viewport.removeEventListener('resize', updateKeyboardViewport);
    };
  }, [composerRef, contentRef, scrollToLatest]);

  return { pendingRoom, typingMemberNames };
}
