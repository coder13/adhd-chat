import { useEffect } from 'react';
import { Button, Card, DeviceVerificationPanel } from '../../components';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useOwnMatrixDevices } from './useOwnMatrixDevices';

interface DesktopDevicesPanelProps {
  deviceId: string | null;
  onOpenUnverifiedDevices: () => void;
}

export default function DesktopDevicesPanel({
  deviceId,
  onOpenUnverifiedDevices,
}: DesktopDevicesPanelProps) {
  const { devices, error, refresh } = useOwnMatrixDevices();
  const {
    deviceVerification,
    startDeviceVerificationUnlock,
    startSasDeviceVerification,
    confirmSasDeviceVerification,
    cancelDeviceVerification,
  } = useMatrixClient();
  const currentSession =
    devices.find((device) => device.deviceId === deviceId) ?? devices[0] ?? null;
  const unverifiedDevices = devices.filter(
    (device) => device.deviceId !== deviceId && !device.isVerified
  );

  useEffect(() => {
    if (deviceVerification.status !== 'done') {
      return;
    }

    void refresh();
  }, [deviceVerification.status, refresh]);

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-text">Link new device</h3>
          <p className="mt-1 text-sm text-text-muted">
            Add another Matrix client to this account.
          </p>
        </div>
        <Button variant="outline" disabled>
          Show QR code
        </Button>
      </Card>

      {currentSession ? (
        <Card className="space-y-2">
          <div className="text-base font-semibold text-text">
            {currentSession.sessionLabel}
          </div>
          <div className="text-sm text-text-muted">
            {[
              currentSession.verificationLabel,
              formatLastActivity(currentSession.lastSeenTs),
              currentSession.lastSeenIp,
              currentSession.deviceId,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-text">Verify this session</h3>
          <p className="mt-1 text-sm leading-6 text-text-muted">
            Approve this browser from another already trusted Matrix device to
            unlock encrypted history without using your recovery key.
          </p>
        </div>
        <DeviceVerificationPanel
          verification={deviceVerification}
          onStart={startDeviceVerificationUnlock}
          onStartSas={startSasDeviceVerification}
          onConfirmSas={confirmSasDeviceVerification}
          onCancel={cancelDeviceVerification}
        />
      </Card>

      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-text">Unverified devices</h3>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              {unverifiedDevices.length === 0
                ? 'All other sessions are verified.'
                : `${unverifiedDevices.length} unverified ${
                    unverifiedDevices.length === 1 ? 'device' : 'devices'
                  } need attention.`}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={onOpenUnverifiedDevices}
            disabled={unverifiedDevices.length === 0}
          >
            View
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        {error ? <div className="text-sm text-danger">{error}</div> : null}
      </Card>
    </div>
  );
}

function formatLastActivity(timestamp: number | null) {
  if (!timestamp) {
    return 'Last activity unknown';
  }

  return `Last activity ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)}`;
}
