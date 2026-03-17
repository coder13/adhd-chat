import { useLayoutEffect, useRef } from 'react';
import { Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { IonApp } from '@ionic/react';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SearchPage from './pages/Search';
import Room from './pages/Room';
import RoomPinnedMessages from './pages/RoomPinnedMessages';
import AuthCallback from './pages/AuthCallback';
import Contacts from './pages/Contacts';
import AddContactPage from './pages/AddContact';
import OtherRooms from './pages/OtherRooms';
import TandemInvitePage from './pages/TandemInvite';
import TandemCreateRoomPage from './pages/TandemCreateRoom';
import TandemSpacePage from './pages/TandemSpace';
import TandemSpaceMembersPage from './pages/TandemSpaceMembers';
import UserMenuPage from './pages/UserMenu';
import UserMenuStubPage from './pages/UserMenuStub';
import EncryptionSettingsPage from './pages/settings/EncryptionSettingsPage';
import EncryptionVerificationPage from './pages/settings/EncryptionVerificationPage';
import {
  BrowserInteractiveAuthModal,
  InteractiveAuthModal,
  SecretStorageKeyModal,
} from './components';
import { useBrowserInteractiveAuthRequest } from './hooks/useBrowserInteractiveAuthRequest';
import { useSecretStorageKeyRequest } from './hooks/useSecretStorageKeyRequest';
import { useInteractiveAuthRequest } from './hooks/useInteractiveAuthRequest';
import { useBrowserNotifications } from './hooks/useBrowserNotifications';
import { useViewportMetrics } from './hooks/useViewportMetrics';
import { MatrixClientProvider } from './hooks/useMatrixClient';

function AppShell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const hasMountedRef = useRef(false);
  useBrowserNotifications();
  useViewportMetrics();
  const { isRequesting, handleProvideKey, handleCancel } =
    useSecretStorageKeyRequest();
  const {
    isRequesting: isRequestingInteractiveAuth,
    handleProvidePassword,
    handleCancel: handleCancelInteractiveAuth,
  } = useInteractiveAuthRequest();
  const {
    payload: browserInteractiveAuthPayload,
    handleContinue: handleContinueBrowserInteractiveAuth,
    handleCancel: handleCancelBrowserInteractiveAuth,
  } = useBrowserInteractiveAuthRequest();

  useLayoutEffect(() => {
    const root = document.documentElement;

    if (!hasMountedRef.current) {
      root.dataset.navDirection = 'initial';
      hasMountedRef.current = true;
      return;
    }

    root.dataset.navDirection = navigationType === 'POP' ? 'back' : 'forward';
  }, [location.key, navigationType]);

  return (
    <IonApp>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/room/:roomId/search" element={<SearchPage />} />
        <Route path="/other" element={<OtherRooms />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/contacts/new" element={<AddContactPage />} />
        <Route path="/menu" element={<UserMenuPage />} />
        <Route path="/menu/encryption" element={<EncryptionSettingsPage />} />
        <Route
          path="/menu/encryption/verify"
          element={<EncryptionVerificationPage />}
        />
        <Route path="/menu/:section" element={<UserMenuStubPage />} />
        <Route path="/tandem/invite" element={<TandemInvitePage />} />
        <Route path="/tandem/space/:spaceId" element={<TandemSpacePage />} />
        <Route
          path="/tandem/space/:spaceId/members"
          element={<TandemSpaceMembersPage />}
        />
        <Route path="/tandem/rooms/new" element={<TandemCreateRoomPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/room/:roomId/pins" element={<RoomPinnedMessages />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>

      <SecretStorageKeyModal
        isOpen={isRequesting}
        onProvideKey={handleProvideKey}
        onCancel={handleCancel}
      />
      <InteractiveAuthModal
        isOpen={isRequestingInteractiveAuth}
        onSubmit={handleProvidePassword}
        onCancel={handleCancelInteractiveAuth}
      />
      <BrowserInteractiveAuthModal
        isOpen={browserInteractiveAuthPayload !== null}
        title={browserInteractiveAuthPayload?.title ?? 'Complete Authentication'}
        description={browserInteractiveAuthPayload?.description ?? ''}
        url={browserInteractiveAuthPayload?.url ?? ''}
        onContinue={handleContinueBrowserInteractiveAuth}
        onCancel={handleCancelBrowserInteractiveAuth}
      />
    </IonApp>
  );
}

function App() {
  return (
    <MatrixClientProvider>
      <AppShell />
    </MatrixClientProvider>
  );
}

export default App;
