import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '../../components';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import SettingsPageShell from './SettingsPageShell';

function EncryptionVerificationPage() {
  const navigate = useNavigate();
  const {
    deviceVerification,
    startDeviceVerificationUnlock,
    startSasDeviceVerification,
    confirmSasDeviceVerification,
    cancelDeviceVerification,
  } = useMatrixClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const title = useMemo(() => {
    switch (deviceVerification.status) {
      case 'waiting':
        return 'Check your other device';
      case 'ready':
      case 'starting_sas':
      case 'showing_sas':
      case 'confirming':
        return 'Confirm emojis';
      case 'done':
        return 'Encryption unlocked';
      default:
        return 'Verify this device';
    }
  }, [deviceVerification.status]);

  const handleBack = async () => {
    if (deviceVerification.status !== 'idle' && deviceVerification.status !== 'done') {
      await cancelDeviceVerification();
    }
    navigate('/menu/encryption');
  };

  const runAction = async (action: () => Promise<void>) => {
    setIsWorking(true);
    setActionError(null);
    try {
      await action();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <SettingsPageShell title={title} backTo="/menu/encryption">
      <Card>
        {deviceVerification.status === 'idle' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text">Use another device</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Send a verification request to one of your already signed-in devices to
                unlock encrypted history here.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void runAction(startDeviceVerificationUnlock)}
                disabled={isWorking}
              >
                {isWorking ? 'Sending request...' : 'Send verification request'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/menu/encryption')}>
                Back
              </Button>
            </div>
          </div>
        )}

        {deviceVerification.status === 'requesting' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-text">Sending request...</h2>
            <p className="text-sm leading-6 text-text-muted">
              Asking your other device to approve this browser.
            </p>
          </div>
        )}

        {deviceVerification.status === 'waiting' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-text">Check your other device</h2>
            <p className="text-sm leading-6 text-text-muted">
              Accept the verification request on your other device. Come back here once it
              says this browser is ready.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void handleBack()}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {deviceVerification.status === 'ready' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text">Compare emojis</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Your other device approved this browser. Open the emoji comparison to
                confirm both devices show the same symbols.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void runAction(startSasDeviceVerification)}
                disabled={isWorking}
              >
                {isWorking ? 'Opening emojis...' : 'Show emojis'}
              </Button>
              <Button variant="outline" onClick={() => void handleBack()}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {(deviceVerification.status === 'starting_sas' ||
          deviceVerification.status === 'confirming') && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-text">
              {deviceVerification.status === 'starting_sas'
                ? 'Opening emoji comparison...'
                : 'Finishing verification...'}
            </h2>
            <p className="text-sm leading-6 text-text-muted">
              Keep both devices open until the verification finishes.
            </p>
          </div>
        )}

        {deviceVerification.status === 'showing_sas' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text">Do these emojis match?</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Compare the emoji set on both devices. If they match, confirm to trust
                this browser.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {deviceVerification.emojis?.map((emoji) => (
                <div
                  key={`${emoji.symbol}-${emoji.name}`}
                  className="rounded-3xl bg-elevated px-3 py-4 text-center"
                >
                  <p className="text-3xl">{emoji.symbol}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void runAction(confirmSasDeviceVerification)}
                disabled={isWorking}
              >
                {isWorking ? 'Confirming...' : 'They match'}
              </Button>
              <Button variant="outline" onClick={() => void handleBack()}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {deviceVerification.status === 'done' && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-success-soft px-4 py-4">
              <h2 className="text-lg font-semibold text-success">This browser is verified</h2>
              <p className="mt-2 text-sm leading-6 text-success">
                Encrypted history can now be restored here from your secure backup.
              </p>
            </div>
            <Button
              onClick={async () => {
                await cancelDeviceVerification();
                navigate('/menu/encryption');
              }}
            >
              Done
            </Button>
          </div>
        )}

        {(deviceVerification.status === 'cancelled' ||
          deviceVerification.status === 'error') && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-danger-soft px-4 py-4">
              <h2 className="text-lg font-semibold text-danger">Verification didn&apos;t finish</h2>
              <p className="mt-2 text-sm leading-6 text-danger">
                {deviceVerification.error ?? 'Try sending the request again.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void runAction(startDeviceVerificationUnlock)}
                disabled={isWorking}
              >
                Try again
              </Button>
              <Button variant="outline" onClick={() => navigate('/menu/encryption')}>
                Back
              </Button>
            </div>
          </div>
        )}

        {actionError && (
          <p className="mt-4 text-sm text-danger">{actionError}</p>
        )}
      </Card>
    </SettingsPageShell>
  );
}

export default EncryptionVerificationPage;
