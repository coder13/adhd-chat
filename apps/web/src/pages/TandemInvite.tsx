import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppAvatar, Button, Card } from '../components';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useTandem } from '../hooks/useTandem';
import { getInviteLinkPayloadFromSearchParams } from '../lib/matrix/tandem';

function TandemInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { client, isReady, user } = useMatrixClient();
  const { incomingInvites, acceptInvite, declineInvite, ensureInviteFromLink, busyInviteId, error } =
    useTandem(client, user?.userId);
  const [pageError, setPageError] = useState<string | null>(null);

  const linkPayload = useMemo(
    () => getInviteLinkPayloadFromSearchParams(searchParams),
    [searchParams]
  );

  const invite = useMemo(() => {
    if (!linkPayload) {
      return null;
    }

    return (
      incomingInvites.find((entry) => entry.inviteId === linkPayload.inviteId) ?? null
    );
  }, [incomingInvites, linkPayload]);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    ensureInviteFromLink(searchParams).catch((cause) => {
      setPageError(cause instanceof Error ? cause.message : String(cause));
    });
  }, [ensureInviteFromLink, isReady, searchParams, user]);

  const handleAccept = async () => {
    if (!invite) {
      return;
    }

    await acceptInvite(invite);
    navigate(`/room/${encodeURIComponent(invite.mainRoomId)}`);
  };

  const handleDecline = async () => {
    if (!invite) {
      return;
    }

    await declineInvite(invite);
  };

  const redirectTarget = encodeURIComponent(
    `${window.location.pathname}${window.location.search}`
  );

  if (!linkPayload) {
    return (
      <IonPage className="app-shell">
        <IonHeader className="ion-no-border">
          <IonToolbar className="app-toolbar px-1">
            <IonTitle className="text-[28px] font-semibold">Tandem Invite</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="app-list-page">
          <div className="px-4 py-6">
            <Card>
              <h2 className="text-xl font-semibold text-text">Invite link is invalid</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                This link is missing required Tandem invite information.
              </p>
            </Card>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!isReady || !user) {
    return (
      <IonPage className="app-shell">
        <IonHeader className="ion-no-border">
          <IonToolbar className="app-toolbar px-1">
            <IonTitle className="text-[28px] font-semibold">Tandem Invite</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="app-list-page">
          <div className="px-4 py-6">
            <Card tone="accent">
              <h2 className="text-xl font-semibold text-text">Sign in to join Tandem</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                {linkPayload.inviter} created a Tandem home for you. Sign in or create an
                account with your Matrix homeserver, then come back to join the private
                space.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to={`/login?redirect=${redirectTarget}`}>
                  <Button>Log in</Button>
                </Link>
                <Link to={`/register?redirect=${redirectTarget}`}>
                  <Button variant="outline">Create account</Button>
                </Link>
              </div>
            </Card>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const isWrongUser = linkPayload.invitee !== user.userId;
  const inviteError = pageError || error;
  const isBusy = busyInviteId === invite?.inviteId;
  const isAccepted = invite?.status === 'accepted';
  const isDeclined = invite?.status === 'declined';

  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar px-1">
          <IonTitle className="text-[28px] font-semibold">Tandem Invite</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-list-page">
        <div className="px-4 py-6">
          <Card tone="accent">
            <div className="flex items-center gap-4">
              <AppAvatar
                name={invite?.inviterMatrixId ?? linkPayload.inviter}
                className="h-14 w-14"
                textClassName="text-lg"
              />
              <div>
                <h2 className="text-xl font-semibold text-text">Join your Tandem home</h2>
                <p className="mt-1 text-sm text-text-muted">
                  Invited by {invite?.inviterMatrixId ?? linkPayload.inviter}
                </p>
              </div>
            </div>

            {invite?.message && (
              <p className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm leading-6 text-text">
                {invite.message}
              </p>
            )}

            <div className="mt-4 text-sm leading-6 text-text-muted">
              <p>Space: {invite?.spaceId ?? linkPayload.spaceId}</p>
              <p>Main chat: {invite?.mainRoomId ?? linkPayload.roomId}</p>
            </div>

            {isWrongUser && (
              <p className="mt-4 text-sm text-danger">
                This invite was addressed to {linkPayload.invitee}. You are signed in as{' '}
                {user.userId}.
              </p>
            )}

            {inviteError && <p className="mt-4 text-sm text-danger">{inviteError}</p>}
            {isAccepted && (
              <p className="mt-4 text-sm text-success">
                You already joined this Tandem home.
              </p>
            )}
            {isDeclined && (
              <p className="mt-4 text-sm text-medium">You declined this invite.</p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={handleAccept}
                disabled={!invite || isWrongUser || isBusy || isAccepted || isDeclined}
              >
                {isBusy ? 'Joining...' : isAccepted ? 'Joined' : 'Join Tandem'}
              </Button>
              <Button
                variant="outline"
                onClick={handleDecline}
                disabled={!invite || isWrongUser || isBusy || isAccepted || isDeclined}
              >
                Decline
              </Button>
              {isAccepted && invite && (
                <IonButton
                  fill="clear"
                  onClick={() => navigate(`/room/${encodeURIComponent(invite.mainRoomId)}`)}
                >
                  Open main chat
                </IonButton>
              )}
            </div>
          </Card>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default TandemInvitePage;
