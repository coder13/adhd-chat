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
import { arrowBack, chevronForwardOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { AppAvatar, Card } from '../components';
import { useMatrixClient } from '../hooks/useMatrixClient';

const menuItems = [
  {
    title: 'Notifications',
    body: 'Tune alerts, reminders, and quiet hours.',
    path: '/menu/notifications',
  },
  {
    title: 'Encryption',
    body: 'Manage recovery keys, secure backup, and verification settings.',
    path: '/menu/encryption',
  },
  {
    title: 'Manage account',
    body: 'Review profile, session, and account-level controls.',
    path: '/menu/account',
  },
  {
    title: 'Manage devices',
    body: 'Inspect signed-in devices and verification status.',
    path: '/menu/devices',
  },
  {
    title: 'Chat appearance',
    body: 'Choose between timeline text and bubble-style rooms.',
    path: '/menu/chat-appearance',
  },
];

function UserMenuPage() {
  const navigate = useNavigate();
  const { client, user } = useMatrixClient();
  const currentUserProfile = user
    ? (client?.getUser(user.userId) ?? null)
    : null;
  const currentUserName =
    currentUserProfile?.displayName || user?.userId || 'User';
  const currentUserAvatarUrl = currentUserProfile?.avatarUrl
    ? (client?.mxcUrlToHttp(currentUserProfile.avatarUrl, 96, 96, 'crop') ??
      null)
    : null;

  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar">
          <IonButtons slot="start">
            <IonButton fill="clear" onClick={() => navigate(-1)}>
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle className="text-[28px] font-semibold">User Menu</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-list-page">
        <div className="space-y-4 px-4 py-4">
          <Card tone="accent">
            <div className="flex items-center gap-4">
              <AppAvatar
                name={currentUserName}
                avatarUrl={currentUserAvatarUrl}
                className="h-14 w-14"
                textClassName="text-lg"
              />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-text">
                  {currentUserName}
                </h2>
                {user && (
                  <p className="truncate text-sm text-text-muted">
                    {user.userId}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <h2 className="text-lg font-semibold text-text">
                Account and app controls
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                These sections are stubbed for now so the app has a stable
                settings navigation path.
              </p>
            </div>
          </Card>

          <div className="space-y-3">
            {menuItems.map((item) => (
              <Card
                key={item.path}
                className="cursor-pointer"
                onClick={() => navigate(item.path)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-text">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">{item.body}</p>
                  </div>
                  <IonIcon
                    icon={chevronForwardOutline}
                    className="text-xl text-text-muted"
                  />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default UserMenuPage;
