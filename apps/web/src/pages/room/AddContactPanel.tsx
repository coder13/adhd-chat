import { IonButton, IonIcon } from '@ionic/react';
import { closeOutline, copyOutline } from 'ionicons/icons';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { AppAvatar, Button, Card, Input } from '../../components';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useTandem } from '../../hooks/useTandem';
import type { TandemDiscoveredUser } from '../../lib/matrix/tandem';

export default function AddContactPanel() {
  const { client, user, isReady } = useMatrixClient();
  const {
    discoverUser,
    sendInvite,
    error: tandemError,
  } = useTandem(client, user?.userId);
  const [matrixId, setMatrixId] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [discoveredUser, setDiscoveredUser] =
    useState<TandemDiscoveredUser | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const handleDiscover = async () => {
    if (!client || !user || !isReady) {
      setError('Matrix is still connecting. Try again in a moment.');
      return;
    }

    setDiscovering(true);
    setError(null);
    setMessage(null);
    setInviteUrl(null);
    setCopyMessage(null);
    setDiscoveredUser(null);

    try {
      setDiscoveredUser(await discoverUser(matrixId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDiscovering(false);
    }
  };

  const handleLookupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleDiscover();
  };

  const handleSendInvite = async () => {
    if (!discoveredUser) {
      return;
    }

    setSendingInvite(true);
    setError(null);
    setMessage(null);

    try {
      const invite = await sendInvite({
        inviteeMatrixId: discoveredUser.userId,
        inviteeDisplayName: discoveredUser.displayName,
        message: inviteMessage,
      });
      setInviteUrl(invite.inviteUrl);
      setMessage('Invite sent. Share this link if needed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCloseInvite = () => {
    setDiscoveredUser(null);
    setInviteMessage('');
    setInviteUrl(null);
    setMessage(null);
    setError(null);
    setCopyMessage(null);
  };

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const input = document.createElement('input');
        input.value = inviteUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopyMessage('Link copied.');
    } catch {
      setCopyMessage(
        'Unable to copy automatically. Long-press the link to copy it.'
      );
    }
  };

  return (
    <div className="space-y-4 px-3 py-3">
      <Card tone="accent">
        <h2 className="text-lg font-semibold text-text">Invite by Matrix ID</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Look up a Matrix user, confirm their profile, then send both a native
          Tandem invite and an external join link.
        </p>
      </Card>

      <Card>
        <form className="space-y-3" onSubmit={handleLookupSubmit}>
          <Input
            label="Partner Matrix ID"
            value={matrixId}
            onChange={(event) => setMatrixId(event.target.value)}
            placeholder="@klyn:matrix.org"
            helperText={
              isReady
                ? 'Enter an exact Matrix ID and press Enter or tap Find user.'
                : 'Connecting to Matrix...'
            }
          />
          <Button
            type="submit"
            disabled={discovering || !matrixId.trim() || !isReady}
          >
            {discovering ? 'Looking up user...' : 'Find user'}
          </Button>
        </form>

        {discovering ? (
          <p className="mt-4 text-sm text-text-muted">
            Looking up {matrixId.trim()}...
          </p>
        ) : null}

        {(error || tandemError) && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-danger">
            {error || tandemError}
          </p>
        )}
        {message ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-success">
            {message}
          </p>
        ) : null}

        {discoveredUser ? (
          <div className="mt-5 rounded-[24px] border border-line/70 bg-panel/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <AppAvatar
                  name={discoveredUser.displayName ?? discoveredUser.userId}
                  avatarUrl={discoveredUser.avatarUrl}
                  className="h-14 w-14"
                  textClassName="text-lg"
                />
                <div>
                  <h3 className="text-base font-semibold text-text">
                    {discoveredUser.displayName ?? 'Matrix user found'}
                  </h3>
                  <p className="mt-1 text-sm text-text-muted">
                    {discoveredUser.userId}
                  </p>
                </div>
              </div>
              <IonButton fill="clear" color="medium" onClick={handleCloseInvite}>
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </div>
            <div className="mt-4">
              <Input
                label="Optional message"
                value={inviteMessage}
                onChange={(event) => setInviteMessage(event.target.value)}
                placeholder="Want to build our Tandem home?"
              />
            </div>
            {inviteUrl ? (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-text">
                  Share link
                </label>
                <div className="rounded-2xl border border-line bg-elevated px-4 py-3 text-sm text-text">
                  <p className="break-all">{inviteUrl}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyInviteLink}
                  >
                    <IonIcon icon={copyOutline} />
                    Copy link
                  </Button>
                  {copyMessage ? (
                    <p className="text-sm text-text-muted">{copyMessage}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={handleSendInvite} disabled={sendingInvite}>
                {sendingInvite ? 'Creating Tandem home...' : 'Submit'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseInvite}
              >
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
