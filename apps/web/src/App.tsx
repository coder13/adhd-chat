import { useCallback, useEffect, useState } from 'react';
import useMatrixClient from './hooks/useMatrixClient/useMatrixClient';

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

  const login = useCallback(async () => {
    // onClick:
    await loginWithSso('https://matrix.org');
  }, [loginWithSso]);

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

  return (
    <>
      <h1>ADHD Chat</h1>
      <div>
        <h2>Matrix Login</h2>
        <button onClick={() => login()}>Login</button>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div>
            State: {state} <br />
          </div>
          <div>Ready: {isReady ? 'yes' : 'no'} </div>
          <div>User: {user ? user.userId : 'no user'} </div>
          <div>Client: {client ? 'yes' : 'no'}</div>
          <div>Error: {error}</div>
        </div>
        <div>
          <h3>Rooms</h3>
          {rooms.length === 0 && <div>No rooms</div>}
          {rooms.map((r) => (
            <div key={r}>{r}</div>
          ))}
        </div>
      </div>
    </>
  );
}

export default App;
