import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonToolbar,
} from '@ionic/react';
import { arrowBack, pin } from 'ionicons/icons';
import {
  ClientEvent,
  RoomEvent,
  type MatrixEvent,
  type Room as MatrixRoom,
} from 'matrix-js-sdk';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthFallbackState } from '../components';
import { MessageBubble } from '../components/chat';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useThrottledRefresh } from '../hooks/useThrottledRefresh';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';
import {
  buildRoomSnapshot,
  type RoomSnapshot,
} from '../lib/matrix/roomSnapshot';

type PinnedMessagesSnapshot = {
  roomName: string;
  messages: RoomSnapshot['messages'];
};

async function buildPinnedMessagesSnapshot(
  roomId: string,
  client: NonNullable<ReturnType<typeof useMatrixClient>['client']>,
  userId: string
): Promise<PinnedMessagesSnapshot> {
  const room = client.getRoom(roomId);
  if (!room) {
    throw new Error('Topic not found.');
  }

  const snapshot = await buildRoomSnapshot(client, room, userId);
  const pinnedIds =
    room.currentState
      .getStateEvents('m.room.pinned_events', '')
      ?.getContent<{ pinned?: string[] }>().pinned ?? [];

  return {
    roomName: snapshot.roomName,
    messages: snapshot.messages.filter((message) => pinnedIds.includes(message.id)),
  };
}

function RoomPinnedMessagesPage() {
  const { roomId: encodedRoomId } = useParams<{ roomId: string }>();
  const roomId = encodedRoomId ? decodeURIComponent(encodedRoomId) : null;
  const navigate = useNavigate();
  const { client, isReady, state, user, bootstrapUserId } = useMatrixClient();
  const cacheUserId = user?.userId ?? bootstrapUserId;
  const {
    data: snapshot,
    error,
    isLoading,
    refresh,
    hasCachedData,
  } = usePersistedResource<PinnedMessagesSnapshot>({
    cacheKey:
      cacheUserId && roomId ? `room-pins:${cacheUserId}:${roomId}` : null,
    enabled: Boolean(client && user && isReady && roomId),
    initialValue: {
      roomName: 'Topic',
      messages: [],
    },
    load: async () => buildPinnedMessagesSnapshot(roomId!, client!, user!.userId),
  });
  const scheduleRefreshPinnedMessages = useThrottledRefresh(refresh);
  const isLiveSession = Boolean(client && user && isReady);
  const canRenderCachedPins =
    state === 'syncing' && Boolean(cacheUserId) && hasCachedData;

  useEffect(() => {
    if (!client || !roomId || !user || !isReady) {
      return;
    }

    const room = client.getRoom(roomId);

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

      void refresh();
    };

    const handleAccountData = (
      _event: MatrixEvent,
      eventRoom: MatrixRoom
    ) => {
      if (eventRoom.roomId === roomId) {
        void refresh();
      }
    };

    const handleSync = () => {
      scheduleRefreshPinnedMessages();
    };

    client.on(ClientEvent.Sync, handleSync);
    client.on(RoomEvent.Timeline, handleTimeline);
    client.on(RoomEvent.AccountData, handleAccountData);
    client.on(RoomEvent.Name, refresh);
    room?.on(RoomEvent.CurrentStateUpdated, refresh);

    return () => {
      client.off(ClientEvent.Sync, handleSync);
      client.off(RoomEvent.Timeline, handleTimeline);
      client.off(RoomEvent.AccountData, handleAccountData);
      client.off(RoomEvent.Name, refresh);
      room?.off(RoomEvent.CurrentStateUpdated, refresh);
    };
  }, [client, isReady, refresh, roomId, scheduleRefreshPinnedMessages, user]);

  if (!roomId) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <div className="flex min-h-screen items-center justify-center text-text">
            No topic selected.
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!isLiveSession && !canRenderCachedPins) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <AuthFallbackState
            state={state}
            signedOutMessage={
              <>
                Please{' '}
                <Link to="/login" className="text-accent">
                  log in
                </Link>{' '}
                to view pinned messages.
              </>
            }
          />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar">
          <IonButtons slot="start">
            <IonButton
              fill="clear"
              onClick={() => navigate(`/room/${encodeURIComponent(roomId)}`)}
            >
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <div className="flex items-center gap-2 px-2 text-[15px] font-semibold text-text">
            <IonIcon icon={pin} className="text-sm text-text-muted" />
            <span>Pinned Messages</span>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="app-list-page">
        <div className="px-4 py-4">
          <div className="mb-4 text-sm text-text-muted">
            {snapshot.roomName}
          </div>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-text-muted">
              Loading pinned messages...
            </div>
          ) : error ? (
            <div className="py-6 text-center text-sm text-danger">{error}</div>
          ) : snapshot.messages.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-base font-medium text-text">No pinned messages</p>
              <p className="mt-2 text-sm text-text-muted">
                Pin a message from the topic menu to keep it here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshot.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  accessToken={client?.getAccessToken() ?? null}
                  viewMode="timeline"
                />
              ))}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

export default RoomPinnedMessagesPage;
