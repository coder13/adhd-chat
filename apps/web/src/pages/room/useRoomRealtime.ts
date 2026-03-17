import {
  ClientEvent,
  RoomEvent,
  RoomMemberEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  type Room as MatrixRoom,
} from 'matrix-js-sdk';
import { useEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { RoomSnapshot } from '../../lib/matrix/roomSnapshot';
import {
  clearPendingTandemRoom,
  getPendingTandemRoom,
  subscribeToPendingTandemRooms,
  type PendingTandemRoomRecord,
} from '../../lib/matrix/pendingTandemRoom';
import { getRoomTimelineEvents, isTimelineMessageEvent } from '../../lib/matrix/timelineEvents';
import {
  getTypingMemberNames,
  TYPING_IDLE_TIMEOUT_MS,
  TYPING_RENEWAL_INTERVAL_MS,
  TYPING_SERVER_TIMEOUT_MS,
} from '../../lib/matrix/typingIndicators';
import { ensureTandemSpaceLinks } from '../../lib/matrix/tandem';
import type { MatrixClientContextValue } from '../../hooks/useMatrixClient/context';
import type { OptimisticReactionChange, OptimisticTimelineMessage } from '../../lib/matrix/optimisticTimeline';
import { prefersDesktopComposerShortcuts } from '../../lib/chat/composerBehavior';

const ROOM_LOAD_TIMEOUT_MS = 15000;

interface UseRoomRealtimeParams {
  client: MatrixClient | null;
  user: MatrixClientContextValue['user'];
  roomId: string | null;
  isReady: boolean;
  isPendingRoom: boolean;
  currentRoom: Room | null;
  snapshot: RoomSnapshot;
  refresh: () => Promise<unknown>;
  refreshTangentTopics: () => Promise<unknown>;
  canInteractWithTimeline: boolean;
  tangentRelationship: { sharedSpaceId: string; partnerUserId: string } | null;
  tangentSpaceId: string | null;
  draft: string;
  contentRef: RefObject<HTMLIonContentElement | null>;
  composerRef: RefObject<HTMLIonTextareaElement | null>;
  scrollToLatest: (duration?: number) => void;
  outgoingTypingRef: RefObject<boolean>;
  lastTypingSentAtRef: RefObject<number>;
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
  refreshTangentTopics,
  canInteractWithTimeline,
  tangentRelationship,
  tangentSpaceId,
  draft,
  contentRef,
  composerRef,
  scrollToLatest,
  outgoingTypingRef,
  lastTypingSentAtRef,
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

    void updateRoomState();

    const handleTimeline = (
      _event: MatrixEvent,
      eventRoom: MatrixRoom | undefined,
      _toStartOfTimeline: boolean | undefined,
      _removed: boolean,
      data: { liveEvent?: boolean }
    ) => {
      if (!data.liveEvent || eventRoom?.roomId !== roomId) {
        return;
      }
      void updateRoomState();
    };

    const handleRoomAccountData = (_event: MatrixEvent, eventRoom: MatrixRoom) => {
      if (eventRoom.roomId === roomId) {
        void updateRoomState();
      }
    };

    const handleReceipt = (_event: MatrixEvent, eventRoom: MatrixRoom) => {
      if (eventRoom.roomId === roomId) {
        void updateRoomState();
      }
    };

    client.on(ClientEvent.Sync, updateRoomState);
    client.on(RoomEvent.Timeline, handleTimeline);
    client.on(RoomEvent.Receipt, handleReceipt);
    client.on(RoomEvent.Name, updateRoomState);
    client.on(RoomEvent.MyMembership, updateRoomState);
    client.on(RoomEvent.AccountData, handleRoomAccountData);
    client.on(RoomEvent.TimelineReset, updateRoomState);

    return () => {
      if (roomLoadTimeoutId !== null) {
        window.clearTimeout(roomLoadTimeoutId);
      }
      client.off(ClientEvent.Sync, updateRoomState);
      client.off(RoomEvent.Timeline, handleTimeline);
      client.off(RoomEvent.Receipt, handleReceipt);
      client.off(RoomEvent.Name, updateRoomState);
      client.off(RoomEvent.MyMembership, updateRoomState);
      client.off(RoomEvent.AccountData, handleRoomAccountData);
      client.off(RoomEvent.TimelineReset, updateRoomState);
    };
  }, [client, contentRef, isPendingRoom, refresh, roomId, user]);

  useEffect(() => {
    setOptimisticMessages((currentMessages) =>
      reconcileOptimisticTimeline(snapshot.messages, currentMessages)
    );
  }, [reconcileOptimisticTimeline, setOptimisticMessages, snapshot.messages]);

  useEffect(() => {
    setOptimisticReactionChanges((currentChanges) =>
      reconcileOptimisticReactionChanges(snapshot.messages, currentChanges)
    );
  }, [reconcileOptimisticReactionChanges, setOptimisticReactionChanges, snapshot.messages]);

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

  useEffect(() => {
    if (!client || !user || !isReady || !tangentSpaceId) {
      return;
    }

    client.on(ClientEvent.Sync, refreshTangentTopics);
    return () => {
      client.off(ClientEvent.Sync, refreshTangentTopics);
    };
  }, [client, isReady, refreshTangentTopics, tangentSpaceId, user]);

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
      void activeClient.sendTyping(activeRoomId, false, TYPING_SERVER_TIMEOUT_MS).catch((cause: unknown) => {
        console.error('Failed to clear typing state', cause);
      });
      return;
    }

    const now = Date.now();
    if (
      !outgoingTypingRef.current ||
      now - lastTypingSentAtRef.current >= TYPING_RENEWAL_INTERVAL_MS
    ) {
      outgoingTypingRef.current = true;
      lastTypingSentAtRef.current = now;
      void activeClient.sendTyping(activeRoomId, true, TYPING_SERVER_TIMEOUT_MS).catch((cause: unknown) => {
        console.error('Failed to send typing state', cause);
      });
    }

    typingIdleTimeoutRef.current = window.setTimeout(() => {
      if (!outgoingTypingRef.current) {
        return;
      }

      outgoingTypingRef.current = false;
      lastTypingSentAtRef.current = 0;
      void activeClient.sendTyping(activeRoomId, false, TYPING_SERVER_TIMEOUT_MS).catch((cause: unknown) => {
        console.error('Failed to clear typing state', cause);
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

      const latestIncomingEvent = [...getRoomTimelineEvents(currentRoom)]
        .reverse()
        .find(
          (event) =>
            isTimelineMessageEvent(event) &&
            Boolean(event.getId()) &&
            event.getSender() !== user.userId
        );

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
