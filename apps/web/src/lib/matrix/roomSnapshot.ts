import type { MatrixClient, Room } from 'matrix-js-sdk';
import {
  buildChatCatalog,
  getRoomDisplayName,
  getTimelineMessages,
  type TimelineMessage,
} from './chatCatalog';
import { getRoomIcon, getRoomTopic } from './identity';
import { getTandemRoomMeta, type TandemRoomMeta } from './tandem';

export interface RoomSnapshot {
  roomName: string;
  roomDescription: string | null;
  roomIcon: string | null;
  roomSubtitle: string;
  messages: TimelineMessage[];
  isEncrypted: boolean;
  roomMeta: TandemRoomMeta;
}

export async function buildRoomSnapshot(
  client: MatrixClient,
  room: Room,
  userId: string
): Promise<RoomSnapshot> {
  await room.loadMembersIfNeeded();

  const catalog = await buildChatCatalog(client, userId);
  const chat =
    catalog.primaryChats.find((entry) => entry.id === room.roomId) ??
    catalog.otherChats.find((entry) => entry.id === room.roomId) ??
    null;
  const encryptionEvent = room.currentState.getStateEvents(
    'm.room.encryption',
    ''
  );

  return {
    roomName: getRoomDisplayName(room, userId),
    roomDescription: getRoomTopic(room),
    roomIcon: getRoomIcon(room),
    roomSubtitle:
      chat?.nativeSpaceName || `${room.getJoinedMemberCount()} members`,
    messages: getTimelineMessages(client, room, userId),
    isEncrypted: Boolean(encryptionEvent),
    roomMeta: getTandemRoomMeta(room),
  };
}
