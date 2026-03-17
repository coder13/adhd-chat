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
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface SettingsPageShellProps {
  title: string;
  backTo: string;
  children: ReactNode;
}

function SettingsPageShell({
  title,
  backTo,
  children,
}: SettingsPageShellProps) {
  const navigate = useNavigate();

  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar">
          <IonButtons slot="start">
            <IonButton fill="clear" onClick={() => navigate(backTo)}>
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle className="text-[28px] font-semibold">{title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-list-page">
        <div className="space-y-4 px-4 py-4">{children}</div>
      </IonContent>
    </IonPage>
  );
}

export default SettingsPageShell;
