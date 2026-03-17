import {
  chevronForwardOutline,
  colorPaletteOutline,
  notificationsOutline,
  personCircleOutline,
  phonePortraitOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { AppAvatar, Card, NotificationSettingsPanel, SegmentedControl } from '../../components';
import { useBrowserNotificationSettings } from '../../hooks/useBrowserNotifications';
import { useChatPreferences } from '../../hooks/useChatPreferences';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { cn } from '../../lib/cn';

export type DesktopSettingsSection =
  | 'menu'
  | 'notifications'
  | 'encryption'
  | 'account'
  | 'devices'
  | 'chat-appearance';

interface DesktopSettingsPanelProps {
  section: DesktopSettingsSection;
  onSelectSection: (section: Exclude<DesktopSettingsSection, 'menu'>) => void;
  onOpenRoute: (path: string) => void;
}

const settingsItems: Array<{
  id: Exclude<DesktopSettingsSection, 'menu'>;
  title: string;
  icon: string;
}> = [
  { id: 'notifications', title: 'Notifications', icon: notificationsOutline },
  { id: 'encryption', title: 'Encryption', icon: shieldCheckmarkOutline },
  { id: 'account', title: 'Manage account', icon: personCircleOutline },
  { id: 'devices', title: 'Manage devices', icon: phonePortraitOutline },
  { id: 'chat-appearance', title: 'Chat appearance', icon: colorPaletteOutline },
];

function SettingsRow({
  title,
  icon,
  onClick,
}: {
  title: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-elevated/70"
      onClick={onClick}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-text-muted">
        <IonIcon icon={icon} className="text-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium text-text">{title}</div>
      </div>
      <IonIcon icon={chevronForwardOutline} className="text-lg text-text-subtle" />
    </button>
  );
}

function DesktopSettingsPanel({
  section,
  onSelectSection,
  onOpenRoute,
}: DesktopSettingsPanelProps) {
  const { client, user, bootstrapUserId } = useMatrixClient();
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

  const currentUserProfile = user ? (client?.getUser(user.userId) ?? null) : null;
  const currentUserName = currentUserProfile?.displayName || user?.userId || 'User';
  const currentUserAvatarUrl = currentUserProfile?.avatarUrl
    ? (client?.mxcUrlToHttp(currentUserProfile.avatarUrl, 96, 96, 'crop') ?? null)
    : null;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          'absolute inset-0 overflow-y-auto px-3 py-3 transition-transform duration-300 ease-out',
          section === 'menu' ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Card className="mb-3">
          <div className="flex items-center gap-3">
            <AppAvatar
              name={currentUserName}
              avatarUrl={currentUserAvatarUrl}
              className="h-11 w-11"
              textClassName="text-sm"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text">
                {currentUserName}
              </div>
              {user ? (
                <div className="truncate text-xs text-text-muted">{user.userId}</div>
              ) : null}
            </div>
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
        {section !== 'menu' ? (
          <>
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
                        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-text-inverse"
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
                        {notificationsEnabled ? 'Mute browser alerts' : 'Unmute browser alerts'}
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
              <div className="space-y-4">
                <Card tone="accent">
                  <h3 className="text-base font-semibold text-text">Encryption tools</h3>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    Recovery keys, trust status, and device verification are still
                    using the dedicated settings flow.
                  </p>
                </Card>
                <Card>
                  <button
                    type="button"
                    className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-text-inverse"
                    onClick={() => onOpenRoute('/menu/encryption')}
                  >
                    Open encryption settings
                  </button>
                </Card>
              </div>
            ) : null}

            {section === 'account' ? (
              <div className="space-y-4">
                <Card>
                  <div className="flex items-center gap-3">
                    <AppAvatar
                      name={currentUserName}
                      avatarUrl={currentUserAvatarUrl}
                      className="h-12 w-12"
                      textClassName="text-base"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-text">
                        {currentUserName}
                      </div>
                      {user ? (
                        <div className="truncate text-sm text-text-muted">{user.userId}</div>
                      ) : null}
                    </div>
                  </div>
                </Card>
                <Card tone="muted">
                  <p className="text-sm leading-6 text-text-muted">
                    Account management tools still live in the full settings flow.
                  </p>
                  <button
                    type="button"
                    className="mt-4 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm font-medium text-text"
                    onClick={() => onOpenRoute('/menu/account')}
                  >
                    Open account tools
                  </button>
                </Card>
              </div>
            ) : null}

            {section === 'devices' ? (
              <div className="space-y-4">
                <Card tone="muted">
                  <h3 className="text-base font-semibold text-text">Devices</h3>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    Session management and verification details still live in the
                    full settings flow.
                  </p>
                  <button
                    type="button"
                    className="mt-4 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm font-medium text-text"
                    onClick={() => onOpenRoute('/menu/devices')}
                  >
                    Open device tools
                  </button>
                </Card>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default DesktopSettingsPanel;
