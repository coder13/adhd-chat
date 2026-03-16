import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonToolbar } from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { ClientEvent, type RoomMember } from 'matrix-js-sdk';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppAvatar, Card } from '../components';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useMatrixClient } from '../hooks/useMatrixClient';

interface TandemSpaceMemberSummary {
  userId: string;
  displayName: string;
  membership: string;
}

async function buildTandemSpaceMembers(spaceId: string, client: NonNullable<ReturnType<typeof useMatrixClient>['client']>) {
  const room = client.getRoom(spaceId);
  if (!room) {
    throw new Error('Tandem space not found.');
  }

  await room.loadMembersIfNeeded();

  return room
    .getMembers()
    .filter((member) => member.membership !== 'leave' && member.membership !== 'ban')
    .map((member: RoomMember) => ({
      userId: member.userId,
      displayName: member.name || member.userId,
      membership: member.membership || 'join',
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function getMemberStatusLabel(membership: string) {
  switch (membership) {
    case 'join':
      return 'Joined';
    case 'invite':
      return 'Invited';
    case 'knock':
      return 'Requested';
    default:
      return membership;
  }
}

function TandemSpaceMembersPage() {
  const { spaceId: encodedSpaceId } = useParams<{ spaceId: string }>();
  const spaceId = encodedSpaceId ? decodeURIComponent(encodedSpaceId) : null;
  const navigate = useNavigate();
  const { client, isReady, user } = useMatrixClient();
  const {
    data: members,
    error,
    isLoading,
    refresh,
  } = usePersistedResource<TandemSpaceMemberSummary[]>({
    cacheKey:
      user?.userId && spaceId ? `space-members:${user.userId}:${spaceId}` : null,
    enabled: Boolean(client && user && isReady && spaceId),
    initialValue: [],
    load: async () => buildTandemSpaceMembers(spaceId!, client!),
  });

  useEffect(() => {
    if (!client || !user || !isReady || !spaceId) {
      return;
    }

    client.on(ClientEvent.Sync, refresh);

    return () => {
      client.off(ClientEvent.Sync, refresh);
    };
  }, [client, isReady, refresh, spaceId, user]);

  if (!spaceId) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <div className="flex min-h-screen items-center justify-center text-text">
            No Tandem space selected.
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
              Please <Link to="/login" className="text-accent">log in</Link> to view space members.
            </p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar">
          <IonButtons slot="start">
            <IonButton fill="clear" onClick={() => navigate(`/tandem/space/${encodeURIComponent(spaceId)}`)}>
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <div className="px-2 text-[15px] font-semibold text-text">Members</div>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="app-list-page">
        <div className="space-y-4 px-4 py-4">
          <Card tone="accent">
            <h2 className="text-lg font-semibold text-text">People in this Tandem space</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              These are the current members and invitees for this shared Tandem home.
            </p>
          </Card>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-text-muted">Loading members...</div>
          ) : error ? (
            <div className="py-6 text-center text-sm text-danger">{error}</div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <Card key={member.userId}>
                  <div className="flex items-center gap-3">
                    <AppAvatar
                      name={member.displayName}
                      className="h-11 w-11"
                      textClassName="text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-text">
                        {member.displayName}
                      </div>
                      <div className="truncate text-xs text-text-muted">{member.userId}</div>
                    </div>
                    <div className="shrink-0 text-xs font-medium text-text-muted">
                      {getMemberStatusLabel(member.membership)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

export default TandemSpaceMembersPage;
