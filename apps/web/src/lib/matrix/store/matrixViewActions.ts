import type { MatrixClient, Room } from 'matrix-js-sdk';
import {
  loadContactCatalogRoomSummaries,
  patchOtherChatCatalogEntry,
  patchTandemSpaceCatalogEntry,
  patchTandemSpaceRoomCatalogEntry,
  replaceTandemSpaceRoomCatalog,
} from '../catalogPatches';
import {
  buildChatCatalog,
  buildContactCatalog,
  type ChatSummary,
} from '../chatCatalog';
import {
  buildTandemSpaceCatalog,
  type TandemSpaceSummary,
} from '../spaceCatalog';
import {
  buildTandemSpaceRoomCatalog,
  type TandemSpaceRoomSummary,
} from '../spaceCatalog';
import { buildRoomSnapshot, type RoomSnapshot } from '../roomSnapshot';
import { paginateRoomHistoryBack } from '../roomHistory';
import type { TandemRelationshipRecord } from '../tandem';
import {
  buildNormalizedRoomStoreFromSnapshot,
  buildRoomSnapshotFromNormalizedStore,
  loadNormalizedRoomStore,
  saveNormalizedRoomStore,
} from './normalizedRoomStore';

export function preserveNonEmptyArray<T>(currentValue: T[], nextValue: T[]) {
  return nextValue.length > 0 || currentValue.length === 0
    ? nextValue
    : currentValue;
}

export async function loadTandemSpaceCatalog(
  client: MatrixClient,
  userId: string
) {
  return buildTandemSpaceCatalog(client, userId);
}

export function patchTandemSpaceCatalogAction(
  currentSpaces: TandemSpaceSummary[],
  client: MatrixClient,
  userId: string,
  relationships: TandemRelationshipRecord[],
  room: Room
) {
  return patchTandemSpaceCatalogEntry(
    currentSpaces,
    client,
    userId,
    relationships,
    room
  );
}

export async function loadTandemSpaceRoomCatalog(
  client: MatrixClient,
  userId: string,
  spaceId: string
) {
  return buildTandemSpaceRoomCatalog(client, userId, spaceId);
}

export function patchTandemSpaceRoomCatalogAction(
  currentRooms: TandemSpaceRoomSummary[],
  client: MatrixClient,
  userId: string,
  spaceId: string,
  room: Room
) {
  if (room.roomId === spaceId) {
    return replaceTandemSpaceRoomCatalog(client, userId, spaceId);
  }

  return patchTandemSpaceRoomCatalogEntry(
    currentRooms,
    client,
    userId,
    spaceId,
    room.roomId
  );
}

export function replaceTandemSpaceRoomCatalogAction(
  client: MatrixClient,
  userId: string,
  spaceId: string
) {
  return replaceTandemSpaceRoomCatalog(client, userId, spaceId);
}

export async function loadOtherChatCatalog(
  client: MatrixClient,
  userId: string
) {
  const catalog = await buildChatCatalog(client, userId);
  return catalog.otherChats;
}

export function patchOtherChatCatalogAction(
  currentChats: ChatSummary[],
  client: MatrixClient,
  userId: string,
  room: Room
) {
  return patchOtherChatCatalogEntry(currentChats, client, userId, room.roomId);
}

export async function loadContactCatalog(
  client: MatrixClient,
  userId: string
) {
  return buildContactCatalog(client, userId);
}

export async function patchContactCatalogAction(
  client: MatrixClient,
  userId: string,
  room: Room
) {
  const roomContacts = await loadContactCatalogRoomSummaries(
    client,
    userId,
    room.roomId
  );

  return {
    roomContacts,
    roomId: room.roomId,
  };
}

export async function loadRoomSnapshotAction(
  client: MatrixClient,
  userId: string,
  roomId: string
) {
  const normalizedRecord = await loadNormalizedRoomStore(userId, roomId);
  const normalizedSnapshot = normalizedRecord
    ? buildRoomSnapshotFromNormalizedStore(normalizedRecord)
    : null;

  if (normalizedSnapshot) {
    return normalizedSnapshot;
  }

  return refreshRoomSnapshotAction(client, userId, roomId);
}

export async function refreshRoomSnapshotAction(
  client: MatrixClient,
  userId: string,
  roomId: string
) {
  const room = client.getRoom(roomId);
  if (!room) {
    throw new Error('Conversation not found');
  }

  const snapshot = await buildRoomSnapshot(client, room, userId);
  await persistNormalizedRoomSnapshot(userId, roomId, snapshot);
  return snapshot;
}

export async function paginateRoomSnapshotAction(
  client: MatrixClient,
  userId: string,
  roomId: string
) {
  const room = client.getRoom(roomId);
  if (!room) {
    throw new Error('Conversation not found');
  }

  const { didPaginate } = await paginateRoomHistoryBack(client, room);
  if (!didPaginate) {
    return null;
  }

  const snapshot = await buildRoomSnapshot(client, room, userId);
  await persistNormalizedRoomSnapshot(userId, roomId, snapshot);
  return snapshot;
}

export function createInitialRoomSnapshot(): RoomSnapshot {
  return {
    roomName: 'Conversation',
    roomDescription: null,
    roomIcon: null,
    roomAvatarUrl: null,
    roomSubtitle: 'Connecting...',
    messages: [],
    threads: [],
    isEncrypted: false,
    roomMeta: {},
  };
}

export async function persistNormalizedRoomSnapshot(
  userId: string,
  roomId: string,
  snapshot: RoomSnapshot
) {
  await saveNormalizedRoomStore(
    userId,
    roomId,
    buildNormalizedRoomStoreFromSnapshot(userId, roomId, snapshot)
  );
}
