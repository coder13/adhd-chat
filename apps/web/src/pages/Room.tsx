import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';
import { Button } from '../components';

function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const { client, isReady } = useMatrixClient();
  const [roomInfo, setRoomInfo] = useState<{
    name?: string;
    topic?: string;
    memberCount?: number;
    isEncrypted?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enablingEncryption, setEnablingEncryption] = useState(false);

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
        const encryptionEvent = room.currentState.getStateEvents('m.room.encryption', '');
        setRoomInfo({
          name: room.name,
          topic: room.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic,
          memberCount: room.getJoinedMemberCount(),
          isEncrypted: !!encryptionEvent,
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

  const handleEnableEncryption = async () => {
    if (!client || !roomId) return;
    
    setEnablingEncryption(true);
    setError(null);
    
    try {
      // Send state event to enable encryption in the room
      // Using type assertion as m.room.encryption is not in the StateEvents type union
      await (client.sendStateEvent as (
        roomId: string, 
        eventType: string, 
        content: Record<string, unknown>, 
        stateKey: string
      ) => Promise<unknown>)(
        roomId,
        'm.room.encryption',
        {
          algorithm: 'm.megolm.v1.aes-sha2',
        },
        ''
      );
      
      // Refresh room info
      const room = client.getRoom(roomId);
      if (room) {
        const encryptionEvent = room.currentState.getStateEvents('m.room.encryption', '');
        setRoomInfo({
          name: room.name,
          topic: room.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic,
          memberCount: room.getJoinedMemberCount(),
          isEncrypted: !!encryptionEvent,
        });
      }
    } catch (e) {
      console.error(e);
      setError(`Failed to enable encryption: ${String(e)}`);
    } finally {
      setEnablingEncryption(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Room: {roomId}</h1>
        {roomInfo ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {roomInfo.name || 'Unnamed Room'}
              </h2>
              {roomInfo.topic && (
                <p className="text-gray-600 mb-4">
                  <strong>Topic:</strong> {roomInfo.topic}
                </p>
              )}
              <p className="text-gray-600">
                <strong>Members:</strong> {roomInfo.memberCount}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Encryption</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">
                    <strong>Status:</strong>{' '}
                    {roomInfo.isEncrypted ? (
                      <span className="text-green-600">✓ Encrypted</span>
                    ) : (
                      <span className="text-gray-500">Not encrypted</span>
                    )}
                  </p>
                  {!roomInfo.isEncrypted && (
                    <p className="text-sm text-gray-500 mt-2">
                      Enable end-to-end encryption to secure messages in this room.
                      Once enabled, encryption cannot be disabled.
                    </p>
                  )}
                </div>
                {!roomInfo.isEncrypted && (
                  <Button
                    onClick={handleEnableEncryption}
                    disabled={enablingEncryption}
                  >
                    {enablingEncryption ? 'Enabling...' : 'Enable Encryption'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-600">No room information available</p>
        )}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Room;
