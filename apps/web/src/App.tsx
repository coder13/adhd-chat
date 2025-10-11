import { useCallback, useEffect, useState } from 'react';
import useMatrixClient from './hooks/useMatrixClient/useMatrixClient';
import { LoginCard } from './components';

function App() {
  const {
    loginWithSso,
    completeSsoLogin,
    client,
    isReady,
    state,
    user,
    error,
  } = useMatrixClient();
  const [rooms, setRooms] = useState<string[]>([]);

  const login = useCallback(
    async (homeserver: string) => {
      await loginWithSso(homeserver);
    },
    [loginWithSso]
  );

  if (window.location.search.includes('?loginToken=')) {
    // Handle OIDC redirect callback
    // This would typically involve calling a method on your MatrixChatClient instance
    // to complete the login process.
    completeSsoLogin();
  }

  useEffect(() => {
    console.log(33, client, user);
    if (!client || !user) {
      setRooms([]);
      return;
    }

    client.publicRooms().then((data) => {
      console.log(36, data.chunk);
      setRooms(data.chunk.map((r) => r.name || r.canonical_alias || r.room_id));
    });
  }, [client, user]);

  // Show login screen if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <LoginCard
          onLogin={login}
          isLoading={state === 'redirecting' || state === 'authenticating'}
          error={error}
        />
      </div>
    );
  }

  // Show main app UI when authenticated
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">ADHD Chat</h1>
          <p className="text-gray-600">Connected as {user.userId}</p>
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

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Public Rooms
          </h2>
          {rooms.length === 0 ? (
            <p className="text-gray-500">No public rooms found</p>
          ) : (
            <div className="space-y-2">
              {rooms.map((r) => (
                <div
                  key={r}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <p className="text-gray-900">{r}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
