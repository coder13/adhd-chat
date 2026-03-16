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
import { ClientEvent, MsgType, RoomEvent, type MatrixEvent, type Room as MatrixRoom } from 'matrix-js-sdk';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useChatPreferences } from '../hooks/useChatPreferences';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';
import { AppAvatar, Button, Modal, TangentModal } from '../components';
import { MessageBubble } from '../components/chat';
import { createId } from '../lib/id';
import { buildMatrixMediaPayload } from '../lib/matrix/media';
import { buildRoomSnapshot, type RoomSnapshot } from '../lib/matrix/roomSnapshot';
import {
  clearPendingTandemRoom,
  getPendingTandemRoom,
  isPendingTandemRoomId,
  startPendingTandemRoomCreation,
  subscribeToPendingTandemRooms,
  type PendingTandemRoomRecord,
} from '../lib/matrix/pendingTandemRoom';
import {
  buildTandemSpaceRoomCatalog,
  type TandemSpaceRoomSummary,
} from '../lib/matrix/spaceCatalog';
import {
  ensureTandemSpaceLinks,
  getTandemSpaceIdForRoom,
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
      body: `Creating "${pendingRoom.roomName}" in your Tandem space.`,
      timestamp: pendingRoom.createdAt,
      isOwn: false,
      msgtype: MsgType.Notice,
    },
    {
      id: `${pendingRoom.pendingRoomId}:invite`,
      senderId: 'Tandem',
      senderName: 'Tandem',
      body: `Inviting ${pendingRoom.partnerUserId} and linking the room to the space.`,
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
      body: 'Room created. Opening your thread now.',
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
    !isPendingRoom && user?.userId && roomId ? `room:${user.userId}:${roomId}` : null;
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
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [enablingEncryption, setEnablingEncryption] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTangentModal, setShowTangentModal] = useState(false);
  const [creatingTangent, setCreatingTangent] = useState(false);
  const [tangentError, setTangentError] = useState<string | null>(null);
  const [pendingRoom, setPendingRoom] = useState<PendingTandemRoomRecord | null>(
    () => getPendingTandemRoom(roomId)
  );
  const contentRef = useRef<HTMLIonContentElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const currentRoom = client?.getRoom(roomId ?? undefined) ?? null;
  const tangentSpaceId = isPendingRoom
    ? pendingRoom?.sharedSpaceId ?? null
    : client
      ? getTandemSpaceIdForRoom(client, currentRoom)
      : null;
  const tangentRelationship =
    relationships.find((entry) => entry.sharedSpaceId === tangentSpaceId) ?? null;
  const {
    data: tangentTopics,
    refresh: refreshTangentTopics,
  } = usePersistedResource<TandemSpaceRoomSummary[]>({
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

    client.on(ClientEvent.Sync, updateRoomState);
    client.on(RoomEvent.Timeline, handleTimeline);
    client.on(RoomEvent.Name, updateRoomState);
    client.on(RoomEvent.MyMembership, updateRoomState);
    client.on(RoomEvent.AccountData, handleRoomAccountData);

    return () => {
      if (roomLoadTimeoutId !== null) {
        window.clearTimeout(roomLoadTimeoutId);
      }
      client.off(ClientEvent.Sync, updateRoomState);
      client.off(RoomEvent.Timeline, handleTimeline);
      client.off(RoomEvent.Name, updateRoomState);
      client.off(RoomEvent.MyMembership, updateRoomState);
      client.off(RoomEvent.AccountData, handleRoomAccountData);
    };
  }, [client, isPendingRoom, refresh, roomId, user]);

  useEffect(() => {
    requestAnimationFrame(() => {
      void contentRef.current?.scrollToBottom(250);
    });
  }, [isPendingRoom ? pendingRoom?.status : snapshot.messages]);

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
    navigate(`/room/${encodeURIComponent(pendingRoom.roomId)}`, { replace: true });
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
              Please <Link to="/login" className="text-accent">log in</Link> to view this chat.
            </p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

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

  const handleSendMessage = async () => {
    if (isPendingRoom) {
      return;
    }

    const body = draft.trim();
    if (!body) {
      return;
    }

    setSending(true);

    try {
      await (
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
        createId('txn')
      );
      setDraft('');
      requestAnimationFrame(() => {
        void contentRef.current?.scrollToBottom(250);
      });
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSending(false);
    }
  };

  const handleAttachmentSelection = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !client || !roomId || isPendingRoom) {
      return;
    }

    setUploadingAttachment(true);
    setActionError(null);

    try {
      const content = await buildMatrixMediaPayload(client, file);
      await (
        client.sendEvent as (
          nextRoomId: string,
          eventType: string,
          content: Record<string, unknown>,
          txnId?: string
        ) => Promise<unknown>
      )(roomId, 'm.room.message', content, createId('txn'));
      requestAnimationFrame(() => {
        void contentRef.current?.scrollToBottom(250);
      });
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLIonTextareaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (sending || !draft.trim()) {
      return;
    }

    void handleSendMessage();
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

  const handleCreateTangent = async (name: string) => {
    if (!client || !user || !tangentRelationship) {
      setTangentError('This room is not inside a Tandem space.');
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

    if (topic.membership === 'invite') {
      try {
        await client.joinRoom(topic.id);
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
        roomSubtitle:
          pendingRoom.status === 'failed'
            ? 'Room setup ran into a problem'
            : 'Setting up your new room...',
        messages: buildPendingRoomMessages(pendingRoom),
        isEncrypted: false,
        roomMeta: {
          category: pendingRoom.category ?? 'Tandem',
        } as TandemRoomMeta,
      }
    : null;
  const activeSnapshot = pendingSnapshot ?? snapshot;
  const { roomName, roomSubtitle, messages, isEncrypted, roomMeta } = activeSnapshot;
  const visibleError = pendingRoom?.status === 'failed' ? pendingRoom.error ?? actionError : actionError ?? error;
  const handleBackNavigation = () => {
    if (tangentSpaceId) {
      navigate(`/tandem/space/${encodeURIComponent(tangentSpaceId)}`);
      return;
    }

    navigate(-1);
  };

  const conversationMenuButtons = [
    ...(!isEncrypted
      ? [
          {
            text: enablingEncryption ? 'Enabling encryption...' : 'Enable encryption',
            icon: lockClosedOutline,
            cssClass: 'app-action-primary',
            handler: () => {
              void handleEnableEncryption();
            },
        },
      ]
      : []),
    ...(!roomMeta.category
      ? [{
          text: 'Set category',
          handler: () => {
            const nextCategory = window.prompt(
              'Category label for this room',
              roomMeta.category ?? ''
            );
            if (nextCategory === null) {
              return;
            }
            void handleUpdateRoomMeta({
              category: nextCategory.trim() || undefined,
            });
          },
        }]
      : []),
    {
      text: roomMeta.archived ? 'Unarchive room' : 'Archive room',
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
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-text">{roomName}</div>
              <div className="truncate text-xs text-text-muted">
                {roomSubtitle}
                {isEncrypted ? ' • encrypted' : ''}
              </div>
            </div>
          </div>
          <IonButtons slot="end">
            {!isPendingRoom && (
              <IonButton
                fill="clear"
                color={roomMeta.pinned ? 'primary' : 'medium'}
                onClick={() => {
                  void handleUpdateRoomMeta({ pinned: !roomMeta.pinned });
                }}
                aria-label={roomMeta.pinned ? 'Unpin room' : 'Pin room'}
              >
                <IonIcon slot="icon-only" icon={roomMeta.pinned ? star : starOutline} />
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
            <IonButton fill="clear" color="medium" onClick={() => setShowMenu(true)} disabled={isPendingRoom}>
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
            <div className="py-12 text-center text-sm text-text-muted">Loading messages...</div>
          ) : visibleError && messages.length === 0 ? (
            <div className="py-6 text-center text-sm text-danger">{visibleError}</div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-base font-medium text-text">No messages yet</p>
              <p className="mt-2 text-sm text-text-muted">Start the conversation below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleError && (
                <div className="py-2 text-center text-sm text-danger">{visibleError}</div>
              )}
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  accessToken={client.getAccessToken()}
                  viewMode={preferences.chatViewMode}
                />
              ))}
            </div>
          )}
        </div>
      </IonContent>

      <IonFooter className="ion-no-border">
        <div className="app-composer">
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
                disabled={uploadingAttachment || sending}
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
            placeholder={isPendingRoom ? 'Start typing while the room finishes setting up' : 'Message'}
            className="app-compose-field"
          />
          <IonButton
            shape="round"
            color="primary"
            onClick={handleSendMessage}
            disabled={isPendingRoom || sending || uploadingAttachment || !draft.trim()}
          >
            <IonIcon slot="icon-only" icon={send} />
          </IonButton>
        </div>
      </IonFooter>

      <IonActionSheet
        isOpen={showMenu}
        onDidDismiss={() => setShowMenu(false)}
        header="Conversation"
        cssClass="app-action-sheet"
        buttons={conversationMenuButtons}
      />

      <Modal
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        title="Archive room"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-text-muted">
            Archive <span className="font-medium text-text">{roomName}</span>? The room
            will stay in your Tandem space, but it will be treated as archived in the app.
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
              Archive room
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
