import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppAvatar } from '..';
import { useCurrentUserProfileSummary } from '../../hooks/useCurrentUserProfileSummary';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import BottomNav from '../navigation/BottomNav';

interface ListPageLayoutProps extends PropsWithChildren {
  title: string;
  startSlot?: ReactNode;
  endSlot?: ReactNode;
  headerContent?: ReactNode;
}

function ListPageLayout({
  title,
  startSlot,
  endSlot,
  headerContent,
  children,
}: ListPageLayoutProps) {
  const navigate = useNavigate();
  const { client, user } = useMatrixClient();
  const currentUserProfile = useCurrentUserProfileSummary(client, user?.userId, 80);
  const currentUserName = currentUserProfile.name;
  const currentUserAvatarUrl = currentUserProfile.avatarUrl;

  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar px-1">
          <IonButtons slot="start">
            {startSlot ?? (
              <IonButton
                fill="clear"
                color="medium"
                onClick={() => navigate('/menu')}
              >
                <AppAvatar
                  name={currentUserName}
                  avatarUrl={currentUserAvatarUrl}
                  className="h-9 w-9"
                  textClassName="text-sm"
                />
              </IonButton>
            )}
          </IonButtons>
          <IonTitle className="text-[28px] font-semibold">{title}</IonTitle>
          {endSlot && <IonButtons slot="end">{endSlot}</IonButtons>}
        </IonToolbar>
        {headerContent && <div className="px-4 pb-2">{headerContent}</div>}
      </IonHeader>
      <IonContent fullscreen className="app-list-page">
        {children}
      </IonContent>
      <BottomNav />
    </IonPage>
  );
}

export default ListPageLayout;
