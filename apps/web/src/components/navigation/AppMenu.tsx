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
      buttons={[
        {
          text: 'Encryption settings',
          handler: onOpenEncryption,
        },
        {
          text: 'Log out',
          role: 'destructive',
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
