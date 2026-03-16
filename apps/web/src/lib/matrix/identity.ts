import type { MatrixClient, Room } from 'matrix-js-sdk';

export const TANDEM_IDENTITY_EVENT_TYPE = 'com.tandem.identity';

interface TandemIdentityContent {
  icon?: string | null;
  updatedAt?: string;
}

export function getRoomTopic(room: Room) {
  const topic = room.currentState
    .getStateEvents('m.room.topic', '')
    ?.getContent<{ topic?: string }>().topic;

  return topic?.trim() || null;
}

export function getRoomIcon(room: Room) {
  const icon = room.currentState
    .getStateEvents(TANDEM_IDENTITY_EVENT_TYPE, '')
    ?.getContent<TandemIdentityContent>().icon;

  return icon?.trim() || null;
}

export async function updateRoomIdentity(
  client: MatrixClient,
  room: Room,
  {
    name,
    topic,
    icon,
  }: {
    name: string;
    topic: string;
    icon?: string | null;
  }
) {
  const nextName = name.trim();
  const nextTopic = topic.trim();
  const nextIcon = icon?.trim() || '';
  const currentName = room.name?.trim() || '';
  const currentTopic = getRoomTopic(room) ?? '';
  const currentIcon = getRoomIcon(room) ?? '';

  if (!nextName) {
    throw new Error('Name is required.');
  }

  if (nextName !== currentName) {
    await client.setRoomName(room.roomId, nextName);
  }

  if (nextTopic !== currentTopic) {
    await client.setRoomTopic(room.roomId, nextTopic);
  }

  if (nextIcon !== currentIcon) {
    await (
      client.sendStateEvent as (
        roomId: string,
        eventType: string,
        content: Record<string, unknown>,
        stateKey?: string
      ) => Promise<unknown>
    )(
      room.roomId,
      TANDEM_IDENTITY_EVENT_TYPE,
      {
        icon: nextIcon || null,
        updatedAt: new Date().toISOString(),
      } satisfies TandemIdentityContent,
      ''
    );
  }
}
