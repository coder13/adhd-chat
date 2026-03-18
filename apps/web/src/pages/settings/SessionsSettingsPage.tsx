import DesktopDevicesPanel from '../room/DesktopDevicesPanel';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import SettingsPageShell from './SettingsPageShell';

function SessionsSettingsPage() {
  const { user } = useMatrixClient();

  return (
    <SettingsPageShell title="Sessions" backTo="/menu">
      <DesktopDevicesPanel
        deviceId={user?.deviceId ?? null}
        onOpenUnverifiedDevices={() => {
          // The mobile settings route does not yet split this into a second screen.
        }}
      />
    </SettingsPageShell>
  );
}

export default SessionsSettingsPage;
