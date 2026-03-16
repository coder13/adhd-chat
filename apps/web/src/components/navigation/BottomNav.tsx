import {
  IonFooter,
  IonIcon,
  IonToolbar,
} from '@ionic/react';
import { chatbubbleEllipsesOutline, peopleOutline } from 'ionicons/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/cn';

const navItems = [
  { path: '/', label: 'Chats', icon: chatbubbleEllipsesOutline },
  { path: '/contacts', label: 'Contacts', icon: peopleOutline },
];

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <IonFooter className="app-bottom-nav ion-no-border">
      <IonToolbar className="app-bottom-nav">
        <div className="px-3 pb-2 pt-2">
          <div className="app-nav-dock grid grid-cols-2 gap-2">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path === '/contacts' &&
                location.pathname.startsWith('/contacts'));

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={cn(
                  'app-nav-button app-pressable h-14',
                  isActive && 'is-active'
                )}
              >
                <div className="flex items-center justify-center gap-2 text-[12px] font-semibold">
                  <IonIcon icon={item.icon} className="text-[20px]" />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
          </div>
        </div>
      </IonToolbar>
    </IonFooter>
  );
}

export default BottomNav;
