import { IonButton, IonFooter, IonIcon, IonLabel, IonToolbar } from '@ionic/react';
import { chatbubbleEllipsesOutline, gridOutline, peopleOutline } from 'ionicons/icons';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Chats', icon: chatbubbleEllipsesOutline },
  { path: '/other', label: 'Other', icon: gridOutline },
  { path: '/contacts', label: 'Contacts', icon: peopleOutline },
];

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <IonFooter className="app-bottom-nav ion-no-border">
      <IonToolbar className="app-bottom-nav">
        <div className="grid grid-cols-3 gap-1 px-2 pb-1 pt-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <IonButton
                key={item.path}
                fill="clear"
                color={isActive ? 'primary' : 'medium'}
                onClick={() => navigate(item.path)}
                className="h-14"
              >
                <div className="flex flex-col items-center gap-1 text-[11px] font-medium">
                  <IonIcon icon={item.icon} className="text-[22px]" />
                  <IonLabel>{item.label}</IonLabel>
                </div>
              </IonButton>
            );
          })}
        </div>
      </IonToolbar>
    </IonFooter>
  );
}

export default BottomNav;
