import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';
import { Button } from '../components';
import {
  ClientEvent,
  MsgType,
  RoomEvent,
  type MatrixEvent,
  type Room as MatrixRoom,
  type SyncState,
} from 'matrix-js-sdk';

type RoomInfo = {
  name?: string;
  topic?: string;
  memberCount?: number;
  isEncrypted?: boolean;
};

type TimelineMessage = {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
};

const ROOM_LOAD_TIMEOUT_MS = 15000;

function getRoomInfo(room: MatrixRoom): RoomInfo {
  const encryptionEvent = room.currentState.getStateEvents(
    'm.room.encryption',
    ''
  );

  return {
    name: room.name,
    topic: room.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic,
    memberCount: room.getJoinedMemberCount(),
    isEncrypted: !!encryptionEvent,
  };
}

function getTimelineMessages(room: MatrixRoom): TimelineMessage[] {
  return room
    .getLiveTimeline()
    .getEvents()
    .filter((event) => event.getType() === 'm.room.message')
    .map((event) => {
      const content = event.getContent<{ body?: string; msgtype?: string }>();

      return {
        id: event.getId() ?? event.getTs().toString(),
        sender: event.getSender() ?? 'Unknown sender',
        body:
          content.msgtype === MsgType.Text || !content.msgtype
            ? content.body ?? ''
            : `[${content.msgtype}] ${content.body ?? ''}`,
        timestamp: event.getTs(),
      };
    })
    .filter((message) => message.body.trim().length > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { client, isReady, syncState } = useMatrixClient();
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<TimelineMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enablingEncryption, setEnablingEncryption] = useState(false);
  const isInitialSyncComplete = useMemo(() => syncState === 'PREPARED', [syncState]);

  useEffect(() => {
    if (!client || !roomId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    let roomLoadTimeoutId: number | null = null;

    const resolveMissingRoom = () => {
      if (cancelled) {
        return;
      }

      setLoading(false);
      setError('Room not found');
    };

    const queueMissingRoomTimeout = () => {
      if (roomLoadTimeoutId !== null) {
        window.clearTimeout(roomLoadTimeoutId);
      }

      roomLoadTimeoutId = window.setTimeout(resolveMissingRoom, ROOM_LOAD_TIMEOUT_MS);
    };

    const updateRoomState = async () => {
      setLoading(true);
      setError(null);

      const room = client.getRoom(roomId);
      if (!room) {
        if (isInitialSyncComplete) {
          queueMissingRoomTimeout();
        }
        return;
      }

      try {
        if (roomLoadTimeoutId !== null) {
          window.clearTimeout(roomLoadTimeoutId);
          roomLoadTimeoutId = null;
        }

        await room.loadMembersIfNeeded();

        if (cancelled) {
          return;
        }

        setRoomInfo(getRoomInfo(room));
        setMessages(getTimelineMessages(room));
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void updateRoomState();

    const handleSync = (state: SyncState | null) => {
      if (!state) {
        return;
      }

      void updateRoomState();
    };

    const handleTimeline = (
      _event: MatrixEvent,
      eventRoom: MatrixRoom | undefined,
      _toStartOfTimeline: boolean | undefined,
      _removed: boolean,
      data: { liveEvent?: boolean }
    ) => {
      if (!data.liveEvent || eventRoom?.roomId !== roomId) {
        return;
      }

      void updateRoomState();
    };

    client.on(ClientEvent.Sync, handleSync);
    client.on(RoomEvent.Timeline, handleTimeline);
    client.on(RoomEvent.Name, updateRoomState);
    client.on(RoomEvent.MyMembership, updateRoomState);

    return () => {
      cancelled = true;
      if (roomLoadTimeoutId !== null) {
        window.clearTimeout(roomLoadTimeoutId);
      }
      client.off(ClientEvent.Sync, handleSync);
      client.off(RoomEvent.Timeline, handleTimeline);
      client.off(RoomEvent.Name, updateRoomState);
      client.off(RoomEvent.MyMembership, updateRoomState);
    };
  }, [client, isInitialSyncComplete, roomId]);

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
      await (
        client.sendStateEvent as (
          roomId: string,
          eventType: string,
          content: Record<string, unknown>,
          stateKey: string
        ) => Promise<unknown>
      )(
        roomId,
        'm.room.encryption',
        {
          algorithm: 'm.megolm.v1.aes-sha2',
        },
        ''
      );

      const room = client.getRoom(roomId);
      if (room) {
        setRoomInfo(getRoomInfo(room));
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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Room: {roomId}
        </h1>
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
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Encryption
              </h3>
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
                      Enable end-to-end encryption to secure messages in this
                      room. Once enabled, encryption cannot be disabled.
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

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Messages
              </h3>
              {messages.length === 0 ? (
                <p className="text-gray-500">
                  No timeline messages loaded yet for this room.
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {message.sender}
                        </p>
                        <p className="text-xs text-gray-500 whitespace-nowrap">
                          {new Date(message.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {message.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
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

export default RoomPage;
