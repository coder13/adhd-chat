import type { MatrixClient, Room } from 'matrix-js-sdk';
import {
  getRoomDisplayName,
  getTimelineMessages,
  type TimelineMessage,
} from './chatCatalog';
import { getRoomIcon, getRoomTopic } from './identity';
import {
  getRoomThreadSnapshots,
  type RoomThreadSnapshot,
} from './threadCatalog';
import { ensureRoomThreadsLoaded } from './roomThreads';
import {
  getTandemRoomMeta,
  getTandemSpaceIdForRoom,
  type TandemRoomMeta,
} from './tandem';
import { startMatrixPerfTimer } from './performanceMetrics';

export interface RoomSnapshot {
  roomName: string;
  roomDescription: string | null;
  roomIcon: string | null;
  roomAvatarUrl: string | null;
  roomSubtitle: string;
  messages: TimelineMessage[];
  threads: RoomThreadSnapshot[];
  isEncrypted: boolean;
  roomMeta: TandemRoomMeta;
}

function isMainTimelineMessage(message: TimelineMessage) {
  return message.threadRootId === null || message.isThreadRoot === true;
}

export function getAllSnapshotMessages(snapshot: RoomSnapshot) {
  const byId = new Map<string, TimelineMessage>();
  const messages = snapshot.messages ?? [];
  const threads = snapshot.threads ?? [];

  [
    ...messages,
    ...threads.flatMap((thread) => [thread.rootMessage, ...thread.replies]),
  ]
    .filter((message): message is TimelineMessage => message !== null)
    .forEach((message) => {
      byId.set(message.id, message);
    });

  return [...byId.values()];
}

export function getRoomSubtitle(client: MatrixClient, room: Room, userId: string) {
  const spaceId = getTandemSpaceIdForRoom(client, room);
  const spaceRoom = spaceId ? client.getRoom(spaceId) : null;

  if (spaceRoom) {
    return getRoomDisplayName(spaceRoom, userId);
  }

  return `${room.getJoinedMemberCount()} members`;
}

export async function buildRoomSnapshot(
  client: MatrixClient,
  room: Room,
  userId: string
): Promise<RoomSnapshot> {
  const timer = startMatrixPerfTimer('matrix.room.snapshot.build', {
    roomId: room.roomId,
  });
  await ensureRoomThreadsLoaded(room);
  await room.loadMembersIfNeeded();
  const allTimelineMessages = getTimelineMessages(client, room, userId);
  const encryptionEvent = room.currentState.getStateEvents(
    'm.room.encryption',
    ''
  );

  const snapshot = {
    roomName: getRoomDisplayName(room, userId),
    roomDescription: getRoomTopic(room),
    roomIcon: getRoomIcon(room),
    roomAvatarUrl:
      room.getAvatarUrl(client.getHomeserverUrl(), 96, 96, 'crop', false) ??
      null,
    roomSubtitle: getRoomSubtitle(client, room, userId),
    messages: allTimelineMessages.filter(isMainTimelineMessage),
    threads: getRoomThreadSnapshots(client, room, userId),
    isEncrypted: Boolean(encryptionEvent),
    roomMeta: getTandemRoomMeta(room),
  };

  timer.end({
    messageCount: snapshot.messages.length,
    threadCount: snapshot.threads.length,
  });

  return snapshot;
}
