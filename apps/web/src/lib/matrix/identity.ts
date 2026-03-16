import type { MatrixClient, Room } from 'matrix-js-sdk';

export function getRoomTopic(room: Room) {
  const topic = room.currentState
    .getStateEvents('m.room.topic', '')
    ?.getContent<{ topic?: string }>().topic;

  return topic?.trim() || null;
}

export async function updateRoomIdentity(
  client: MatrixClient,
  room: Room,
  {
    name,
    topic,
  }: {
    name: string;
    topic: string;
  }
) {
  const nextName = name.trim();
  const nextTopic = topic.trim();
  const currentName = room.name?.trim() || '';
  const currentTopic = getRoomTopic(room) ?? '';

  if (!nextName) {
    throw new Error('Name is required.');
  }

  if (nextName !== currentName) {
    await client.setRoomName(room.roomId, nextName);
  }

  if (nextTopic !== currentTopic) {
    await client.setRoomTopic(room.roomId, nextTopic);
  }
}
