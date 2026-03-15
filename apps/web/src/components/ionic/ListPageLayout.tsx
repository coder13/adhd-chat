import {
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { PropsWithChildren, ReactNode } from 'react';
import BottomNav from '../navigation/BottomNav';

interface ListPageLayoutProps extends PropsWithChildren {
  title: string;
  endSlot?: ReactNode;
}

function ListPageLayout({ title, endSlot, children }: ListPageLayoutProps) {
  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar px-1">
          <IonTitle className="text-[28px] font-semibold">{title}</IonTitle>
          {endSlot && <IonButtons slot="end">{endSlot}</IonButtons>}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-list-page">
        {children}
      </IonContent>
      <BottomNav />
    </IonPage>
  );
}

export default ListPageLayout;
