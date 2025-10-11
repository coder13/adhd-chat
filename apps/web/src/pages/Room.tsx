import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';

function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const { client, isReady } = useMatrixClient();
  const [roomInfo, setRoomInfo] = useState<{
    name?: string;
    topic?: string;
    memberCount?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !isReady || !roomId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Get room information
    try {
      const room = client.getRoom(roomId);
      if (room) {
        setRoomInfo({
          name: room.name,
          topic: room.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic,
          memberCount: room.getJoinedMemberCount(),
        });
      } else {
        setError('Room not found');
      }
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [client, isReady, roomId]);

  if (!roomId) {
    return <div>No room ID provided</div>;
  }

  if (!client || !isReady) {
    return <div>Please log in to view room information</div>;
  }

  if (loading) {
    return <div>Loading room information...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Room: {roomId}</h1>
      {roomInfo ? (
        <div>
          <h2>{roomInfo.name || 'Unnamed Room'}</h2>
          {roomInfo.topic && <p><strong>Topic:</strong> {roomInfo.topic}</p>}
          <p><strong>Members:</strong> {roomInfo.memberCount}</p>
        </div>
      ) : (
        <p>No room information available</p>
      )}
    </div>
  );
}

export default Room;
