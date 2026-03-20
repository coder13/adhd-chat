import {
  TANDEM_SPACE_EVENT_TYPE,
  getResolvedTandemRelationships,
  getTandemSpaceIdForRoom,
  type TandemRelationshipRecord,
} from './tandem';
import {
  buildChatSummary,
  buildContactSummariesForRoom,
  compareChats,
  compareContacts,
  getDirectRoomIds,
  type ChatSummary,
  type ContactSummary,
} from './chatCatalog';
import {
  buildTandemSpaceRoomCatalogFromLocalState,
  buildTandemSpaceRoomSummary,
  buildTandemSpaceSummary,
  compareTandemSpaceRooms,
  compareTandemSpaces,
  type TandemSpaceRoomSummary,
  type TandemSpaceSummary,
} from './spaceCatalog';
import type { MatrixClient, Room } from 'matrix-js-sdk';

function upsertSortedById<T extends { id: string }>(
  items: T[],
  item: T,
  compare: (left: T, right: T) => number
) {
  return [...items.filter((entry) => entry.id !== item.id), item].sort(compare);
}

function upsertSortedBySpaceId(
  spaces: TandemSpaceSummary[],
  space: TandemSpaceSummary
) {
  return [
    ...spaces.filter((entry) => entry.spaceId !== space.spaceId),
    space,
  ].sort(compareTandemSpaces);
}

function dedupeContacts(contacts: ContactSummary[]) {
  const contactsByUserId = new Map<string, ContactSummary>();

  contacts.forEach((contact) => {
    const existingContact = contactsByUserId.get(contact.userId);
    if (
      !existingContact ||
      existingContact.lastMessageTs < contact.lastMessageTs
    ) {
      contactsByUserId.set(contact.userId, contact);
    }
  });

  return [...contactsByUserId.values()].sort(compareContacts);
}

export function applyContactCatalogRoomPatch(
  currentContacts: ContactSummary[],
  roomId: string,
  roomContacts: ContactSummary[]
) {
  return dedupeContacts([
    ...currentContacts.filter((contact) => contact.roomId !== roomId),
    ...roomContacts,
  ]);
}

export async function loadContactCatalogRoomSummaries(
  client: MatrixClient,
  userId: string,
  roomId: string
) {
  const room = client.getRoom(roomId);

  if (
    !room ||
    room.getMyMembership() !== 'join' ||
    !getDirectRoomIds(client).has(room.roomId)
  ) {
    return [] as ContactSummary[];
  }

  try {
    await room.loadMembersIfNeeded();
  } catch (error) {
    console.error(`Failed to load members for room ${room.roomId}`, error);
  }

  if (
    room.getMyMembership() !== 'join' ||
    !getDirectRoomIds(client).has(room.roomId)
  ) {
    return [] as ContactSummary[];
  }

  return buildContactSummariesForRoom(room, userId);
}

function getRelationshipForRoom(
  client: MatrixClient,
  room: Room,
  relationships: TandemRelationshipRecord[]
) {
  const spaceId = room.currentState.getStateEvents(TANDEM_SPACE_EVENT_TYPE, '')
    ? room.roomId
    : getTandemSpaceIdForRoom(client, room);

  if (!spaceId) {
    return null;
  }

  const relationship = relationships.find(
    (entry) => entry.sharedSpaceId === spaceId
  );

  return relationship
    ? {
        relationship,
        spaceId,
      }
    : null;
}

export function patchTandemSpaceCatalogEntry(
  currentSpaces: TandemSpaceSummary[],
  client: MatrixClient,
  userId: string,
  relationships: TandemRelationshipRecord[] | null | undefined,
  room: Room
) {
  const resolvedRelationships =
    relationships && relationships.length > 0
      ? relationships
      : getResolvedTandemRelationships(client).relationships;
  const relationshipForRoom = getRelationshipForRoom(
    client,
    room,
    resolvedRelationships
  );
  if (!relationshipForRoom) {
    return currentSpaces;
  }

  const spaceRoom = client.getRoom(relationshipForRoom.spaceId);
  if (
    !spaceRoom ||
    spaceRoom.getMyMembership() !== 'join' ||
    !spaceRoom.currentState.getStateEvents(TANDEM_SPACE_EVENT_TYPE, '')
  ) {
    return currentSpaces.filter(
      (entry) => entry.spaceId !== relationshipForRoom.spaceId
    );
  }

  const nextSpace = buildTandemSpaceSummary(
    client,
    spaceRoom,
    relationshipForRoom.relationship,
    userId
  );

  return upsertSortedBySpaceId(currentSpaces, nextSpace);
}

export function patchTandemSpaceRoomCatalogEntry(
  currentRooms: TandemSpaceRoomSummary[],
  client: MatrixClient,
  userId: string,
  spaceId: string,
  roomId: string
) {
  const room = client.getRoom(roomId);
  if (!room || getTandemSpaceIdForRoom(client, room) !== spaceId) {
    return currentRooms.filter((entry) => entry.id !== roomId);
  }

  const nextRoom = buildTandemSpaceRoomSummary(room, userId);
  if (!nextRoom) {
    return currentRooms.filter((entry) => entry.id !== roomId);
  }

  return upsertSortedById(currentRooms, nextRoom, compareTandemSpaceRooms);
}

export function replaceTandemSpaceRoomCatalog(
  client: MatrixClient,
  userId: string,
  spaceId: string
) {
  try {
    return buildTandemSpaceRoomCatalogFromLocalState(client, userId, spaceId);
  } catch {
    return [] as TandemSpaceRoomSummary[];
  }
}

export async function patchContactCatalogEntry(
  currentContacts: ContactSummary[],
  client: MatrixClient,
  userId: string,
  roomId: string
) {
  const roomContacts = await loadContactCatalogRoomSummaries(client, userId, roomId);
  return applyContactCatalogRoomPatch(currentContacts, roomId, roomContacts);
}

export function patchOtherChatCatalogEntry(
  currentChats: ChatSummary[],
  client: MatrixClient,
  userId: string,
  roomId: string
) {
  const room = client.getRoom(roomId);
  if (!room) {
    return currentChats.filter((entry) => entry.id !== roomId);
  }

  const nextChat = buildChatSummary(client, room, userId);
  if (!nextChat || getTandemSpaceIdForRoom(client, room)) {
    return currentChats.filter((entry) => entry.id !== roomId);
  }

  return upsertSortedById(currentChats, nextChat, compareChats);
}
