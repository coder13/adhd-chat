import {
  loadPersistedValueAsync,
  savePersistedValueAsync,
} from '../../asyncPersistence';
import type { RoomSnapshot } from '../roomSnapshot';
import type {
  NormalizedRoomStoreRecord,
} from './types';

const NORMALIZED_ROOM_STORE_VERSION = 1;

function getNormalizedRoomStoreKey(userId: string, roomId: string) {
  return `normalized-room:${userId}:${roomId}`;
}

export async function loadNormalizedRoomStore(
  userId: string,
  roomId: string
): Promise<NormalizedRoomStoreRecord | null> {
  return loadPersistedValueAsync<NormalizedRoomStoreRecord>(
    getNormalizedRoomStoreKey(userId, roomId),
    { bucket: 'resources' }
  );
}

export async function saveNormalizedRoomStore(
  userId: string,
  roomId: string,
  record: NormalizedRoomStoreRecord
) {
  await savePersistedValueAsync(
    getNormalizedRoomStoreKey(userId, roomId),
    record,
    { bucket: 'resources' }
  );
}

export function buildNormalizedRoomStoreFromSnapshot(
  userId: string,
  roomId: string,
  snapshot: RoomSnapshot
): NormalizedRoomStoreRecord {
  const timelineMessages = Object.fromEntries(
    snapshot.messages.map((message) => [message.id, message])
  );

  return {
    room: {
      id: roomId,
      name: snapshot.roomName,
      description: snapshot.roomDescription,
      icon: snapshot.roomIcon,
      avatarUrl: snapshot.roomAvatarUrl,
      subtitle: snapshot.roomSubtitle,
      isEncrypted: snapshot.isEncrypted,
      roomMeta: snapshot.roomMeta,
    },
    timelineEventIds: snapshot.messages.map((message) => message.id),
    timelineMessages,
    updatedAt: Date.now(),
    userId,
    version: NORMALIZED_ROOM_STORE_VERSION,
  };
}

export function buildRoomSnapshotFromNormalizedStore(
  record: NormalizedRoomStoreRecord
): RoomSnapshot | null {
  if (record.version !== NORMALIZED_ROOM_STORE_VERSION) {
    return null;
  }

  const messages = record.timelineEventIds
    .map((eventId) => record.timelineMessages[eventId] ?? null)
    .filter((message): message is RoomSnapshot['messages'][number] => message !== null);

  return {
    roomName: record.room.name,
    roomDescription: record.room.description,
    roomIcon: record.room.icon,
    roomAvatarUrl: record.room.avatarUrl,
    roomSubtitle: record.room.subtitle,
    messages,
    threads: [],
    isEncrypted: record.room.isEncrypted,
    roomMeta: record.room.roomMeta,
  };
}
