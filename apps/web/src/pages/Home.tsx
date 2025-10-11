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

    client.publicRooms().then((data) => {
      setRooms(
        data.chunk.map((r) => ({
          id: r.room_id,
          name: r.name || r.canonical_alias || r.room_id,
        }))
      );
    });
  }, [client, user]);

  if (!isReady || !user) {
    return (
      <div>
        <h1>ADHD Chat</h1>
        <p>Please <Link to="/login">log in</Link> to continue.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>ADHD Chat</h1>
      <div>
        <h2>Status</h2>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div>State: {state}</div>
          <div>Ready: {isReady ? 'yes' : 'no'}</div>
          <div>User: {user.userId}</div>
          <div>Client: {client ? 'yes' : 'no'}</div>
          {error && <div style={{ color: 'red' }}>Error: {error}</div>}
        </div>
      </div>
      <div>
        <h2>Public Rooms</h2>
        {rooms.length === 0 && <div>No rooms found</div>}
        {rooms.map((r) => (
          <div key={r.id}>
            <Link to={`/room/${r.id}`}>{r.name}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Home;
