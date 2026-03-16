import {
  IonActionSheet,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonToolbar,
} from '@ionic/react';
import {
  arrowBack,
  chatbubbleEllipsesOutline,
  ellipsisHorizontal,
  gitBranchOutline,
  peopleOutline,
  star,
} from 'ionicons/icons';
import { ClientEvent } from 'matrix-js-sdk';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppAvatar, Button, Card, TangentModal } from '../components';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useTandem } from '../hooks/useTandem';
import {
  buildTandemSpaceRoomCatalog,
  type TandemSpaceRoomSummary,
} from '../lib/matrix/spaceCatalog';
import { startPendingTandemRoomCreation } from '../lib/matrix/pendingTandemRoom';
import {
  ensureTandemSpaceLinks,
  joinTandemRoom,
} from '../lib/matrix/tandem';

function formatTimestamp(timestamp: number) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const now = new Date();
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  return isSameDay
    ? new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(date)
    : new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
      }).format(date);
}

function TandemSpacePage() {
  const { spaceId: encodedSpaceId } = useParams<{ spaceId: string }>();
  const spaceId = encodedSpaceId ? decodeURIComponent(encodedSpaceId) : null;
  const navigate = useNavigate();
  const { client, isReady, user } = useMatrixClient();
  const { relationships } = useTandem(client, user?.userId);
  const cacheKey =
    user?.userId && spaceId ? `space-rooms:${user.userId}:${spaceId}` : null;
  const {
    data: rooms,
    error,
    isLoading: loading,
    refresh,
  } = usePersistedResource<TandemSpaceRoomSummary[]>({
    cacheKey,
    enabled: Boolean(client && user && isReady && spaceId),
    initialValue: [],
    load: async () =>
      buildTandemSpaceRoomCatalog(client!, user!.userId, spaceId!),
  });
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [showTangentModal, setShowTangentModal] = useState(false);
  const [creatingTangent, setCreatingTangent] = useState(false);
  const [tangentError, setTangentError] = useState<string | null>(null);
  const [showSpaceMenu, setShowSpaceMenu] = useState(false);
  const [showArchivedRooms, setShowArchivedRooms] = useState(false);
  const [spaceNotice, setSpaceNotice] = useState<string | null>(null);

  const relationship = useMemo(
    () =>
      relationships.find((entry) => entry.sharedSpaceId === spaceId) ?? null,
    [relationships, spaceId]
  );
  const archivedRooms = useMemo(
    () => rooms.filter((room) => room.isArchived),
    [rooms]
  );
  const pinnedRooms = useMemo(
    () => rooms.filter((room) => room.isPinned && !room.isArchived),
    [rooms]
  );
  const unpinnedRooms = useMemo(
    () => rooms.filter((room) => !room.isPinned && !room.isArchived),
    [rooms]
  );

  useEffect(() => {
    if (!client || !user || !isReady || !spaceId) {
      return;
    }
    client.on(ClientEvent.Sync, refresh);

    return () => {
      client.off(ClientEvent.Sync, refresh);
    };
  }, [client, isReady, refresh, spaceId, user]);

  useEffect(() => {
    if (!client || !user || !relationship) {
      return;
    }

    const roomIds = Array.from(
      new Set([relationship.mainRoomId, ...rooms.map((room) => room.id)])
    );
    if (roomIds.length === 0) {
      return;
    }

    void ensureTandemSpaceLinks({
      client,
      spaceId: relationship.sharedSpaceId,
      roomIds,
      userIds: [user.userId, relationship.partnerUserId],
    }).catch((cause) => {
      console.error('Failed to repair Tandem space links', cause);
    });
  }, [client, relationship, rooms, user]);

  if (!spaceId) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <div className="flex items-center justify-center min-h-screen text-text">
            No Tandem space selected.
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!isReady || !user) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <div className="flex items-center justify-center min-h-screen px-6 text-center">
            <p className="text-text">
              Please{' '}
              <Link to="/login" className="text-accent">
                log in
              </Link>{' '}
              to view this space.
            </p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const handleOpenRoom = (room: TandemSpaceRoomSummary) => {
    if (room.membership !== 'join') {
      void handleJoinRoom(room.id);
      return;
    }

    navigate(`/room/${encodeURIComponent(room.id)}`);
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!client) {
      return;
    }

    setJoiningRoomId(roomId);

    try {
      const room = client.getRoom(roomId);
      await joinTandemRoom(client, room);
      await refresh();
      navigate(`/room/${encodeURIComponent(roomId)}`);
    } catch (cause) {
      console.error(cause);
      setSpaceNotice(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleCreateTangent = async (name: string) => {
    if (!client || !user || !relationship) {
      setTangentError('Open a Tandem space first, then start a tangent.');
      return;
    }

    setTangentError(null);
    setCreatingTangent(true);

    const pendingRoom = startPendingTandemRoomCreation({
      client,
      relationship,
      creatorUserId: user.userId,
      name,
      category: 'Tandem',
    });
    setShowTangentModal(false);
    setCreatingTangent(false);
    navigate(`/room/${encodeURIComponent(pendingRoom.pendingRoomId)}`);
  };

  const handleSelectTopic = async (topicId: string) => {
    const topic = rooms.find((room) => room.id === topicId);
    if (!topic) {
      return;
    }

    setTangentError(null);
    setShowTangentModal(false);
    handleOpenRoom(topic);
  };

  const renderRoomCard = (room: TandemSpaceRoomSummary) => {
    const joinLabel =
      room.membership === 'invite'
        ? 'Join room'
        : room.membership === 'leave'
          ? 'Rejoin room'
          : 'Open room';

    return (
      <button
        key={room.id}
        type="button"
        className="app-hover-surface flex w-full items-start gap-2.5 border-t border-line px-1 py-3 text-left first:border-t-0 hover:bg-elevated/40"
        onClick={() => handleOpenRoom(room)}
      >
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elevated text-text-muted">
          <IonIcon
            icon={room.isPinned ? star : chatbubbleEllipsesOutline}
            className={
              room.isPinned ? 'text-[15px] text-warning' : 'text-[15px]'
            }
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="truncate text-[14px] font-semibold text-text">
              {room.name}
            </h3>
            <div className="shrink-0 text-[11px] text-text-muted">
              {formatTimestamp(room.timestamp)}
            </div>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-text-muted">
            {room.preview}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-text-muted">
            {room.isMain && <span>Main</span>}
            {room.category && <span>{room.category}</span>}
            {room.isArchived && <span>Archived</span>}
            {room.membership === 'invite' && <span>Invited</span>}
            {room.membership === 'leave' && <span>Left</span>}
          </div>
        </div>
        {room.membership !== 'join' && (
          <div className="self-center pl-2 shrink-0">
            <Button
              onClick={(event) => {
                event.stopPropagation();
                void handleJoinRoom(room.id);
              }}
              size="sm"
              disabled={joiningRoomId === room.id}
            >
              {joiningRoomId === room.id ? 'Joining...' : joinLabel}
            </Button>
          </div>
        )}
      </button>
    );
  };

  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar">
          <IonButtons slot="start">
            <IonButton fill="clear" onClick={() => navigate('/')}>
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <div className="flex items-center gap-3 px-2">
            <AppAvatar
              name={relationship?.partnerUserId ?? 'Tandem'}
              className="w-10 h-10"
              textClassName="text-sm"
            />
            <div className="flex-1 min-w-0">
              <div className="truncate text-[15px] font-semibold text-text">
                {relationship
                  ? `Tandem with ${relationship.partnerUserId}`
                  : 'Tandem Space'}
              </div>
              <div className="text-xs truncate text-text-muted">
                {rooms.length} threads
              </div>
            </div>
          </div>
          <IonButtons slot="end">
            <IonButton
              fill="clear"
              color="primary"
              onClick={() => setShowTangentModal(true)}
              aria-label="Create tangent"
            >
              <IonIcon slot="icon-only" icon={gitBranchOutline} />
            </IonButton>
            <IonButton
              fill="clear"
              color="medium"
              onClick={() => setShowSpaceMenu(true)}
              aria-label="Space options"
            >
              <IonIcon slot="icon-only" icon={ellipsisHorizontal} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="app-list-page">
        <div className="px-4 py-4 space-y-4">
          {spaceNotice && (
            <Card>
              <p className="text-sm leading-6 text-text-muted">{spaceNotice}</p>
            </Card>
          )}

          {loading ? (
            <div className="py-12 text-sm text-center text-text-muted">
              Loading rooms...
            </div>
          ) : error ? (
            <div className="py-6 text-sm text-center text-danger">{error}</div>
          ) : rooms.length === 0 ? (
            <Card>
              <h3 className="text-base font-semibold text-text">
                No rooms yet
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Create the first thread in this Tandem space.
              </p>
              <div className="mt-4">
                <Button onClick={() => setShowTangentModal(true)}>
                  Start a tangent
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {pinnedRooms.length > 0 && (
                <section>{pinnedRooms.map(renderRoomCard)}</section>
              )}

              {pinnedRooms.length > 0 && unpinnedRooms.length > 0 && (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-line" />
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
                    More topics
                  </span>
                  <div className="flex-1 h-px bg-line" />
                </div>
              )}

              {unpinnedRooms.length > 0 && (
                <section>{unpinnedRooms.map(renderRoomCard)}</section>
              )}

              {archivedRooms.length > 0 && (
                <section className="space-y-3">
                  <button
                    type="button"
                    className="text-sm font-medium text-accent"
                    onClick={() => setShowArchivedRooms((current) => !current)}
                  >
                    {showArchivedRooms
                      ? `Hide archived topics (${archivedRooms.length})`
                      : `View archived topics (${archivedRooms.length})`}
                  </button>
                  {showArchivedRooms && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 py-1">
                        <div className="flex-1 h-px bg-line" />
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
                          Archived
                        </span>
                        <div className="flex-1 h-px bg-line" />
                      </div>
                      <div>{archivedRooms.map(renderRoomCard)}</div>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </IonContent>

      <TangentModal
        isOpen={showTangentModal}
        onClose={() => {
          if (!creatingTangent) {
            setShowTangentModal(false);
            setTangentError(null);
          }
        }}
        topics={rooms}
        onSelectTopic={handleSelectTopic}
        onCreateTopic={handleCreateTangent}
        isSubmitting={creatingTangent}
        error={tangentError}
      />

      <IonActionSheet
        isOpen={showSpaceMenu}
        onDidDismiss={() => setShowSpaceMenu(false)}
        header="Tandem space"
        cssClass="app-action-sheet"
        buttons={[
          {
            text: 'View members',
            icon: peopleOutline,
            cssClass: 'app-action-primary',
            handler: () => {
              navigate(`/tandem/space/${encodeURIComponent(spaceId)}/members`);
            },
          },
          {
            text: 'Cancel',
            role: 'cancel',
          },
        ]}
      />
    </IonPage>
  );
}

export default TandemSpacePage;
