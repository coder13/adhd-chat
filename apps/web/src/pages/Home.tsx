import { IonSearchbar } from '@ionic/react';
import { ClientEvent } from 'matrix-js-sdk';
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
  const {
    client,
    isReady,
    user,
    error,
  } = useMatrixClient();
  const { incomingInvites, busyInviteId, acceptInvite, declineInvite } = useTandem(
    client,
    user?.userId
  );
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

  const pendingIncomingInvites = incomingInvites.filter((invite) => invite.status === 'pending');

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
            to open your Tandem spaces.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ListPageLayout
        title="Chats"
        headerContent={
          <IonSearchbar
            value={search}
            onIonInput={(event) => setSearch(event.detail.value ?? '')}
            placeholder="Search spaces"
            className="app-searchbar"
          />
        }
      >
        <div className="space-y-4 px-4 pb-24 pt-4">
          {pendingIncomingInvites.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-text">Invites</h2>
                <p className="mt-1 text-sm text-text-muted">
                  Join incoming Tandem spaces before they appear in your main feed.
                </p>
              </div>
              {pendingIncomingInvites.map((invite) => (
                <Card key={invite.inviteId} tone="accent">
                  <h3 className="text-base font-semibold text-text">{invite.inviterMatrixId}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    Invited you into a private Tandem space.
                  </p>
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
                      {busyInviteId === invite.inviteId ? 'Joining...' : 'Join space'}
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

            {visibleSpaces.length === 0 && !isLoadingSpaces ? (
              <Card tone="accent">
                <h3 className="text-base font-semibold text-text">
                  Start your first Tandem space
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Invite someone you trust and your shared space will show up here
                  once they join.
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <Button onClick={() => navigate('/contacts/new')}>Invite a partner</Button>
                  <button
                    type="button"
                    onClick={() => navigate('/contacts/new')}
                    className="text-sm font-medium text-accent"
                  >
                    How Tandem invites work
                  </button>
                </div>
              </Card>
            ) : isLoadingSpaces && visibleSpaces.length === 0 ? (
              <div className="py-12 text-center text-sm text-text-muted">Loading spaces...</div>
            ) : (
              <div className="space-y-3">
                {visibleSpaces.map((space) => (
                  <Card
                    key={space.spaceId}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate(`/tandem/space/${encodeURIComponent(space.spaceId)}`)
                    }
                  >
                    <div className="flex items-start gap-4">
                      <AppAvatar
                        name={space.name || space.partnerUserId}
                        className="h-12 w-12"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="truncate text-[15px] font-semibold text-text">
                            {space.name}
                          </h3>
                          <div className="text-xs text-text-muted">
                            {formatTimestamp(space.timestamp)}
                          </div>
                        </div>
                        <p className="mt-1 truncate text-sm text-text-muted">
                          {space.preview}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                          <span>{space.partnerUserId}</span>
                          <span>{space.roomCount} threads</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </ListPageLayout>
    </>
  );
}

export default Home;
