import { IonActionSheet } from '@ionic/react';

interface AppMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEncryption: () => void;
  onLogout: () => void | Promise<void>;
}

function AppMenu({
  isOpen,
  onClose,
  onOpenEncryption,
  onLogout,
}: AppMenuProps) {
  return (
    <IonActionSheet
      isOpen={isOpen}
      onDidDismiss={onClose}
      header="More"
      cssClass="app-action-sheet"
      buttons={[
        {
          text: 'Encryption settings',
          cssClass: 'app-action-primary',
          handler: onOpenEncryption,
        },
        {
          text: 'Log out',
          role: 'destructive',
          cssClass: 'app-action-danger',
          handler: () => {
            void onLogout();
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
        },
      ]}
    />
  );
}

export default AppMenu;
