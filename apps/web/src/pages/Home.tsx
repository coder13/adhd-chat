import { IonButton, IonIcon, IonSearchbar } from '@ionic/react';
import { ClientEvent, RoomEvent } from 'matrix-js-sdk';
import { searchOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppAvatar, Button, Card } from '../components';
import { ListPageLayout } from '../components/ionic';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useTandem } from '../hooks/useTandem';
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
  const { client, isReady, user, error } = useMatrixClient();
  const {
    incomingInvites,
    relationships,
    busyInviteId,
    acceptInvite,
    declineInvite,
    isRecoveringRelationships,
  } = useTandem(client, user?.userId);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const cacheKey = user?.userId ? `tandem-spaces:${user.userId}` : null;
  const {
    data: spaces,
    error: catalogError,
    refresh: refreshSpaces,
    isLoading: isLoadingSpaces,
  } = usePersistedResource<TandemSpaceSummary[]>({
    cacheKey,
    enabled: Boolean(client && user),
    initialValue: [],
    load: async () => buildTandemSpaceCatalog(client!, user!.userId),
  });

  useEffect(() => {
    if (!client || !user) {
      return;
    }
    client.on(ClientEvent.Sync, refreshSpaces);

    return () => {
      client.off(ClientEvent.Sync, refreshSpaces);
    };
  }, [client, refreshSpaces, user, incomingInvites]);

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

    void refreshSpaces();
  }, [client, refreshSpaces, relationships, isRecoveringRelationships, user]);

  const visibleSpaces = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    if (!searchValue) {
      return spaces;
    }

    return spaces.filter((space) => {
      return (
        space.name.toLowerCase().includes(searchValue) ||
        space.partnerUserId.toLowerCase().includes(searchValue) ||
        space.preview.toLowerCase().includes(searchValue)
      );
    });
  }, [search, spaces]);

  const pendingIncomingInvites = incomingInvites.filter(
    (invite) => invite.status === 'pending'
  );

  if (!isReady || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <h1 className="text-3xl font-semibold text-text">ADHD Chat</h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            Please{' '}
            <Link to="/login" className="font-medium text-accent">
              log in
            </Link>{' '}
            to open your shared hubs.
          </p>
        </div>
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
          {pendingIncomingInvites.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-text">Pending invites</h2>
                <p className="mt-1 text-sm text-text-muted">
                  Accept a shared hub and it will become part of your everyday home.
                </p>
              </div>
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
                      <p className="mt-1 text-sm text-text-muted">
                        {invite.inviterMatrixId} wants to start a private hub with you.
                      </p>
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

            {visibleSpaces.length === 0 &&
            (isRecoveringRelationships || relationships.length > 0) &&
            !catalogError ? (
              <Card tone="accent">
                <h3 className="text-base font-semibold text-text">
                  Restoring your Tandem hubs
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Tandem is reconnecting your shared hubs and topics after sync so your home stays organized.
                </p>
              </Card>
            ) : visibleSpaces.length === 0 && !isLoadingSpaces ? (
              <Card tone="accent">
                <h3 className="text-base font-semibold text-text">
                  Start your first shared hub
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Invite your partner, then use one shared hub to keep plans, routines, and ongoing topics in one place.
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <Button onClick={() => navigate('/contacts/new')}>
                    Invite a partner
                  </Button>
                </div>
              </Card>
            ) : isLoadingSpaces && visibleSpaces.length === 0 ? (
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
                    <div className="flex items-start gap-4">
                      <AppAvatar
                        name={partner.displayName || space.name || space.partnerUserId}
                        icon={space.icon}
                        avatarUrl={
                          !space.icon && partner.avatarUrl
                            ? client?.mxcUrlToHttp(partner.avatarUrl, 96, 96, 'crop') ??
                              null
                            : null
                        }
                        className="h-12 w-12"
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
                        <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-text-subtle">
                          Shared with {partner.displayName}
                        </p>
                        <p className="mt-1 truncate text-sm text-text-muted">
                          {space.description || space.preview}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                          <span>{formatTopicCountLabel(space.roomCount)}</span>
                          {space.preview ? <span>Latest activity in a topic</span> : null}
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
