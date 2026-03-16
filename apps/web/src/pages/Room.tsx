import {
  IonActionSheet,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonPage,
  IonTextarea,
  IonToolbar,
} from '@ionic/react';
import {
  attachOutline,
  arrowBack,
  ellipsisHorizontal,
  gitBranchOutline,
  lockClosedOutline,
  send,
  star,
  starOutline,
} from 'ionicons/icons';
import {
  ClientEvent,
  MsgType,
  RoomEvent,
  RoomMemberEvent,
  type MatrixEvent,
  type Room as MatrixRoom,
} from 'matrix-js-sdk';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useChatPreferences } from '../hooks/useChatPreferences';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';
import {
  AppAvatar,
  Button,
  IdentityEditorModal,
  Modal,
  TangentModal,
} from '../components';
import { MessageBubble } from '../components/chat';
import { shouldSubmitComposerOnEnter } from '../components/chat/composerBehavior';
import { createId } from '../lib/id';
import { updateRoomIdentity } from '../lib/matrix/identity';
import { buildMatrixMediaPayload } from '../lib/matrix/media';
import {
  buildRoomSnapshot,
  type RoomSnapshot,
} from '../lib/matrix/roomSnapshot';
import {
  createOptimisticAttachmentMessage,
  createOptimisticTextMessage,
  mergeTimelineMessages,
  reconcileOptimisticTimeline,
  resolveOwnSenderName,
  type OptimisticTimelineMessage,
} from '../lib/matrix/optimisticTimeline';
import {
  clearPendingTandemRoom,
  getPendingTandemRoom,
  isPendingTandemRoomId,
  startPendingTandemRoomCreation,
  subscribeToPendingTandemRooms,
  type PendingTandemRoomRecord,
} from '../lib/matrix/pendingTandemRoom';
import {
  findLatestOwnReadReceipt,
} from '../lib/matrix/readReceipts';
import {
  formatTypingIndicator,
  getTypingMemberNames,
  TYPING_IDLE_TIMEOUT_MS,
  TYPING_RENEWAL_INTERVAL_MS,
  TYPING_SERVER_TIMEOUT_MS,
} from '../lib/matrix/typingIndicators';
import {
  buildTandemSpaceRoomCatalog,
  type TandemSpaceRoomSummary,
} from '../lib/matrix/spaceCatalog';
import {
  ensureTandemSpaceLinks,
  getTandemSpaceIdForRoom,
  getTandemMembershipPolicy,
  joinTandemRoom,
  leaveTandemRoom,
  updateTandemRoomMeta,
  type TandemRoomMeta,
} from '../lib/matrix/tandem';
import { useTandem } from '../hooks/useTandem';

const ROOM_LOAD_TIMEOUT_MS = 15000;

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

function buildPendingRoomMessages(pendingRoom: PendingTandemRoomRecord) {
  const messages = [
    {
      id: `${pendingRoom.pendingRoomId}:start`,
      senderId: 'Tandem',
      senderName: 'Tandem',
      body: `Creating "${pendingRoom.roomName}" in your Tandem hub.`,
      timestamp: pendingRoom.createdAt,
      isOwn: false,
      msgtype: MsgType.Notice,
    },
    {
      id: `${pendingRoom.pendingRoomId}:invite`,
      senderId: 'Tandem',
      senderName: 'Tandem',
      body: `Inviting ${pendingRoom.partnerUserId} and linking the topic to the hub.`,
      timestamp: pendingRoom.createdAt + 1,
      isOwn: false,
      msgtype: MsgType.Notice,
    },
  ];

  if (pendingRoom.status === 'failed' && pendingRoom.error) {
    messages.push({
      id: `${pendingRoom.pendingRoomId}:error`,
      senderId: 'Tandem',
      senderName: 'Tandem',
      body: pendingRoom.error,
      timestamp: pendingRoom.createdAt + 2,
      isOwn: false,
      msgtype: MsgType.Notice,
    });
  }

  if (pendingRoom.status === 'ready') {
    messages.push({
      id: `${pendingRoom.pendingRoomId}:ready`,
      senderId: 'Tandem',
      senderName: 'Tandem',
      body: 'Topic created. Opening it now.',
      timestamp: pendingRoom.createdAt + 2,
      isOwn: false,
      msgtype: MsgType.Notice,
    });
  }

  return messages;
}

function RoomPage() {
  const { roomId: encodedRoomId } = useParams<{ roomId: string }>();
  const roomId = encodedRoomId ? decodeURIComponent(encodedRoomId) : null;
  const isPendingRoom = Boolean(roomId && isPendingTandemRoomId(roomId));
  const navigate = useNavigate();
  const { client, isReady, user } = useMatrixClient();
  const { preferences } = useChatPreferences(client, user?.userId);
  const { relationships } = useTandem(client, user?.userId);
  const cacheKey =
    !isPendingRoom && user?.userId && roomId
      ? `room:${user.userId}:${roomId}`
      : null;
  const {
    data: snapshot,
    error,
    isLoading: loading,
    refresh,
  } = usePersistedResource<RoomSnapshot>({
    cacheKey,
    enabled: Boolean(client && user && roomId && !isPendingRoom),
    initialValue: {
      roomName: 'Conversation',
      roomDescription: null,
      roomSubtitle: 'Connecting...',
      messages: [],
      isEncrypted: false,
      roomMeta: {},
    },
    load: async () => {
      const room = client?.getRoom(roomId ?? undefined);
      if (!room || !client || !user) {
        throw new Error('Conversation not found');
      }

      return buildRoomSnapshot(client, room, user.userId);
    },
  });
  const [draft, setDraft] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [enablingEncryption, setEnablingEncryption] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTangentModal, setShowTangentModal] = useState(false);
  const [creatingTangent, setCreatingTangent] = useState(false);
  const [tangentError, setTangentError] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<
    OptimisticTimelineMessage[]
  >([]);
  const [typingMemberNames, setTypingMemberNames] = useState<string[]>([]);
  const [pendingRoom, setPendingRoom] =
    useState<PendingTandemRoomRecord | null>(() =>
      getPendingTandemRoom(roomId)
    );
  const contentRef = useRef<HTMLIonContentElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const outgoingTypingRef = useRef(false);
  const lastTypingSentAtRef = useRef(0);
  const typingIdleTimeoutRef = useRef<number | null>(null);
  const lastReadReceiptEventIdRef = useRef<string | null>(null);
  const currentRoom = client?.getRoom(roomId ?? undefined) ?? null;
  const roomMembership = currentRoom?.getMyMembership() ?? 'join';
  const membershipPolicy =
    !isPendingRoom && client && currentRoom
      ? getTandemMembershipPolicy(client, currentRoom)
      : null;
  const canInteractWithTimeline =
    isPendingRoom || !membershipPolicy || roomMembership === 'join';
  const tangentSpaceId = isPendingRoom
    ? (pendingRoom?.sharedSpaceId ?? null)
    : client
      ? getTandemSpaceIdForRoom(client, currentRoom)
      : null;
  const tangentRelationship =
    relationships.find((entry) => entry.sharedSpaceId === tangentSpaceId) ??
    null;
  const { data: tangentTopics, refresh: refreshTangentTopics } =
    usePersistedResource<TandemSpaceRoomSummary[]>({
      cacheKey:
        user?.userId && tangentSpaceId
          ? `space-rooms:${user.userId}:${tangentSpaceId}`
          : null,
      enabled: Boolean(client && user && isReady && tangentSpaceId),
      initialValue: [],
      load: async () =>
        buildTandemSpaceRoomCatalog(client!, user!.userId, tangentSpaceId!),
    });

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
      roomLoadTimeoutId = window.setTimeout(
        resolveMissingRoom,
        ROOM_LOAD_TIMEOUT_MS
      );
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
        requestAnimationFrame(() => {
          void contentRef.current?.scrollToBottom(250);
        });
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

    const handleRoomAccountData = (
      _event: MatrixEvent,
      eventRoom: MatrixRoom
    ) => {
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
    };
  }, [client, isPendingRoom, refresh, roomId, user]);

  useEffect(() => {
    requestAnimationFrame(() => {
      void contentRef.current?.scrollToBottom(250);
    });
  }, [optimisticMessages, pendingRoom?.status, isPendingRoom, snapshot.messages]);

  useEffect(() => {
    setOptimisticMessages((currentMessages) =>
      reconcileOptimisticTimeline(snapshot.messages, currentMessages)
    );
  }, [snapshot.messages]);

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

    clearPendingTandemRoom(pendingRoom.pendingRoomId);
    navigate(`/room/${encodeURIComponent(pendingRoom.roomId)}`, {
      replace: true,
    });
  }, [isPendingRoom, navigate, pendingRoom]);

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
      setTypingMemberNames(
        getTypingMemberNames(currentRoom.getMembers(), user.userId)
      );
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
      void activeClient
        .sendTyping(activeRoomId, false, TYPING_SERVER_TIMEOUT_MS)
        .catch((cause) => {
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
      void activeClient
        .sendTyping(activeRoomId, true, TYPING_SERVER_TIMEOUT_MS)
        .catch((cause) => {
          console.error('Failed to send typing state', cause);
        });
    }

    typingIdleTimeoutRef.current = window.setTimeout(() => {
      if (!outgoingTypingRef.current) {
        return;
      }

      outgoingTypingRef.current = false;
      lastTypingSentAtRef.current = 0;
      void activeClient
        .sendTyping(activeRoomId, false, TYPING_SERVER_TIMEOUT_MS)
        .catch((cause) => {
          console.error('Failed to clear typing state', cause);
        });
    }, TYPING_IDLE_TIMEOUT_MS);

    return () => {
      if (typingIdleTimeoutRef.current !== null) {
        window.clearTimeout(typingIdleTimeoutRef.current);
        typingIdleTimeoutRef.current = null;
      }
    };
  }, [canInteractWithTimeline, client, draft, isPendingRoom, roomId]);

  useEffect(() => {
    if (!client || !currentRoom || !user || isPendingRoom || !canInteractWithTimeline) {
      return;
    }

    const sendLatestReadReceipt = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      const latestIncomingEvent = [...currentRoom.getLiveTimeline().getEvents()]
        .reverse()
        .find(
          (event) =>
            event.getType() === 'm.room.message' &&
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
      }).catch((cause) => {
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
    roomId,
    snapshot.messages,
    user,
  ]);

  if (!roomId) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <div className="flex min-h-screen items-center justify-center text-text">
            No conversation selected.
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!client || !isReady || !user) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <div className="flex min-h-screen items-center justify-center px-6 text-center">
            <p className="text-text">
              Please{' '}
              <Link to="/login" className="text-accent">
                log in
              </Link>{' '}
              to view this chat.
            </p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const clearOwnTypingState = () => {
    if (typingIdleTimeoutRef.current !== null) {
      window.clearTimeout(typingIdleTimeoutRef.current);
      typingIdleTimeoutRef.current = null;
    }

    if (!outgoingTypingRef.current) {
      return;
    }

    outgoingTypingRef.current = false;
    lastTypingSentAtRef.current = 0;
    void client
      .sendTyping(roomId, false, TYPING_SERVER_TIMEOUT_MS)
      .catch((cause) => {
        console.error('Failed to clear typing state', cause);
      });
  };

  const handleEnableEncryption = async () => {
    setEnablingEncryption(true);
    setActionError(null);

    try {
      await (
        client.sendStateEvent as (
          nextRoomId: string,
          eventType: string,
          content: Record<string, unknown>,
          stateKey: string
        ) => Promise<unknown>
      )(roomId, 'm.room.encryption', { algorithm: 'm.megolm.v1.aes-sha2' }, '');
      await refresh();
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setEnablingEncryption(false);
    }
  };

  const sendTextMessage = async ({
    body,
    optimisticMessageId,
  }: {
    body: string;
    optimisticMessageId?: string;
  }) => {
    if (isPendingRoom || !canInteractWithTimeline) {
      return;
    }

    if (!body) {
      return;
    }

    const transactionId = createId('txn');
    const senderName = resolveOwnSenderName(client, roomId, user.userId);
    const nextOptimisticMessage =
      optimisticMessageId === undefined
        ? createOptimisticTextMessage({
            body,
            senderId: user.userId,
            senderName,
            transactionId,
          })
        : null;

    if (nextOptimisticMessage) {
      setOptimisticMessages((currentMessages) => [
        ...currentMessages,
        nextOptimisticMessage,
      ]);
    } else {
      setOptimisticMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === optimisticMessageId
            ? {
                ...message,
                deliveryStatus: 'sending',
                errorText: null,
                transactionId,
              }
            : message
        )
      );
    }

    try {
      const response = (await (
        client.sendEvent as (
          nextRoomId: string,
          eventType: string,
          content: Record<string, unknown>,
          txnId?: string
        ) => Promise<unknown>
      )(
        roomId,
        'm.room.message',
        { msgtype: MsgType.Text, body },
        transactionId
      )) as { event_id?: string } | string | undefined;

      const remoteEventId =
        typeof response === 'string'
          ? response
          : response && typeof response === 'object' && 'event_id' in response
            ? response.event_id ?? null
            : null;

      setOptimisticMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.transactionId === transactionId
            ? {
                ...message,
                remoteEventId,
              }
            : message
        )
      );
      requestAnimationFrame(() => {
        void contentRef.current?.scrollToBottom(250);
      });
      void refresh();
    } catch (cause) {
      console.error(cause);
      const errorText = cause instanceof Error ? cause.message : String(cause);
      setOptimisticMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.transactionId === transactionId
            ? {
                ...message,
                deliveryStatus: 'failed',
                errorText,
              }
            : message
        )
      );
    }
  };

  const handleSendMessage = async () => {
    const body = draft.trim();
    if (!body) {
      return;
    }

    clearOwnTypingState();
    setDraft('');
    await sendTextMessage({ body });
  };

  const handleAttachmentSelection = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !client || !roomId || isPendingRoom) {
      return;
    }

    const transactionId = createId('txn');
    const senderName = resolveOwnSenderName(client, roomId, user.userId);
    const optimisticAttachmentMessage = createOptimisticAttachmentMessage({
      file,
      senderId: user.userId,
      senderName,
      transactionId,
    });

    setOptimisticMessages((currentMessages) => [
      ...currentMessages,
      optimisticAttachmentMessage,
    ]);
    setUploadingAttachment(true);
    setActionError(null);

    try {
      const content = await buildMatrixMediaPayload(client, file);
      const response = (await (
        client.sendEvent as (
          nextRoomId: string,
          eventType: string,
          content: Record<string, unknown>,
          txnId?: string
        ) => Promise<unknown>
      )(roomId, 'm.room.message', content, transactionId)) as
        | { event_id?: string }
        | string
        | undefined;
      const remoteEventId =
        typeof response === 'string'
          ? response
          : response && typeof response === 'object' && 'event_id' in response
            ? response.event_id ?? null
            : null;
      setOptimisticMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.transactionId === transactionId
            ? {
                ...message,
                remoteEventId,
              }
            : message
        )
      );
      requestAnimationFrame(() => {
        void contentRef.current?.scrollToBottom(250);
      });
      void refresh();
    } catch (cause) {
      console.error(cause);
      const errorText = cause instanceof Error ? cause.message : String(cause);
      setActionError(errorText);
      setOptimisticMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.transactionId === transactionId
            ? {
                ...message,
                deliveryStatus: 'failed',
                errorText,
              }
            : message
        )
      );
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleComposerKeyDown = (
    event: KeyboardEvent<HTMLIonTextareaElement>
  ) => {
    if (
      !shouldSubmitComposerOnEnter({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
      })
    ) {
      return;
    }

    event.preventDefault();
    if (!draft.trim()) {
      return;
    }

    void handleSendMessage();
  };

  const handleRetryMessage = (messageId: string) => {
    const failedMessage = optimisticMessages.find(
      (message) => message.id === messageId && message.deliveryStatus === 'failed'
    );
    if (!failedMessage) {
      return;
    }

    if (failedMessage.retryFile) {
      const transactionId = createId('txn');
      const retryFile = failedMessage.retryFile;
      setOptimisticMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                deliveryStatus: 'sending',
                errorText: null,
                transactionId,
              }
            : message
        )
      );
      setUploadingAttachment(true);
      setActionError(null);
      void (async () => {
        try {
          const content = await buildMatrixMediaPayload(client, retryFile);
          const response = (await (
            client.sendEvent as (
              nextRoomId: string,
              eventType: string,
              content: Record<string, unknown>,
              txnId?: string
            ) => Promise<unknown>
          )(roomId, 'm.room.message', content, transactionId)) as
            | { event_id?: string }
            | string
            | undefined;
          const remoteEventId =
            typeof response === 'string'
              ? response
              : response &&
                  typeof response === 'object' &&
                  'event_id' in response
                ? response.event_id ?? null
                : null;
          setOptimisticMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    transactionId,
                    remoteEventId,
                  }
                : message
            )
          );
          void refresh();
        } catch (cause) {
          console.error(cause);
          const errorText =
            cause instanceof Error ? cause.message : String(cause);
          setActionError(errorText);
          setOptimisticMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    transactionId,
                    deliveryStatus: 'failed',
                    errorText,
                  }
                : message
            )
          );
        } finally {
          setUploadingAttachment(false);
        }
      })();
      return;
    }

    void sendTextMessage({
      body: failedMessage.body,
      optimisticMessageId: failedMessage.id,
    });
  };

  const handleUpdateRoomMeta = async (metaUpdate: Partial<TandemRoomMeta>) => {
    try {
      await updateTandemRoomMeta(client, roomId, metaUpdate);
      await refresh();
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleSaveTopicIdentity = async (values: {
    name: string;
    description: string;
  }) => {
    if (!client || !currentRoom) {
      return;
    }

    setSavingIdentity(true);
    setActionError(null);

    try {
      await updateRoomIdentity(client, currentRoom, {
        name: values.name,
        topic: values.description,
      });
      setShowIdentityModal(false);
      await refresh();
      await refreshTangentTopics();
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleCreateTangent = async (name: string) => {
    if (!client || !user || !tangentRelationship) {
      setTangentError('This topic is not inside a Tandem hub.');
      return;
    }

    setTangentError(null);
    setCreatingTangent(true);
    const nextPendingRoom = startPendingTandemRoomCreation({
      client,
      relationship: tangentRelationship,
      creatorUserId: user.userId,
      name,
      category: roomMeta.category ?? 'Tandem',
    });
    setShowTangentModal(false);
    setCreatingTangent(false);
    navigate(`/room/${encodeURIComponent(nextPendingRoom.pendingRoomId)}`);
  };

  const handleSelectTopic = async (topicId: string) => {
    const topic = tangentTopics.find((entry) => entry.id === topicId);
    if (!topic || !client) {
      return;
    }

    setTangentError(null);
    setShowTangentModal(false);

    if (topic.membership !== 'join') {
      try {
        await joinTandemRoom(client, client.getRoom(topic.id));
        await refreshTangentTopics();
      } catch (cause) {
        console.error(cause);
        setTangentError(cause instanceof Error ? cause.message : String(cause));
        setShowTangentModal(true);
        return;
      }
    }

    navigate(`/room/${encodeURIComponent(topic.id)}`);
  };

  const pendingSnapshot = pendingRoom
    ? {
        roomName: pendingRoom.roomName,
        roomDescription: pendingRoom.topic ?? null,
        roomSubtitle:
          pendingRoom.status === 'failed'
            ? 'Topic setup ran into a problem'
            : 'Setting up your new topic...',
        messages: buildPendingRoomMessages(pendingRoom),
        isEncrypted: false,
        roomMeta: {
          category: pendingRoom.category ?? 'Tandem',
        } as TandemRoomMeta,
      }
    : null;
  const activeSnapshot = pendingSnapshot ?? snapshot;
  const { roomName, roomDescription, roomSubtitle, messages, isEncrypted, roomMeta } =
    activeSnapshot;
  const reconciledOptimisticMessages = reconcileOptimisticTimeline(
    messages,
    optimisticMessages
  );
  const visibleMessages = mergeTimelineMessages(
    messages,
    reconciledOptimisticMessages
  );
  const visibleError =
    pendingRoom?.status === 'failed'
      ? (pendingRoom.error ?? actionError)
      : (actionError ?? error);
  const typingIndicator = formatTypingIndicator(typingMemberNames);
  const latestOwnReadReceipt = findLatestOwnReadReceipt(visibleMessages);
  const readReceiptMessageId = latestOwnReadReceipt?.messageId ?? null;
  const readReceiptNames = latestOwnReadReceipt?.readerNames ?? [];
  const handleBackNavigation = () => {
    if (tangentSpaceId) {
      navigate(`/tandem/space/${encodeURIComponent(tangentSpaceId)}`);
      return;
    }

    navigate(-1);
  };

  const handleJoinCurrentRoom = async () => {
    if (!client || !currentRoom) {
      return;
    }

    setActionError(null);

    try {
      await joinTandemRoom(client, currentRoom);
      await refresh();
      await refreshTangentTopics();
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleLeaveCurrentRoom = async () => {
    if (!client || !currentRoom) {
      return;
    }

    setActionError(null);

    try {
      await leaveTandemRoom(client, currentRoom);
      await refreshTangentTopics();
      if (tangentSpaceId) {
        navigate(`/tandem/space/${encodeURIComponent(tangentSpaceId)}`, {
          replace: true,
        });
        return;
      }

      navigate('/other', { replace: true });
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const conversationMenuButtons = [
    ...(!isEncrypted
      ? [
          {
            text: enablingEncryption
              ? 'Enabling encryption...'
              : 'Enable encryption',
            icon: lockClosedOutline,
            cssClass: 'app-action-primary',
            handler: () => {
              void handleEnableEncryption();
            },
          },
        ]
      : []),
    ...(!roomMeta.category
      ? [
          {
            text: 'Set category',
            handler: () => {
              const nextCategory = window.prompt(
                'Category label for this topic',
                roomMeta.category ?? ''
              );
              if (nextCategory === null) {
                return;
              }
              void handleUpdateRoomMeta({
                category: nextCategory.trim() || undefined,
              });
            },
          },
        ]
      : []),
    ...(!isPendingRoom
      ? [
          {
            text: 'Edit topic details',
            handler: () => {
              setShowIdentityModal(true);
            },
          },
        ]
      : []),
    ...(membershipPolicy?.supportsLeave && roomMembership === 'join'
      ? [
          {
            text: 'Leave topic',
            cssClass: 'app-action-danger',
            handler: () => {
              setShowLeaveConfirm(true);
            },
          },
        ]
      : []),
    {
      text: roomMeta.archived ? 'Unarchive topic' : 'Archive topic',
      cssClass: 'app-action-danger',
      handler: () => {
        if (roomMeta.archived) {
          void handleUpdateRoomMeta({ archived: false });
          return;
        }

        setShowArchiveConfirm(true);
      },
    },
    {
      text: 'Cancel',
      role: 'cancel' as const,
    },
  ];

  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar">
          <IonButtons slot="start">
            <IonButton fill="clear" onClick={handleBackNavigation}>
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <div className="flex items-center gap-3 px-2">
            <AppAvatar
              name={roomName}
              className="h-10 w-10"
              textClassName="text-sm"
            />
            {isPendingRoom ? (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-text">
                  {roomName}
                </div>
                <div className="truncate text-xs text-text-muted">
                  {typingIndicator ?? roomDescription ?? roomSubtitle}
                  {isEncrypted ? ' • encrypted' : ''}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setShowIdentityModal(true)}
                aria-label="Edit topic details"
              >
                <div className="truncate text-[15px] font-semibold text-text">
                  {roomName}
                </div>
                <div className="truncate text-xs text-text-muted">
                  {typingIndicator ?? roomDescription ?? roomSubtitle}
                  {isEncrypted ? ' • encrypted' : ''}
                </div>
              </button>
            )}
          </div>
          <IonButtons slot="end">
            {!isPendingRoom && (
              <IonButton
                fill="clear"
                color={roomMeta.pinned ? 'primary' : 'medium'}
                onClick={() => {
                  void handleUpdateRoomMeta({ pinned: !roomMeta.pinned });
                }}
                aria-label={roomMeta.pinned ? 'Unpin topic' : 'Pin topic'}
              >
                <IonIcon
                  slot="icon-only"
                  icon={roomMeta.pinned ? star : starOutline}
                />
              </IonButton>
            )}
            {tangentSpaceId && !isPendingRoom && (
              <IonButton
                fill="clear"
                color="primary"
                onClick={() => setShowTangentModal(true)}
                aria-label="Start a tangent"
              >
                <IonIcon slot="icon-only" icon={gitBranchOutline} />
              </IonButton>
            )}
            <IonButton
              fill="clear"
              color="medium"
              onClick={() => setShowMenu(true)}
              disabled={isPendingRoom}
            >
              <IonIcon slot="icon-only" icon={ellipsisHorizontal} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef} fullscreen className="app-chat-page">
        <div className="px-4 pb-4 pt-6">
          {isPendingRoom ? (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="app-chat-bubble other">
                  <div className="mb-1 text-[11px] font-medium text-text-subtle">
                    {message.senderId}
                  </div>
                  <div>{message.body}</div>
                  <div className="mt-2 text-right text-[11px] text-text-subtle">
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className="py-12 text-center text-sm text-text-muted">
              Loading messages...
            </div>
          ) : visibleError && messages.length === 0 ? (
            <div className="py-6 text-center text-sm text-danger">
              {visibleError}
            </div>
          ) : membershipPolicy && roomMembership !== 'join' ? (
            <div className="space-y-4">
              <div className="rounded-[28px] border border-line bg-panel/95 px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                {membershipPolicy.supportsJoin ? (
                  <Button onClick={() => void handleJoinCurrentRoom()}>
                    {roomMembership === 'invite' ? 'Join topic' : 'Rejoin topic'}
                  </Button>
                ) : (
                  <div className="text-sm text-text-muted">Unavailable</div>
                )}
              </div>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-base font-medium text-text">No messages yet</p>
              <p className="mt-2 text-sm text-text-muted">
                Start the topic below.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleError && (
                <div className="py-2 text-center text-sm text-danger">
                  {visibleError}
                </div>
              )}
              {visibleMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  accessToken={client.getAccessToken()}
                  viewMode={preferences.chatViewMode}
                  onRetry={handleRetryMessage}
                  receiptNames={
                    message.id === readReceiptMessageId ? readReceiptNames : null
                  }
                />
              ))}
            </div>
          )}
        </div>
      </IonContent>

      <IonFooter className="ion-no-border">
        <div className="app-composer gap-2 px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2 sm:gap-3 sm:px-4">
          {!isPendingRoom && (
            <>
              <input
                ref={attachmentInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt,.zip,.csv,.json,.md"
                className="hidden"
                onChange={handleAttachmentSelection}
              />
              <IonButton
                shape="round"
                fill="clear"
                color="medium"
                onClick={() => attachmentInputRef.current?.click()}
                className="h-12 w-12 shrink-0 rounded-full bg-elevated text-text shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)]"
                disabled={
                  !canInteractWithTimeline || uploadingAttachment
                }
              >
                <IonIcon slot="icon-only" icon={attachOutline} />
              </IonButton>
            </>
          )}
          <IonTextarea
            value={draft}
            onIonInput={(event) => setDraft(event.detail.value ?? '')}
            onKeyDown={handleComposerKeyDown}
            autoGrow
            rows={1}
            placeholder={
              isPendingRoom
                ? 'Start typing while the topic finishes setting up'
                : canInteractWithTimeline
                  ? 'Message'
                  : 'Join this topic to send messages'
            }
            className="app-compose-field min-h-[52px] rounded-[24px] px-4 py-3 text-[15px] leading-6"
            disabled={!canInteractWithTimeline}
          />
          <IonButton
            shape="round"
            color="primary"
            onClick={handleSendMessage}
            className="h-12 w-12 shrink-0 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.45)]"
            disabled={
              !canInteractWithTimeline ||
              isPendingRoom ||
              uploadingAttachment ||
              !draft.trim()
            }
          >
            <IonIcon slot="icon-only" icon={send} />
          </IonButton>
        </div>
      </IonFooter>

      <IonActionSheet
        isOpen={showMenu}
        onDidDismiss={() => setShowMenu(false)}
        header="Topic"
        cssClass="app-action-sheet"
        buttons={conversationMenuButtons}
      />

      <IdentityEditorModal
        isOpen={showIdentityModal}
        onClose={() => setShowIdentityModal(false)}
        title="Edit Topic"
        nameLabel="Topic name"
        descriptionLabel="Description"
        nameValue={roomName}
        descriptionValue={roomDescription}
        saveLabel="Save topic"
        isSaving={savingIdentity}
        error={actionError}
        onSave={handleSaveTopicIdentity}
      />

      <Modal
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        title="Archive topic"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-text-muted">
            Archive <span className="font-medium text-text">{roomName}</span>?
            The topic will stay in your hub, but it will be treated as
            archived in the app.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowArchiveConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowArchiveConfirm(false);
                void handleUpdateRoomMeta({ archived: true });
              }}
            >
              Archive topic
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        title="Leave topic"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-text-muted">
            Leave <span className="font-medium text-text">{roomName}</span>?
            You can rejoin this Tandem topic later from its hub.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => setShowLeaveConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowLeaveConfirm(false);
                void handleLeaveCurrentRoom();
              }}
            >
              Leave topic
            </Button>
          </div>
        </div>
      </Modal>

      <TangentModal
        isOpen={showTangentModal}
        onClose={() => {
          if (!creatingTangent) {
            setShowTangentModal(false);
            setTangentError(null);
          }
        }}
        topics={tangentTopics}
        onSelectTopic={handleSelectTopic}
        onCreateTopic={handleCreateTangent}
        isSubmitting={creatingTangent}
        error={tangentError}
      />
    </IonPage>
  );
}

export default RoomPage;
