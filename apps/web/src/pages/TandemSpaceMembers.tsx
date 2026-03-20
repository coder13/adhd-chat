import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonToolbar,
} from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { ClientEvent, RoomEvent, RoomMemberEvent } from 'matrix-js-sdk';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppAvatar, AuthFallbackState, Card } from '../components';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useTandem } from '../hooks/useTandem';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { shouldSuppressMissingTandemSpaceError } from '../lib/matrix/restoreErrors';
import {
  buildTandemSpaceMemberSummaries,
  loadTandemSpaceMemberSummaries,
  type TandemSpaceMemberSummary,
} from '../lib/matrix/tandemSpaceMembers';
import { getTandemPartnerSummary } from '../lib/matrix/tandemPresentation';

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
  const { client, isReady, state, user, bootstrapUserId } = useMatrixClient();
  const cacheUserId = user?.userId ?? bootstrapUserId;
  const { relationships } = useTandem(client, cacheUserId);
  const {
    data: members,
    error,
    isLoading,
    refresh,
    updateData: updateMembers,
    hasCachedData,
  } = usePersistedResource<TandemSpaceMemberSummary[]>({
    cacheKey:
      cacheUserId && spaceId
        ? `space-members:${cacheUserId}:${spaceId}`
        : null,
    enabled: Boolean(client && user && isReady && spaceId),
    initialValue: [],
    storage: 'indexeddb',
    load: async () => loadTandemSpaceMemberSummaries(spaceId!, client!),
  });
  const relationship =
    relationships.find((entry) => entry.sharedSpaceId === spaceId) ?? null;
  const partner = relationship
    ? getTandemPartnerSummary(client, relationship.partnerUserId)
    : null;
  const isLiveSession = Boolean(client && user && isReady);
  const canRenderCachedMembers =
    state === 'syncing' && Boolean(cacheUserId) && hasCachedData;
  const suppressMissingSpaceError = shouldSuppressMissingTandemSpaceError({
    error,
    hasCachedData,
    hasRelationship: Boolean(relationship),
    hasLiveSpaceRoom: Boolean(client?.getRoom(spaceId ?? undefined)),
    isAuthRestoring: state === 'syncing',
  });
  const visibleError = suppressMissingSpaceError ? null : error;
  const isRestoringMembers =
    isLoading || (suppressMissingSpaceError && members.length === 0);

  useEffect(() => {
    if (!client || !user || !isReady || !spaceId) {
      return;
    }

    const syncMembers = () => {
      const room = client.getRoom(spaceId);
      if (!room) {
        return;
      }

      updateMembers(buildTandemSpaceMemberSummaries(room));
    };

    const handleMembership = (
      _event: unknown,
      member: { roomId: string }
    ) => {
      if (member.roomId !== spaceId) {
        return;
      }

      syncMembers();
    };

    const handleName = (_event: unknown, member: { roomId: string }) => {
      if (member.roomId !== spaceId) {
        return;
      }

      syncMembers();
    };

    const handleMyMembership = (room: { roomId: string }) => {
      if (room.roomId !== spaceId) {
        return;
      }

      syncMembers();
    };

    client.on(RoomMemberEvent.Membership, handleMembership);
    client.on(RoomMemberEvent.Name, handleName);
    client.on(RoomEvent.MyMembership, handleMyMembership);

    return () => {
      client.off(RoomMemberEvent.Membership, handleMembership);
      client.off(RoomMemberEvent.Name, handleName);
      client.off(RoomEvent.MyMembership, handleMyMembership);
    };
  }, [client, isReady, spaceId, updateMembers, user]);

  useEffect(() => {
    if (!client || !user || !isReady || !spaceId || client.getRoom(spaceId)) {
      return;
    }

    const handleSync = () => {
      if (!client.getRoom(spaceId)) {
        return;
      }

      void refresh();
    };

    client.on(ClientEvent.Sync, handleSync);
    return () => {
      client.off(ClientEvent.Sync, handleSync);
    };
  }, [client, isReady, refresh, spaceId, user]);

  if (!spaceId) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <div className="flex min-h-screen items-center justify-center text-text">
            No Tandem hub selected.
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!isLiveSession && !canRenderCachedMembers) {
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
                to view hub members.
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
              onClick={() =>
                navigate(`/tandem/space/${encodeURIComponent(spaceId)}`)
              }
            >
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <div className="px-2 text-[15px] font-semibold text-text">
            Members
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="app-list-page">
        <div className="space-y-4 px-4 py-4">
          <Card tone="accent">
            <h2 className="text-lg font-semibold text-text">
              Everyone in this hub
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {partner
                ? `This shared hub belongs to you and ${partner.displayName}.`
                : 'These are the current members and invitees for this shared hub.'}
            </p>
          </Card>

          {isRestoringMembers ? (
            <div className="py-12 text-center text-sm text-text-muted">
              Restoring members...
            </div>
          ) : visibleError ? (
            <div className="py-6 text-center text-sm text-danger">{visibleError}</div>
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
                      <div className="truncate text-xs text-text-muted">
                        {member.userId === cacheUserId
                          ? 'You'
                          : partner && member.userId === partner.userId
                            ? 'Partner'
                            : member.userId}
                      </div>
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
