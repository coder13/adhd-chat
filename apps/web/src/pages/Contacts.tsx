import { IonButton, IonIcon, IonSearchbar } from '@ionic/react';
import { ellipsisHorizontal } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { AppMenu, EncryptionSetupModal } from '../components';
import { ContactsList, ListPageLayout } from '../components/ionic';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { buildContactCatalog, type ContactSummary } from '../lib/matrix/chatCatalog';

function Contacts() {
  const {
    client,
    isReady,
    user,
    error,
    handleGenerateRecoveryKey,
    getEncryptionSetupInfo,
    handleFinishEncryptionSetup,
    deviceVerification,
    startDeviceVerificationUnlock,
    startSasDeviceVerification,
    confirmSasDeviceVerification,
    cancelDeviceVerification,
    logout,
  } = useMatrixClient();
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!client || !user || !isReady) {
      setContacts([]);
      setContactsError(null);
      return;
    }

    let cancelled = false;

    const loadContacts = async () => {
      try {
        const nextContacts = await buildContactCatalog(client, user.userId);
        if (!cancelled) {
          setContacts(nextContacts);
          setContactsError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setContactsError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    };

    void loadContacts();

    return () => {
      cancelled = true;
    };
  }, [client, isReady, user]);

  const visibleContacts = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    if (!searchValue) {
      return contacts;
    }

    return contacts.filter((contact) => {
      return (
        contact.displayName.toLowerCase().includes(searchValue) ||
        contact.userId.toLowerCase().includes(searchValue)
      );
    });
  }, [contacts, search]);

  return (
    <>
      <ListPageLayout
        title="Contacts"
        endSlot={
          <IonButton fill="clear" color="medium" onClick={() => setShowMenu(true)}>
            <IonIcon slot="icon-only" icon={ellipsisHorizontal} />
          </IonButton>
        }
      >
        <div className="px-4 pb-2 pt-2">
          <IonSearchbar
            value={search}
            onIonInput={(event) => setSearch(event.detail.value ?? '')}
            placeholder="Search contacts"
            className="app-searchbar"
          />
        </div>
        {(error || contactsError) && (
          <div className="px-4 pb-2 text-sm text-danger">{error || contactsError}</div>
        )}
        <ContactsList contacts={visibleContacts} />
      </ListPageLayout>

      <AppMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        onOpenEncryption={() => {
          setShowMenu(false);
          setShowEncryptionModal(true);
        }}
        onLogout={logout}
      />

      <EncryptionSetupModal
        isOpen={showEncryptionModal}
        onClose={() => setShowEncryptionModal(false)}
        onSetupComplete={() => setShowEncryptionModal(false)}
        onLoadSetupInfo={getEncryptionSetupInfo}
        onGenerateKey={handleGenerateRecoveryKey}
        onFinishSetup={handleFinishEncryptionSetup}
        verification={deviceVerification}
        onStartDeviceVerification={startDeviceVerificationUnlock}
        onStartSasVerification={startSasDeviceVerification}
        onConfirmSasVerification={confirmSasDeviceVerification}
        onCancelDeviceVerification={cancelDeviceVerification}
      />
    </>
  );
}

export default Contacts;
