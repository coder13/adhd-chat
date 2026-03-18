import { Card } from '../../components';
import { useOwnMatrixDevices } from './useOwnMatrixDevices';

interface DesktopUnverifiedDevicesPanelProps {
  currentDeviceId: string | null;
}

export default function DesktopUnverifiedDevicesPanel({
  currentDeviceId,
}: DesktopUnverifiedDevicesPanelProps) {
  const { devices, isLoading, error } = useOwnMatrixDevices();
  const unverifiedDevices = devices.filter(
    (device) => device.deviceId !== currentDeviceId && !device.isVerified
  );

  if (isLoading && unverifiedDevices.length === 0) {
    return (
      <Card tone="muted">
        <div className="text-sm text-text-muted">Loading unverified devices...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card tone="muted">
        <div className="text-sm text-danger">{error}</div>
      </Card>
    );
  }

  if (unverifiedDevices.length === 0) {
    return (
      <Card>
        <div className="text-sm text-text-muted">
          No unverified devices right now.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {unverifiedDevices.map((device) => (
        <Card key={device.deviceId} className="space-y-2">
          <div className="text-base font-semibold text-text">
            {device.sessionLabel}
          </div>
          <div className="break-all text-sm text-text-muted">
            {device.deviceId}
          </div>
          <div className="text-sm text-text-muted">
            {[
              device.lastSeenIp,
              formatLastSeen(device.lastSeenTs),
              device.userAgent,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </Card>
      ))}
    </div>
  );
}

function formatLastSeen(timestamp: number | null) {
  if (!timestamp) {
    return 'Last activity unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}
