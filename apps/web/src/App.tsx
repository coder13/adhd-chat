import { Route, Routes } from 'react-router-dom';
import { IonApp } from '@ionic/react';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Room from './pages/Room';
import AuthCallback from './pages/AuthCallback';
import Contacts from './pages/Contacts';
import OtherRooms from './pages/OtherRooms';
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
