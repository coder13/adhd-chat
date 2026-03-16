import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, NotificationSettingsPanel, SegmentedControl } from '../components';
import { useBrowserNotificationSettings } from '../hooks/useBrowserNotifications';
import { useChatPreferences } from '../hooks/useChatPreferences';
import { useMatrixClient } from '../hooks/useMatrixClient';

const copyBySection: Record<string, { title: string; body: string }> = {
  notifications: {
    title: 'Notifications',
    body: 'Control background alerts and your default notification behavior.',
  },
  encryption: {
    title: 'Encryption',
    body: 'Encryption settings and recovery controls will live here. For now this is a stub page.',
  },
  account: {
    title: 'Manage Account',
    body: 'Account management tools will live here. For now this is a stub page.',
  },
  devices: {
    title: 'Manage Devices',
    body: 'Device sessions and verification tools will live here. For now this is a stub page.',
  },
  'chat-appearance': {
    title: 'Chat Appearance',
    body: 'Choose how conversations are rendered across your devices.',
  },
};

function UserMenuStubPage() {
  const navigate = useNavigate();
  const { section = '' } = useParams<{ section: string }>();
  const { client, user } = useMatrixClient();
  const {
    preferences,
    updateChatViewMode,
    updateAccountNotificationMode,
    isSaving,
    error,
  } =
    useChatPreferences(client, user?.userId);
  const {
    isSupported: notificationsSupported,
    permission: notificationPermission,
    isEnabled: notificationsEnabled,
    isMuted: notificationsMuted,
    requestAccess,
    updateEnabled,
  } = useBrowserNotificationSettings();

  const content = useMemo(() => {
    return (
      copyBySection[section] ?? {
        title: 'Settings',
        body: 'This settings page has not been defined yet.',
      }
    );
  }, [section]);

  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar">
          <IonButtons slot="start">
            <IonButton fill="clear" onClick={() => navigate('/menu')}>
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle className="text-[28px] font-semibold">
            {content.title}
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-list-page">
        <div className="space-y-4 px-4 py-4">
          <Card tone="accent">
            <h2 className="text-lg font-semibold text-text">{content.title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {content.body}
            </p>
          </Card>

          {section === 'notifications' && (
            <>
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-text">
                      Browser alerts
                    </h3>
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
                    <IonButton
                      fill="solid"
                      onClick={() => {
                        void requestAccess();
                      }}
                    >
                      Enable browser alerts
                    </IonButton>
                  ) : null}

                  {notificationPermission === 'granted' ? (
                    <IonButton
                      fill="outline"
                      onClick={() => updateEnabled(!notificationsEnabled)}
                    >
                      {notificationsEnabled ? 'Mute browser alerts' : 'Unmute browser alerts'}
                    </IonButton>
                  ) : null}
                </div>
              </Card>

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
                helper="Muted hubs or topics still show unread counts, but they won’t trigger Tandem browser alerts."
              />
            </>
          )}

          {section === 'chat-appearance' && (
            <Card>
              <h3 className="text-base font-semibold text-text">
                Message layout
              </h3>
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
              {error && <p className="mt-3 text-sm text-danger">{error}</p>}
              {isSaving && (
                <p className="mt-3 text-sm text-text-muted">
                  Saving preference...
                </p>
              )}
            </Card>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

export default UserMenuStubPage;
