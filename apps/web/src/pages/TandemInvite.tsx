import {
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppAvatar, AuthFallbackState, Button, Card } from '../components';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useTandem } from '../hooks/useTandem';
import { getInviteLinkPayloadFromSearchParams } from '../lib/matrix/tandem';
import { getTandemPartnerSummary } from '../lib/matrix/tandemPresentation';

function TandemInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { client, isReady, state, user } = useMatrixClient();
  const {
    incomingInvites,
    acceptInvite,
    declineInvite,
    ensureInviteFromLink,
    recoverRelationships,
    busyInviteId,
    error,
  } = useTandem(client, user?.userId);
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
      incomingInvites.find(
        (entry) => entry.inviteId === linkPayload.inviteId
      ) ?? null
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
    await recoverRelationships();
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
            <IonTitle className="text-[28px] font-semibold">
              Tandem Invite
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="app-list-page">
          <div className="px-4 py-6">
            <Card>
              <h2 className="text-xl font-semibold text-text">
                Invite link is invalid
              </h2>
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
            <IonTitle className="text-[28px] font-semibold">
              Tandem Invite
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="app-list-page">
          <AuthFallbackState
            state={state}
            signedOutTitle="Sign in to join Tandem"
            signedOutMessage={
              <>
                {linkPayload.inviter} created a shared hub for you. Sign in or
                create an account, then come back to join it.
              </>
            }
            signedOutActions={
              <>
                <Link to={`/login?redirect=${redirectTarget}`}>
                  <Button>Log in</Button>
                </Link>
                <Link to={`/register?redirect=${redirectTarget}`}>
                  <Button variant="outline">Create account</Button>
                </Link>
              </>
            }
          />
        </IonContent>
      </IonPage>
    );
  }

  const isWrongUser = linkPayload.invitee !== user.userId;
  const inviteError = pageError || error;
  const isBusy = busyInviteId === invite?.inviteId;
  const isAccepted = invite?.status === 'accepted';
  const isDeclined = invite?.status === 'declined';
  const partner = getTandemPartnerSummary(client, invite?.inviterMatrixId ?? linkPayload.inviter);

  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar px-1">
          <IonTitle className="text-[28px] font-semibold">
            Tandem Invite
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-list-page">
        <div className="px-4 py-6">
          <Card tone="accent">
            <div className="flex items-center gap-4">
              <AppAvatar
                name={partner.displayName}
                avatarUrl={
                  partner.avatarUrl
                    ? client?.mxcUrlToHttp(partner.avatarUrl, 96, 96, 'crop') ??
                      null
                    : null
                }
                className="h-14 w-14"
                textClassName="text-lg"
              />
              <div>
                <h2 className="text-xl font-semibold text-text">
                  Join your shared hub
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {partner.displayName} wants to build a private place for the two of you.
                </p>
              </div>
            </div>

            {invite?.message && (
              <p className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm leading-6 text-text">
                {invite.message}
              </p>
            )}

            <div className="mt-4 rounded-2xl border border-line bg-panel/70 px-4 py-4 text-sm leading-6 text-text-muted">
              <p>This hub gives you one shared home together.</p>
              <p className="mt-2">Inside it, you can keep separate topics for ongoing parts of life like plans, errands, trips, or finances.</p>
            </div>

            {isWrongUser && (
              <p className="mt-4 text-sm text-danger">
                This invite was addressed to {linkPayload.invitee}. You are
                signed in as {user.userId}.
              </p>
            )}

            {inviteError && (
              <p className="mt-4 text-sm text-danger">{inviteError}</p>
            )}
            {isAccepted && (
              <p className="mt-4 text-sm text-success">
                You already joined this shared hub.
              </p>
            )}
            {isDeclined && (
              <p className="mt-4 text-sm text-medium">
                You declined this invite.
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={handleAccept}
                disabled={
                  !invite || isWrongUser || isBusy || isAccepted || isDeclined
                }
              >
                {isBusy ? 'Joining...' : isAccepted ? 'Joined' : 'Join hub'}
              </Button>
              <Button
                variant="outline"
                onClick={handleDecline}
                disabled={
                  !invite || isWrongUser || isBusy || isAccepted || isDeclined
                }
              >
                Decline
              </Button>
              {isAccepted && invite && (
                <IonButton
                  fill="clear"
                  onClick={() =>
                    navigate(`/room/${encodeURIComponent(invite.mainRoomId)}`)
                  }
                >
                  Open main topic
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
