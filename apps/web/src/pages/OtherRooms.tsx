import { IonButton, IonIcon, IonSearchbar } from '@ionic/react';
import { ellipsisHorizontal } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppMenu, EncryptionSetupModal } from '../components';
import { ChatListSection, ListPageLayout } from '../components/ionic';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useOtherChatCatalogStore } from '../hooks/useOtherChatCatalogStore';
import {
  loadDesktopLastSelection,
  saveDesktopRailState,
} from '../lib/desktopShell';
import { recordLayoutDebugEvent } from '../lib/layoutDebug';

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
    bootstrapUserId,
  } = useMatrixClient();
  const navigate = useNavigate();
  const isDesktopLayout = useMediaQuery('(min-width: 1280px)');
  const {
    data: otherChats,
    error: catalogError,
    isLoading: isLoadingOtherRooms,
  } = useOtherChatCatalogStore({
    client,
    enabled: Boolean(user),
    isReady,
    userId: user?.userId ?? null,
  });
  const [search, setSearch] = useState('');
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const persistedUserId = user?.userId ?? bootstrapUserId;

  const visibleChats = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    const chats = otherChats;

    if (!searchValue) {
      return chats;
    }

    return chats.filter((chat) => {
      return (
        chat.name.toLowerCase().includes(searchValue) ||
        chat.preview.toLowerCase().includes(searchValue)
      );
    });
  }, [otherChats, search]);

  useEffect(() => {
    if (!isDesktopLayout || !persistedUserId || otherChats.length === 0) {
      return;
    }

    const { lastRoomId } = loadDesktopLastSelection(persistedUserId);
    const selectedChat =
      otherChats.find((chat) => chat.id === lastRoomId) ?? otherChats[0] ?? null;
    if (!selectedChat) {
      return;
    }

    recordLayoutDebugEvent('OtherRooms.desktopRedirect', {
      isDesktopLayout,
      otherChatCount: otherChats.length,
      persistedUserId,
      selectedRoomId: selectedChat.id,
    });
    saveDesktopRailState({
      userId: persistedUserId,
      railView: 'other',
    });
    navigate(`/room/${encodeURIComponent(selectedChat.id)}`, { replace: true });
  }, [isDesktopLayout, navigate, otherChats, persistedUserId]);

  if (isDesktopLayout && (isLoadingOtherRooms || otherChats.length > 0)) {
    return null;
  }

  return (
    <>
      <ListPageLayout
        title="Other"
        endSlot={
          <IonButton
            fill="clear"
            color="medium"
            onClick={() => setShowMenu(true)}
          >
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
          <div className="px-4 pb-2 text-sm text-danger">
            {error || catalogError}
          </div>
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
