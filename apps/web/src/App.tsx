import { Route, Routes } from 'react-router-dom';
import { IonApp } from '@ionic/react';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Room from './pages/Room';
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
import {
  BrowserInteractiveAuthModal,
  InteractiveAuthModal,
  SecretStorageKeyModal,
} from './components';
import { useBrowserInteractiveAuthRequest } from './hooks/useBrowserInteractiveAuthRequest';
import { useSecretStorageKeyRequest } from './hooks/useSecretStorageKeyRequest';
import { useInteractiveAuthRequest } from './hooks/useInteractiveAuthRequest';
import { MatrixClientProvider } from './hooks/useMatrixClient';

function App() {
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

  return (
    <MatrixClientProvider>
      <IonApp>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/other" element={<OtherRooms />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/new" element={<AddContactPage />} />
          <Route path="/menu" element={<UserMenuPage />} />
          <Route path="/menu/:section" element={<UserMenuStubPage />} />
          <Route path="/tandem/invite" element={<TandemInvitePage />} />
          <Route path="/tandem/space/:spaceId" element={<TandemSpacePage />} />
          <Route path="/tandem/space/:spaceId/members" element={<TandemSpaceMembersPage />} />
          <Route path="/tandem/rooms/new" element={<TandemCreateRoomPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/room/:roomId" element={<Room />} />
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
    </MatrixClientProvider>
  );
}

export default App;
