import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { Button, EncryptionSetupModal } from '../components';
import { RoomEvent, type Room } from 'matrix-js-sdk';
import type { EncryptionDiagnostics } from '../hooks/useMatrixClient';

function getRoomDisplayName(room: Room, userId: string) {
  const explicitName = room.name?.trim();
  if (explicitName && explicitName !== room.roomId) {
    return explicitName;
  }

  const canonicalAlias = room.getCanonicalAlias();
  if (canonicalAlias) {
    return canonicalAlias;
  }

  const generatedName = room.getDefaultRoomName(userId)?.trim();
  if (generatedName && generatedName !== room.roomId) {
    return generatedName;
  }

  return room.roomId;
}

function Home() {
  const {
    client,
    isReady,
    user,
    state,
    error,
    handleGenerateRecoveryKey,
    getEncryptionSetupInfo,
    getEncryptionDiagnostics,
    handleFinishEncryptionSetup,
    logout,
  } = useMatrixClient();
  const [rooms, setRooms] = useState<Array<{ id: string; name: string }>>([]);
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [encryptionDiagnostics, setEncryptionDiagnostics] =
    useState<EncryptionDiagnostics | null>(null);
  const [encryptionDiagnosticsError, setEncryptionDiagnosticsError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!client || !user) {
      setRooms([]);
      return;
    }

    let cancelled = false;

    const refreshRooms = async () => {
      const joinedRoomsResponse = await client.getJoinedRooms();
      const joinedRooms = joinedRoomsResponse.joined_rooms
        .map((roomId) => client.getRoom(roomId))
        .filter((room): room is Room => room !== null);

      await Promise.all(
        joinedRooms.map(async (room) => {
          try {
            await room.loadMembersIfNeeded();
          } catch (error) {
            console.error(`Failed to load members for room ${room.roomId}`, error);
          }
        })
      );

      if (cancelled) {
        return;
      }

      setRooms(
        joinedRooms.map((room) => ({
          id: room.roomId,
          name: getRoomDisplayName(room, user.userId),
        }))
      );
    };

    void refreshRooms();

    client.on(RoomEvent.Name, refreshRooms);

    return () => {
      cancelled = true;
      client.off(RoomEvent.Name, refreshRooms);
    };
  }, [client, user]);

  useEffect(() => {
    if (!client || !user) {
      setEncryptionDiagnostics(null);
      setEncryptionDiagnosticsError(null);
      return;
    }

    let cancelled = false;

    getEncryptionDiagnostics()
      .then((diagnostics) => {
        if (!cancelled) {
          setEncryptionDiagnostics(diagnostics);
          setEncryptionDiagnosticsError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setEncryptionDiagnostics(null);
          setEncryptionDiagnosticsError(
            cause instanceof Error ? cause.message : String(cause)
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, getEncryptionDiagnostics, user]);

  if (!isReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">ADHD Chat</h1>
          <p className="text-gray-600">
            Please{' '}
            <Link
              to="/login"
              className="text-primary-600 hover:text-primary-700 underline"
            >
              log in
            </Link>{' '}
            to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                ADHD Chat
              </h1>
              <p className="text-gray-600">Connected as {user.userId}</p>
            </div>
            <Button variant="outline" onClick={logout}>
              Log Out
            </Button>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Connection Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">State</p>
              <p className="text-lg font-medium text-gray-900">{state}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Ready</p>
              <p className="text-lg font-medium text-gray-900">
                {isReady ? '✓ Yes' : '✗ No'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Client</p>
              <p className="text-lg font-medium text-gray-900">
                {client ? '✓ Connected' : '✗ Disconnected'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">User ID</p>
              <p className="text-lg font-medium text-gray-900 truncate">
                {user.userId}
              </p>
            </div>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">Error: {error}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Encryption
          </h2>
          <p className="text-gray-600 mb-4">
            POC diagnostics for this account and this browser session.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Cross-signing ready</p>
              <p className="text-lg font-medium text-gray-900">
                {encryptionDiagnostics
                  ? encryptionDiagnostics.crossSigningReady
                    ? 'Yes'
                    : 'No'
                  : '...'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Secret storage ready</p>
              <p className="text-lg font-medium text-gray-900">
                {encryptionDiagnostics
                  ? encryptionDiagnostics.secretStorageReady
                    ? 'Yes'
                    : 'No'
                  : '...'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Backup enabled</p>
              <p className="text-lg font-medium text-gray-900">
                {encryptionDiagnostics
                  ? encryptionDiagnostics.keyBackupEnabled
                    ? 'Yes'
                    : 'No'
                  : '...'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Backup key cached here</p>
              <p className="text-lg font-medium text-gray-900">
                {encryptionDiagnostics
                  ? encryptionDiagnostics.backupKeyCached
                    ? 'Yes'
                    : 'No'
                  : '...'}
              </p>
            </div>
          </div>
          {encryptionDiagnostics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">This device signed by owner</p>
                <p className="text-lg font-medium text-gray-900">
                  {encryptionDiagnostics.deviceTrust
                    ? encryptionDiagnostics.deviceTrust.signedByOwner
                      ? 'Yes'
                      : 'No'
                    : 'Unknown'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">This device cross-signing verified</p>
                <p className="text-lg font-medium text-gray-900">
                  {encryptionDiagnostics.deviceTrust
                    ? encryptionDiagnostics.deviceTrust.crossSigningVerified
                      ? 'Yes'
                      : 'No'
                    : 'Unknown'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Private keys cached locally</p>
                <p className="text-lg font-medium text-gray-900">
                  {encryptionDiagnostics.crossSigningStatus.privateKeysCachedLocally
                    .masterKey &&
                  encryptionDiagnostics.crossSigningStatus.privateKeysCachedLocally
                    .selfSigningKey &&
                  encryptionDiagnostics.crossSigningStatus.privateKeysCachedLocally
                    .userSigningKey
                    ? 'Yes'
                    : 'No'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Private keys in secret storage</p>
                <p className="text-lg font-medium text-gray-900">
                  {encryptionDiagnostics.crossSigningStatus.privateKeysInSecretStorage
                    ? 'Yes'
                    : 'No'}
                </p>
              </div>
            </div>
          )}
          {encryptionDiagnosticsError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                Encryption diagnostics error: {encryptionDiagnosticsError}
              </p>
            </div>
          )}
          <Button onClick={() => setShowEncryptionModal(true)}>
            Manage Encryption
          </Button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rooms</h2>
          {rooms.length === 0 ? (
            <p className="text-gray-500">No rooms found</p>
          ) : (
            <div className="space-y-2">
              {rooms.map((r) => (
                <Link
                  key={r.id}
                  to={`/room/${r.id}`}
                  className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <p className="text-gray-900">{r.name}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <EncryptionSetupModal
        isOpen={showEncryptionModal}
        onClose={() => setShowEncryptionModal(false)}
        onSetupComplete={() => setShowEncryptionModal(false)}
        onLoadSetupInfo={getEncryptionSetupInfo}
        onGenerateKey={handleGenerateRecoveryKey}
        onFinishSetup={handleFinishEncryptionSetup}
      />
    </div>
  );
}

export default Home;
