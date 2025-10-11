import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';

function Home() {
  const { client, isReady, user, state, error } = useMatrixClient();
  const [rooms, setRooms] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!client || !user) {
      setRooms([]);
      return;
    }

    const _rooms = client.getVisibleRooms();
    console.log('Fetched rooms:', _rooms);
    setRooms(
      _rooms.map((i) => ({
        id: i.roomId,
        name: i.name || i.roomId,
      }))
    );
  }, [client, user]);

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
    </div>
  );
}

export default Home;
