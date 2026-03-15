import { IonButton, IonIcon, IonSearchbar } from '@ionic/react';
import { ellipsisHorizontal } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { AppMenu, EncryptionSetupModal } from '../components';
import { ChatListSection, ListPageLayout } from '../components/ionic';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { buildChatCatalog, type ChatCatalog } from '../lib/matrix/chatCatalog';

function OtherRooms() {
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
  const [catalog, setCatalog] = useState<ChatCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!client || !user || !isReady) {
      setCatalog(null);
      return;
    }

    let cancelled = false;

    const loadCatalog = async () => {
      try {
        const nextCatalog = await buildChatCatalog(client, user.userId);
        if (!cancelled) {
          setCatalog(nextCatalog);
          setCatalogError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setCatalogError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    };

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [client, isReady, user]);

  const visibleChats = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    const chats = catalog?.otherChats ?? [];

    if (!searchValue) {
      return chats;
    }

    return chats.filter((chat) => {
      return (
        chat.name.toLowerCase().includes(searchValue) ||
        chat.preview.toLowerCase().includes(searchValue)
      );
    });
  }, [catalog, search]);

  return (
    <>
      <ListPageLayout
        title="Other"
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
            placeholder="Search rooms"
            className="app-searchbar"
          />
        </div>
        {(error || catalogError) && (
          <div className="px-4 pb-2 text-sm text-danger">{error || catalogError}</div>
        )}
        <ChatListSection
          chats={visibleChats}
          emptyTitle="No extra rooms"
          emptyBody="Rooms outside the main ADHD Chat flow show up here."
        />
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

export default OtherRooms;
