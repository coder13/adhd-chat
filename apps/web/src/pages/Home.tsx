import { IonButton, IonIcon, IonSearchbar } from '@ionic/react';
import { ClientEvent, RoomEvent } from 'matrix-js-sdk';
import { searchOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppAvatar, AuthFallbackState, Button, Card } from '../components';
import { ListPageLayout } from '../components/ionic';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useThrottledRefresh } from '../hooks/useThrottledRefresh';
import { useTandem } from '../hooks/useTandem';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { resolveDesktopHomeTarget } from '../lib/desktopShell';
import {
  buildTandemSpaceCatalog,
  type TandemSpaceSummary,
} from '../lib/matrix/spaceCatalog';
import {
  formatTopicCountLabel,
  getTandemPartnerSummary,
} from '../lib/matrix/tandemPresentation';

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

function Home() {
  const { client, isReady, state, user, error, bootstrapUserId } =
    useMatrixClient();
  const cacheUserId = user?.userId ?? bootstrapUserId;
  const {
    incomingInvites,
    relationships,
    busyInviteId,
    acceptInvite,
    declineInvite,
    isRecoveringRelationships,
  } = useTandem(client, cacheUserId);
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktopLayout = useMediaQuery('(min-width: 1280px)');
  const [search, setSearch] = useState('');
  const cacheKey = cacheUserId ? `tandem-spaces:${cacheUserId}` : null;
  const {
    data: spaces,
    error: catalogError,
    refresh: refreshSpaces,
    isLoading: isLoadingSpaces,
    isRefreshing: isRefreshingSpaces,
    hasCachedData,
  } = usePersistedResource<TandemSpaceSummary[]>({
    cacheKey,
    enabled: Boolean(client && user),
    initialValue: [],
    load: async () => buildTandemSpaceCatalog(client!, user!.userId),
    preserveValue: (currentSpaces, nextSpaces) =>
      nextSpaces.length > 0 || currentSpaces.length === 0
        ? nextSpaces
        : currentSpaces,
  });
  const [stableSpaces, setStableSpaces] = useState<TandemSpaceSummary[]>([]);
  const scheduleRefreshSpaces = useThrottledRefresh(refreshSpaces);

  useEffect(() => {
    if (!client || !user) {
      return;
    }
    const handleSync = () => {
      scheduleRefreshSpaces();
    };
    client.on(ClientEvent.Sync, handleSync);

    return () => {
      client.off(ClientEvent.Sync, handleSync);
    };
  }, [client, scheduleRefreshSpaces, user, incomingInvites]);

  useEffect(() => {
    if (!client || !user) {
      return;
    }

    const handleMembershipChange = () => {
      void refreshSpaces();
    };

    client.on(RoomEvent.MyMembership, handleMembershipChange);

    return () => {
      client.off(RoomEvent.MyMembership, handleMembershipChange);
    };
  }, [client, refreshSpaces, user]);

  useEffect(() => {
    if (!client || !user || relationships.length === 0) {
      return;
    }

    scheduleRefreshSpaces(true);
  }, [client, scheduleRefreshSpaces, relationships, isRecoveringRelationships, user]);

  useEffect(() => {
    if (spaces.length > 0) {
      setStableSpaces(spaces);
      return;
    }

    if (!hasCachedData && relationships.length === 0 && !isRefreshingSpaces) {
      setStableSpaces([]);
    }
  }, [hasCachedData, isRefreshingSpaces, relationships.length, spaces]);

  const displaySpaces = useMemo(() => {
    if (spaces.length > 0) {
      return spaces;
    }

    if (
      stableSpaces.length > 0 &&
      (isRefreshingSpaces || isRecoveringRelationships || relationships.length > 0)
    ) {
      return stableSpaces;
    }

    return spaces;
  }, [
    isRecoveringRelationships,
    isRefreshingSpaces,
    relationships.length,
    spaces,
    stableSpaces,
  ]);

  const visibleSpaces = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    if (!searchValue) {
      return displaySpaces;
    }

    return displaySpaces.filter((space) => {
      return (
        space.name.toLowerCase().includes(searchValue) ||
        space.partnerUserId.toLowerCase().includes(searchValue) ||
        space.preview.toLowerCase().includes(searchValue)
      );
    });
  }, [displaySpaces, search]);

  const pendingIncomingInvites = incomingInvites.filter(
    (invite) => invite.status === 'pending'
  );
  const canRenderCachedHome =
    state === 'syncing' && Boolean(cacheUserId) && hasCachedData;
  const isRestoring = !isReady || !user;
  const isHubPickerMode = useMemo(() => {
    return new URLSearchParams(location.search).get('select-hub') === '1';
  }, [location.search]);

  useEffect(() => {
    if (
      !isDesktopLayout ||
      isHubPickerMode ||
      !client ||
      !user ||
      displaySpaces.length === 0
    ) {
      return;
    }

    const target = resolveDesktopHomeTarget({
      client,
      userId: user.userId,
      spaces: displaySpaces,
    });

    if (!target?.roomId) {
      return;
    }

    navigate(`/room/${encodeURIComponent(target.roomId)}`, { replace: true });
  }, [client, displaySpaces, isDesktopLayout, isHubPickerMode, navigate, user]);

  if (isRestoring && !canRenderCachedHome) {
    return (
      <AuthFallbackState
        state={state}
        restoringTitle="Restoring ADHD Chat"
        restoringMessage="Reconnecting to your shared hubs and recent conversations."
        signedOutTitle="ADHD Chat"
        signedOutMessage={
          <>
            Please{' '}
            <Link to="/login" className="font-medium text-accent">
              log in
            </Link>{' '}
            to open your shared hubs.
          </>
        }
      />
    );
  }

  if (isDesktopLayout && displaySpaces.length === 0 && !isLoadingSpaces) {
    return (
      <div className="app-shell flex min-h-[100dvh] items-center justify-center bg-[var(--app-chat-background)] px-6">
        <Card tone="accent" className="w-full max-w-xl">
          <h2 className="text-xl font-semibold text-text">Start your first hub</h2>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            Invite a partner to create your shared Tandem space. Once you have a
            hub, desktop will open directly into your latest room.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => navigate('/contacts/new')} disabled={isRestoring}>
              Invite a partner
            </Button>
            <Button variant="outline" onClick={() => navigate('/contacts')}>
              Open contacts
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <ListPageLayout
        title="Hubs"
        endSlot={
          <IonButton
            fill="clear"
            color="medium"
            onClick={() => navigate('/search')}
          >
            <IonIcon slot="icon-only" icon={searchOutline} />
          </IonButton>
        }
        headerContent={
          <IonSearchbar
            value={search}
            onIonInput={(event) => setSearch(event.detail.value ?? '')}
            placeholder="Search hubs or topics"
            className="app-searchbar"
          />
        }
      >
        <div className="space-y-4 px-4 pb-24 pt-4">
          {!isRestoring && pendingIncomingInvites.length > 0 && (
            <section className="space-y-3">
              <div className="text-lg font-semibold text-text">Pending invites</div>
              {pendingIncomingInvites.map((invite) => (
                <Card key={invite.inviteId} tone="accent">
                  <div className="flex items-center gap-3">
                    <AppAvatar
                      name={invite.inviterMatrixId}
                      className="h-11 w-11"
                      textClassName="text-sm"
                    />
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-text">
                        Shared hub invite
                      </h3>
                      <p className="mt-1 text-sm text-text-muted">{invite.inviterMatrixId}</p>
                    </div>
                  </div>
                  {invite.message && (
                    <p className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-sm text-text">
                      {invite.message}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      onClick={() => void acceptInvite(invite)}
                      disabled={busyInviteId === invite.inviteId}
                    >
                      {busyInviteId === invite.inviteId
                        ? 'Joining...'
                        : 'Join hub'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void declineInvite(invite)}
                      disabled={busyInviteId === invite.inviteId}
                    >
                      Decline
                    </Button>
                  </div>
                </Card>
              ))}
            </section>
          )}

          <section className="space-y-3">
            {(error || catalogError) && (
              <div className="text-sm text-danger">{error || catalogError}</div>
            )}

            {displaySpaces.length === 0 &&
            (isRecoveringRelationships || relationships.length > 0) &&
            !catalogError ? (
              <Card tone="accent">
                <h3 className="text-base font-semibold text-text">Restoring hubs</h3>
              </Card>
            ) : visibleSpaces.length === 0 &&
              displaySpaces.length === 0 &&
              !isLoadingSpaces ? (
              <Card tone="accent">
                <h3 className="text-base font-semibold text-text">Start your first hub</h3>
                <div className="mt-4 flex items-center gap-4">
                  <Button
                    onClick={() => navigate('/contacts/new')}
                    disabled={isRestoring}
                  >
                    Invite a partner
                  </Button>
                </div>
              </Card>
            ) : isLoadingSpaces && displaySpaces.length === 0 ? (
              <div className="py-12 text-center text-sm text-text-muted">
                Loading hubs...
              </div>
            ) : (
              <div className="space-y-3">
                {visibleSpaces.map((space) => {
                  const partner = getTandemPartnerSummary(
                    client,
                    space.partnerUserId
                  );

                  return (
                    <Card
                      key={space.spaceId}
                      className="app-hover-surface cursor-pointer"
                      onClick={() =>
                        navigate(
                          `/tandem/space/${encodeURIComponent(space.spaceId)}`
                        )
                      }
                    >
                    <div className="flex items-start gap-3">
                      <AppAvatar
                        name={partner.displayName || space.name || space.partnerUserId}
                        icon={space.icon}
                        avatarUrl={
                          !space.icon && partner.avatarUrl
                            ? client?.mxcUrlToHttp(partner.avatarUrl, 96, 96, 'crop') ??
                              null
                            : null
                        }
                        className="h-11 w-11"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="truncate text-[15px] font-semibold text-text">
                            {space.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            {space.unreadCount > 0 ? (
                              <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-semibold text-text-inverse">
                                {space.unreadCount}
                              </span>
                            ) : null}
                            <div className="text-xs text-text-muted">
                              {formatTimestamp(space.timestamp)}
                            </div>
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.12em] text-text-subtle">
                          {partner.displayName}
                        </p>
                        <p className="mt-1 truncate text-sm text-text-muted">
                          {space.description || space.preview}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-text-muted">
                          <span>{formatTopicCountLabel(space.roomCount)}</span>
                        </div>
                      </div>
                    </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </ListPageLayout>
    </>
  );
}

export default Home;
