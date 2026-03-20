import type { MatrixClient, Room } from 'matrix-js-sdk';
import { getRoomDisplayName, getTimelineMessages } from './chatCatalog';
import type { RoomSnapshot } from './roomSnapshot';

export interface PinnedMessagesSnapshot {
  roomName: string;
  messages: RoomSnapshot['messages'];
}

export function getPinnedMessageIds(room: Room) {
  return (
    room.currentState
      .getStateEvents('m.room.pinned_events', '')
      ?.getContent<{ pinned?: string[] }>().pinned ?? []
  );
}

export function buildPinnedMessagesSnapshotFromRoom(
  client: MatrixClient,
  room: Room,
  userId: string
): PinnedMessagesSnapshot {
  const pinnedIds = new Set(getPinnedMessageIds(room));
  const messages = getTimelineMessages(client, room, userId);

  return {
    roomName: getRoomDisplayName(room, userId),
    messages: messages.filter((message) => pinnedIds.has(message.id)),
  };
}

export async function loadPinnedMessagesSnapshot(
  roomId: string,
  client: MatrixClient,
  userId: string
) {
  const room = client.getRoom(roomId);
  if (!room) {
    throw new Error('Topic not found.');
  }

  await room.loadMembersIfNeeded();

  return buildPinnedMessagesSnapshotFromRoom(client, room, userId);
}
