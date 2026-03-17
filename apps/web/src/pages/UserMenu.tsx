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
import {
  arrowBack,
  chevronForwardOutline,
  colorPaletteOutline,
  notificationsOutline,
  personCircleOutline,
  phonePortraitOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { AppAvatar } from '../components';
import { useMatrixClient } from '../hooks/useMatrixClient';

const menuItems = [
  {
    icon: notificationsOutline,
    title: 'Notifications',
    path: '/menu/notifications',
  },
  {
    icon: shieldCheckmarkOutline,
    title: 'Encryption',
    path: '/menu/encryption',
  },
  {
    icon: personCircleOutline,
    title: 'Manage account',
    path: '/menu/account',
  },
  {
    icon: phonePortraitOutline,
    title: 'Manage devices',
    path: '/menu/devices',
  },
  {
    icon: colorPaletteOutline,
    title: 'Chat appearance',
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
            <IonButton fill="clear" onClick={() => navigate('/')}>
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle className="text-[22px] font-semibold">Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-list-page">
        <div className="space-y-4 px-4 py-4">
          <div className="flex items-center gap-3 px-1">
            <AppAvatar
              name={currentUserName}
              avatarUrl={currentUserAvatarUrl}
              className="h-12 w-12"
              textClassName="text-base"
            />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-text">
                {currentUserName}
              </h2>
              {user ? (
                <p className="truncate text-sm text-text-muted">{user.userId}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                type="button"
                key={item.path}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-elevated/70"
                onClick={() => navigate(item.path)}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-text-muted">
                  <IonIcon
                    icon={item.icon}
                    className="text-[18px]"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-medium text-text">
                    {item.title}
                  </h3>
                </div>
                <IonIcon
                  icon={chevronForwardOutline}
                  className="text-lg text-text-subtle"
                />
              </button>
            ))}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default UserMenuPage;
