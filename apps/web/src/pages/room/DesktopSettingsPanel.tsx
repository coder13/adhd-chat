import { IonIcon } from '@ionic/react';
import {
  chevronForwardOutline,
  colorPaletteOutline,
  createOutline,
  notificationsOutline,
  personCircleOutline,
  phonePortraitOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import {
  AppAvatar,
  Card,
  NotificationSettingsPanel,
  SegmentedControl,
} from '../../components';
import { useCurrentUserProfileSummary } from '../../hooks/useCurrentUserProfileSummary';
import { useBrowserNotificationSettings } from '../../hooks/useBrowserNotifications';
import { useChatPreferences } from '../../hooks/useChatPreferences';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { cn } from '../../lib/cn';
import DesktopAccountPanel from './DesktopAccountPanel';
import DesktopDevicesPanel from './DesktopDevicesPanel';
import DesktopEncryptionPanel from './DesktopEncryptionPanel';
import DesktopProfilePanel from './DesktopProfilePanel';
import DesktopUnverifiedDevicesPanel from './DesktopUnverifiedDevicesPanel';

export type DesktopSettingsSection =
  | 'menu'
  | 'profile'
  | 'notifications'
  | 'encryption'
  | 'account'
  | 'devices'
  | 'unverified-devices'
  | 'chat-appearance';

interface DesktopSettingsPanelProps {
  section: DesktopSettingsSection;
  onSelectSection: (section: Exclude<DesktopSettingsSection, 'menu'>) => void;
}

const settingsItems: Array<{
  id: Exclude<DesktopSettingsSection, 'menu' | 'profile'>;
  title: string;
  icon: string;
}> = [
  { id: 'notifications', title: 'Notifications', icon: notificationsOutline },
  { id: 'chat-appearance', title: 'Chat appearance', icon: colorPaletteOutline },
  { id: 'encryption', title: 'Encryption', icon: shieldCheckmarkOutline },
  { id: 'account', title: 'Manage account', icon: personCircleOutline },
  { id: 'devices', title: 'Sessions', icon: phonePortraitOutline },
];

function SettingsRow({
  title,
  icon,
  subtitle,
  onClick,
}: {
  title: string;
  icon: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition-colors hover:bg-elevated/70"
      onClick={onClick}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-text-muted">
        <IonIcon icon={icon} className="text-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium text-text">{title}</div>
        {subtitle ? (
          <div className="truncate text-xs text-text-muted">{subtitle}</div>
        ) : null}
      </div>
      <IonIcon
        icon={chevronForwardOutline}
        className="text-lg text-text-subtle"
      />
    </button>
  );
}

function DesktopSettingsPanel({
  section,
  onSelectSection,
}: DesktopSettingsPanelProps) {
  const { client, user, bootstrapUserId, logout } = useMatrixClient();
  const {
    preferences,
    updateChatViewMode,
    updateAccountNotificationMode,
    isSaving,
    error,
  } = useChatPreferences(client, user?.userId ?? bootstrapUserId);
  const {
    isSupported: notificationsSupported,
    permission: notificationPermission,
    isEnabled: notificationsEnabled,
    isMuted: notificationsMuted,
    requestAccess,
    updateEnabled,
  } = useBrowserNotificationSettings();

  const currentUserProfile = useCurrentUserProfileSummary(
    client,
    user?.userId ?? bootstrapUserId,
    96
  );
  const currentUserName = currentUserProfile.name;
  const currentUserAvatarUrl = currentUserProfile.avatarUrl;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          'absolute inset-0 overflow-y-auto px-3 py-3 transition-transform duration-300 ease-out',
          section === 'menu' ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Card className="mb-4 overflow-hidden px-4 py-3">
          <div className="flex items-center gap-3">
            <AppAvatar
              name={currentUserName}
              avatarUrl={currentUserAvatarUrl}
              className="h-12 w-12 shrink-0"
              textClassName="text-base"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-text">
                {currentUserName}
              </div>
              {user ? (
                <div className="truncate text-sm text-text-muted">{user.userId}</div>
              ) : null}
            </div>
            <button
              type="button"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-elevated"
              onClick={() => onSelectSection('profile')}
            >
              <IonIcon icon={createOutline} className="text-base" />
              Edit
            </button>
          </div>
        </Card>

        <div className="space-y-1">
          {settingsItems.map((item) => (
            <SettingsRow
              key={item.id}
              title={item.title}
              icon={item.icon}
              onClick={() => onSelectSection(item.id)}
            />
          ))}
        </div>
      </div>

      <div
        className={cn(
          'absolute inset-0 overflow-y-auto px-3 py-3 transition-transform duration-300 ease-out',
          section === 'menu' ? 'translate-x-full' : 'translate-x-0'
        )}
      >
        {section === 'profile' ? (
          <DesktopProfilePanel
            currentUserName={currentUserName}
            currentUserAvatarUrl={currentUserAvatarUrl}
            currentUserId={user?.userId ?? null}
          />
        ) : null}

        {section === 'notifications' ? (
          <div className="space-y-4">
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-text">Browser alerts</h3>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    {notificationsSupported
                      ? notificationPermission === 'granted'
                        ? notificationsMuted
                          ? 'Browser alerts are allowed, but Tandem is muted in this browser.'
                          : 'Browser alerts are enabled for background activity.'
                        : notificationPermission === 'denied'
                          ? 'Notifications are blocked by this browser.'
                          : 'Turn on browser notifications for background messages.'
                      : 'This browser does not support notifications.'}
                  </p>
                </div>
                <div className="rounded-full bg-elevated px-3 py-1 text-xs font-medium text-text-muted">
                  {notificationsSupported
                    ? notificationPermission === 'granted'
                      ? notificationsEnabled
                        ? 'On'
                        : 'Muted'
                      : notificationPermission === 'denied'
                        ? 'Blocked'
                        : 'Off'
                    : 'Unavailable'}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {notificationsSupported && notificationPermission !== 'granted' ? (
                  <button
                    type="button"
                    className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
                    onClick={() => {
                      void requestAccess();
                    }}
                  >
                    Enable browser alerts
                  </button>
                ) : null}

                {notificationPermission === 'granted' ? (
                  <button
                    type="button"
                    className="rounded-full border border-line bg-panel px-4 py-2 text-sm font-medium text-text"
                    onClick={() => updateEnabled(!notificationsEnabled)}
                  >
                    {notificationsEnabled
                      ? 'Mute browser alerts'
                      : 'Unmute browser alerts'}
                  </button>
                ) : null}
              </div>
            </Card>

            <Card>
              <NotificationSettingsPanel
                title="Default notification behavior"
                body="This is your account-wide default. Hubs and topics can override it."
                value={preferences.accountNotificationMode}
                options={[
                  { label: 'All messages', value: 'all' },
                  { label: 'Muted', value: 'mute' },
                ]}
                onChange={(value) => {
                  void updateAccountNotificationMode(value);
                }}
                helper="Muted hubs or topics still show unread counts, but they won’t trigger browser alerts."
              />
            </Card>
          </div>
        ) : null}

        {section === 'chat-appearance' ? (
          <Card>
            <h3 className="text-base font-semibold text-text">Message layout</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Timeline keeps everything left-aligned. Bubbles separates your
              messages visually.
            </p>
            <div className="mt-4">
              <SegmentedControl
                value={preferences.chatViewMode}
                onChange={(value) => {
                  void updateChatViewMode(value as 'bubbles' | 'timeline');
                }}
                options={[
                  { label: 'Timeline', value: 'timeline' },
                  { label: 'Bubbles', value: 'bubbles' },
                ]}
              />
            </div>
            {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
            {isSaving ? (
              <p className="mt-3 text-sm text-text-muted">Saving preference...</p>
            ) : null}
          </Card>
        ) : null}

        {section === 'encryption' ? (
          <DesktopEncryptionPanel />
        ) : null}

        {section === 'account' ? (
          <DesktopAccountPanel
            currentUserName={currentUserName}
            currentUserId={user?.userId ?? null}
            onEditProfile={() => onSelectSection('profile')}
            onOpenDevices={() => onSelectSection('devices')}
            onOpenEncryption={() => onSelectSection('encryption')}
            onLogout={logout}
          />
        ) : null}

        {section === 'devices' ? (
          <DesktopDevicesPanel
            deviceId={user?.deviceId ?? null}
            onOpenUnverifiedDevices={() => onSelectSection('unverified-devices')}
          />
        ) : null}

        {section === 'unverified-devices' ? (
          <DesktopUnverifiedDevicesPanel
            currentDeviceId={user?.deviceId ?? null}
          />
        ) : null}
      </div>
    </div>
  );
}

export default DesktopSettingsPanel;
