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
  ellipsisHorizontal,
  gitBranchOutline,
  peopleOutline,
  searchOutline,
} from 'ionicons/icons';
import { ClientEvent } from 'matrix-js-sdk';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AppAvatar,
  AuthFallbackState,
  Button,
  Card,
  IdentityEditorModal,
  Modal,
  NotificationSettingsPanel,
  TangentModal,
} from '../components';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useThrottledRefresh } from '../hooks/useThrottledRefresh';
import { useChatPreferences } from '../hooks/useChatPreferences';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useTandem } from '../hooks/useTandem';
import { getRoomIcon, getRoomTopic, updateRoomIdentity } from '../lib/matrix/identity';
import {
  buildTandemSpaceRoomCatalog,
  type TandemSpaceRoomSummary,
} from '../lib/matrix/spaceCatalog';
import { getRoomDisplayName } from '../lib/matrix/chatCatalog';
import { shouldSuppressMissingTandemSpaceError } from '../lib/matrix/restoreErrors';
import { startPendingTandemRoomCreation } from '../lib/matrix/pendingTandemRoom';
import {
  getTandemPartnerSummary,
} from '../lib/matrix/tandemPresentation';
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

function preserveRoomCatalog(
  currentRooms: TandemSpaceRoomSummary[],
  nextRooms: TandemSpaceRoomSummary[]
) {
  if (nextRooms.length > 0 || currentRooms.length === 0) {
    return nextRooms;
  }

  return currentRooms;
}

function TandemSpacePage() {
  const { spaceId: encodedSpaceId } = useParams<{ spaceId: string }>();
  const spaceId = encodedSpaceId ? decodeURIComponent(encodedSpaceId) : null;
  const navigate = useNavigate();
  const { client, isReady, state, user, bootstrapUserId } = useMatrixClient();
  const cacheUserId = user?.userId ?? bootstrapUserId;
  const {
    preferences,
    updateRoomNotificationMode,
    resolveRoomNotificationMode,
  } = useChatPreferences(client, cacheUserId);
  const { relationships } = useTandem(client, cacheUserId);
  const cacheKey =
    cacheUserId && spaceId ? `space-rooms:${cacheUserId}:${spaceId}` : null;
  const {
    data: rooms,
    error,
    isLoading: loading,
    refresh,
    hasCachedData,
  } = usePersistedResource<TandemSpaceRoomSummary[]>({
    cacheKey,
    enabled: Boolean(client && user && isReady && spaceId),
    initialValue: [],
    load: async () =>
      buildTandemSpaceRoomCatalog(client!, user!.userId, spaceId!),
    preserveValue: preserveRoomCatalog,
  });
  const scheduleRefresh = useThrottledRefresh(refresh);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [showTangentModal, setShowTangentModal] = useState(false);
  const [creatingTangent, setCreatingTangent] = useState(false);
  const [tangentError, setTangentError] = useState<string | null>(null);
  const [showSpaceMenu, setShowSpaceMenu] = useState(false);
  const [showHubIdentityModal, setShowHubIdentityModal] = useState(false);
  const [showHubNotificationModal, setShowHubNotificationModal] = useState(false);
  const [savingHubIdentity, setSavingHubIdentity] = useState(false);
  const [showArchivedRooms, setShowArchivedRooms] = useState(false);
  const [spaceNotice, setSpaceNotice] = useState<string | null>(null);
  const currentHub = client?.getRoom(spaceId ?? undefined) ?? null;
  const hubName =
    currentHub && user ? getRoomDisplayName(currentHub, user.userId) : null;
  const hubDescription = currentHub ? getRoomTopic(currentHub) : null;
  const relationship = useMemo(
    () =>
      relationships.find((entry) => entry.sharedSpaceId === spaceId) ?? null,
    [relationships, spaceId]
  );
  const partner = relationship
    ? getTandemPartnerSummary(client, relationship.partnerUserId)
    : null;
  const archivedRooms = useMemo(
    () => rooms.filter((room) => room.isArchived),
    [rooms]
  );
  const isLiveSession = Boolean(client && user && isReady);
  const canRenderCachedSpace =
    state === 'syncing' && Boolean(cacheUserId) && hasCachedData;
  const suppressMissingSpaceError = shouldSuppressMissingTandemSpaceError({
    error,
    hasCachedData,
    hasRelationship: Boolean(relationship),
    hasLiveSpaceRoom: Boolean(currentHub),
    isAuthRestoring: state === 'syncing',
  });
  const visibleError = suppressMissingSpaceError ? null : error;
  const isRestoringTopics =
    loading || (suppressMissingSpaceError && rooms.length === 0);
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
    const handleSync = () => {
      scheduleRefresh();
    };
    client.on(ClientEvent.Sync, handleSync);

    return () => {
      client.off(ClientEvent.Sync, handleSync);
    };
  }, [client, isReady, scheduleRefresh, spaceId, user]);

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
      console.error('Failed to repair Tandem hub links', cause);
    });
  }, [client, relationship, rooms, user]);

  if (!spaceId) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <div className="flex items-center justify-center min-h-screen text-text">
            No Tandem hub selected.
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!isLiveSession && !canRenderCachedSpace) {
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
                to view this hub.
              </>
            }
          />
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
      setTangentError('Open a shared hub first, then create a topic.');
      return;
    }

    setTangentError(null);
    setCreatingTangent(true);

    const pendingRoom = startPendingTandemRoomCreation({
      client,
      relationship,
      creatorUserId: user.userId,
      name,
    });
    setShowTangentModal(false);
    setCreatingTangent(false);
    navigate(`/room/${encodeURIComponent(pendingRoom.pendingRoomId)}`);
  };

  const handleSaveHubIdentity = async (values: {
    name: string;
    description: string;
    icon: string | null;
  }) => {
    if (!client || !currentHub) {
      return;
    }

    setSavingHubIdentity(true);
    setSpaceNotice(null);

    try {
      await updateRoomIdentity(client, currentHub, {
        name: values.name,
        topic: values.description,
        icon: values.icon,
      });
      setShowHubIdentityModal(false);
      await refresh();
    } catch (cause) {
      console.error(cause);
      setSpaceNotice(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSavingHubIdentity(false);
    }
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
    const joinLabel = room.membership === 'join' ? 'Open topic' : 'Join topic';

    return (
      <button
        key={room.id}
        type="button"
        className="app-hover-surface flex w-full items-start gap-2.5 rounded-[22px] border border-transparent px-2.5 py-2.5 text-left"
        onClick={() => {
          if (isLiveSession || room.membership === 'join') {
            handleOpenRoom(room);
          }
        }}
      >
        <AppAvatar
          name={room.name}
          icon={room.icon}
          className="mt-0.5 h-9 w-9 shrink-0"
          textClassName="text-sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="truncate text-[14px] font-semibold text-text">
              {room.name}
            </h3>
            <div className="flex shrink-0 items-center gap-2">
              {room.unreadCount > 0 ? (
                <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-semibold text-text-inverse">
                  {room.unreadCount}
                </span>
              ) : null}
              <div className="text-[11px] text-text-muted">
                {formatTimestamp(room.timestamp)}
              </div>
            </div>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-text-muted">
            {room.description || room.preview}
          </p>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-text-muted">
            {room.isArchived && <span>Archived</span>}
            {room.membership === 'invite' && <span>Invited</span>}
          </div>
        </div>
        {room.membership !== 'join' && (
          <div className="self-center pl-2 shrink-0">
            <Button
              onClick={(event) => {
                event.stopPropagation();
                if (isLiveSession) {
                  void handleJoinRoom(room.id);
                }
              }}
              size="sm"
              disabled={!isLiveSession || joiningRoomId === room.id}
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
              name={hubName ?? relationship?.partnerUserId ?? 'Hub'}
              icon={currentHub ? getRoomIcon(currentHub) : null}
              avatarUrl={
                !(currentHub ? getRoomIcon(currentHub) : null) && partner?.avatarUrl
                  ? client?.mxcUrlToHttp(partner.avatarUrl, 96, 96, 'crop') ?? null
                  : null
              }
              className="w-10 h-10"
              textClassName="text-sm"
            />
            <div className="flex-1 min-w-0">
              <div className="truncate text-[15px] font-semibold text-text">
                {hubName ??
                  (relationship
                    ? `Hub with ${relationship.partnerUserId}`
                    : 'Tandem Hub')}
              </div>
              <div className="text-xs truncate text-text-muted">
                {partner
                  ? `Shared with ${partner.displayName} • ${rooms.length} ${
                      rooms.length === 1 ? 'topic' : 'topics'
                    }`
                  : hubDescription || `${rooms.length} ${rooms.length === 1 ? 'topic' : 'topics'}`}
              </div>
            </div>
          </div>
          <IonButtons slot="end">
            <IonButton
              fill="clear"
              color="medium"
              onClick={() => navigate('/search')}
              aria-label="Search conversations"
            >
              <IonIcon slot="icon-only" icon={searchOutline} />
            </IonButton>
            <IonButton
              fill="clear"
              color="primary"
              onClick={() => {
                if (isLiveSession) {
                  setShowTangentModal(true);
                }
              }}
              aria-label="Create topic"
              disabled={!isLiveSession}
            >
              <IonIcon slot="icon-only" icon={gitBranchOutline} />
            </IonButton>
            <IonButton
              fill="clear"
              color="medium"
              onClick={() => {
                if (isLiveSession) {
                  setShowSpaceMenu(true);
                }
              }}
              aria-label="Hub options"
              disabled={!isLiveSession}
            >
              <IonIcon slot="icon-only" icon={ellipsisHorizontal} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="app-list-page">
        <div className="px-4 py-4 space-y-4">
          {spaceNotice && (
            <div className="text-sm text-text-muted">{spaceNotice}</div>
          )}

          {isRestoringTopics ? (
            <div className="py-12 text-sm text-center text-text-muted">
              Restoring topics...
            </div>
          ) : visibleError ? (
            <div className="py-6 text-sm text-center text-danger">{visibleError}</div>
          ) : rooms.length === 0 ? (
            <Card>
              <h3 className="text-base font-semibold text-text">No topics yet</h3>
              <div className="mt-4">
                <Button
                  onClick={() => setShowTangentModal(true)}
                  disabled={!isLiveSession}
                >
                  Create a topic
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {pinnedRooms.length > 0 && (
                <section className="space-y-1.5">
                  <div className="pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-text-subtle">
                    Pinned topics
                  </div>
                  {pinnedRooms.map(renderRoomCard)}
                </section>
              )}

              {pinnedRooms.length > 0 && unpinnedRooms.length > 0 && (
                <div className="h-px bg-line/70" />
              )}

              {unpinnedRooms.length > 0 && (
                <section className="space-y-1.5">
                  {pinnedRooms.length === 0 ? (
                    <div className="pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-text-subtle">
                      All topics
                    </div>
                  ) : null}
                  {unpinnedRooms.map(renderRoomCard)}
                </section>
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
                      <div className="pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                          Archived
                      </div>
                      <div className="space-y-1.5">
                        {archivedRooms.map(renderRoomCard)}
                      </div>
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
        header="Hub"
        cssClass="app-action-sheet"
        buttons={[
          {
            text: 'Edit hub details',
            handler: () => {
              setShowHubIdentityModal(true);
            },
          },
          {
            text: 'View members',
            icon: peopleOutline,
            cssClass: 'app-action-primary',
            handler: () => {
              navigate(`/tandem/space/${encodeURIComponent(spaceId)}/members`);
            },
          },
          {
            text: 'Hub notifications',
            handler: () => {
              setShowHubNotificationModal(true);
            },
          },
          {
            text: 'Cancel',
            role: 'cancel',
          },
        ]}
      />

      <IdentityEditorModal
        isOpen={showHubIdentityModal}
        onClose={() => setShowHubIdentityModal(false)}
        title="Edit Hub"
        nameLabel="Hub name"
        descriptionLabel="Description"
        nameValue={hubName ?? ''}
        descriptionValue={hubDescription}
        iconValue={currentHub ? getRoomIcon(currentHub) : null}
        saveLabel="Save hub"
        isSaving={savingHubIdentity}
        error={spaceNotice}
        onSave={handleSaveHubIdentity}
      />

      <Modal
        isOpen={showHubNotificationModal}
        onClose={() => setShowHubNotificationModal(false)}
        title="Hub notifications"
        size="sm"
      >
        <NotificationSettingsPanel
          title={hubName ?? 'Hub notifications'}
          body="Choose whether this hub follows your default, always notifies, or stays muted."
          value={preferences.roomNotificationOverrides[spaceId] ?? 'default'}
          options={[
            { label: 'Default', value: 'default' },
            { label: 'All', value: 'all' },
            { label: 'Muted', value: 'mute' },
          ]}
          onChange={(value) => {
            void updateRoomNotificationMode(spaceId, value);
          }}
          helper={`Current effective setting: ${resolveRoomNotificationMode(spaceId) === 'mute' ? 'Muted' : 'All messages'}.`}
        />
      </Modal>
    </IonPage>
  );
}

export default TandemSpacePage;
