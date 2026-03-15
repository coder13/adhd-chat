import {
  IonActionSheet,
  IonAvatar,
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
import { arrowBack, ellipsisHorizontal, lockClosedOutline, send } from 'ionicons/icons';
import { ClientEvent, MsgType, RoomEvent, type MatrixEvent, type Room as MatrixRoom } from 'matrix-js-sdk';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';
import { buildChatCatalog, getRoomDisplayName, getTimelineMessages, type TimelineMessage } from '../lib/matrix/chatCatalog';

const ROOM_LOAD_TIMEOUT_MS = 15000;

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

function RoomPage() {
  const { roomId: encodedRoomId } = useParams<{ roomId: string }>();
  const roomId = encodedRoomId ? decodeURIComponent(encodedRoomId) : null;
  const navigate = useNavigate();
  const { client, isReady, user, logout } = useMatrixClient();
  const [messages, setMessages] = useState<TimelineMessage[]>([]);
  const [roomName, setRoomName] = useState('Conversation');
  const [roomSubtitle, setRoomSubtitle] = useState('Connecting...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [enablingEncryption, setEnablingEncryption] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const contentRef = useRef<HTMLIonContentElement>(null);

  useEffect(() => {
    if (!client || !user || !roomId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let roomLoadTimeoutId: number | null = null;

    const resolveMissingRoom = () => {
      if (!cancelled) {
        setLoading(false);
        setError('Conversation not found');
      }
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
        setLoading(true);
        setError(null);

        if (roomLoadTimeoutId !== null) {
          window.clearTimeout(roomLoadTimeoutId);
          roomLoadTimeoutId = null;
        }

        await room.loadMembersIfNeeded();
        if (cancelled) {
          return;
        }

        const catalog = await buildChatCatalog(client, user.userId);
        const chat =
          catalog.primaryChats.find((entry) => entry.id === roomId) ??
          catalog.otherChats.find((entry) => entry.id === roomId) ??
          null;
        const encryptionEvent = room.currentState.getStateEvents('m.room.encryption', '');

        setRoomName(getRoomDisplayName(room, user.userId));
        setRoomSubtitle(chat?.nativeSpaceName || `${room.getJoinedMemberCount()} members`);
        setMessages(getTimelineMessages(room, user.userId));
        setIsEncrypted(Boolean(encryptionEvent));
      } catch (cause) {
        console.error(cause);
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          requestAnimationFrame(() => {
            void contentRef.current?.scrollToBottom(250);
          });
        }
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

    client.on(ClientEvent.Sync, updateRoomState);
    client.on(RoomEvent.Timeline, handleTimeline);
    client.on(RoomEvent.Name, updateRoomState);
    client.on(RoomEvent.MyMembership, updateRoomState);

    return () => {
      cancelled = true;
      if (roomLoadTimeoutId !== null) {
        window.clearTimeout(roomLoadTimeoutId);
      }
      client.off(ClientEvent.Sync, updateRoomState);
      client.off(RoomEvent.Timeline, handleTimeline);
      client.off(RoomEvent.Name, updateRoomState);
      client.off(RoomEvent.MyMembership, updateRoomState);
    };
  }, [client, roomId, user]);

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
    setError(null);

    try {
      await (
        client.sendStateEvent as (
          nextRoomId: string,
          eventType: string,
          content: Record<string, unknown>,
          stateKey: string
        ) => Promise<unknown>
      )(roomId, 'm.room.encryption', { algorithm: 'm.megolm.v1.aes-sha2' }, '');
      setIsEncrypted(true);
    } catch (cause) {
      console.error(cause);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setEnablingEncryption(false);
    }
  };

  const handleSendMessage = async () => {
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
        window.crypto?.randomUUID?.() ?? `${Date.now()}`
      );
      setDraft('');
      requestAnimationFrame(() => {
        void contentRef.current?.scrollToBottom(250);
      });
    } catch (cause) {
      console.error(cause);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSending(false);
    }
  };

  const conversationMenuButtons = [
    ...(!isEncrypted
      ? [
          {
            text: enablingEncryption ? 'Enabling encryption...' : 'Enable encryption',
            icon: lockClosedOutline,
            handler: () => {
              void handleEnableEncryption();
            },
          },
        ]
      : []),
    {
      text: 'Back to chats',
      handler: () => navigate('/'),
    },
    {
      text: 'Log out',
      role: 'destructive' as const,
      handler: () => {
        void logout();
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
            <IonButton fill="clear" onClick={() => navigate(-1)}>
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <div className="flex items-center gap-3 px-2">
            <IonAvatar className="h-10 w-10 bg-accent-soft">
              <div className="flex h-full items-center justify-center font-semibold text-accent">
                {roomName.charAt(0).toUpperCase()}
              </div>
            </IonAvatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-text">{roomName}</div>
              <div className="truncate text-xs text-text-muted">
                {roomSubtitle}
                {isEncrypted ? ' • encrypted' : ''}
              </div>
            </div>
          </div>
          <IonButtons slot="end">
            <IonButton fill="clear" color="medium" onClick={() => setShowMenu(true)}>
              <IonIcon slot="icon-only" icon={ellipsisHorizontal} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef} fullscreen className="app-chat-page">
        <div className="px-4 pb-4 pt-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-text-muted">Loading messages...</div>
          ) : error ? (
            <div className="py-6 text-center text-sm text-danger">{error}</div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-base font-medium text-text">No messages yet</p>
              <p className="mt-2 text-sm text-text-muted">Start the conversation below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`app-chat-bubble ${message.isOwn ? 'own' : 'other'}`}
                >
                  {!message.isOwn && (
                    <div className="mb-1 text-[11px] font-medium text-text-subtle">
                      {message.senderId}
                    </div>
                  )}
                  <div>{message.body}</div>
                  <div
                    className={`mt-2 text-right text-[11px] ${
                      message.isOwn ? 'text-white/75' : 'text-text-subtle'
                    }`}
                  >
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </IonContent>

      <IonFooter className="ion-no-border">
        <div className="app-composer">
          <IonTextarea
            value={draft}
            onIonInput={(event) => setDraft(event.detail.value ?? '')}
            autoGrow
            rows={1}
            placeholder="Message"
            className="app-compose-field"
          />
          <IonButton
            shape="round"
            color="primary"
            onClick={handleSendMessage}
            disabled={sending || !draft.trim()}
          >
            <IonIcon slot="icon-only" icon={send} />
          </IonButton>
        </div>
      </IonFooter>

      <IonActionSheet
        isOpen={showMenu}
        onDidDismiss={() => setShowMenu(false)}
        header="Conversation"
        buttons={conversationMenuButtons}
      />
    </IonPage>
  );
}

export default RoomPage;
