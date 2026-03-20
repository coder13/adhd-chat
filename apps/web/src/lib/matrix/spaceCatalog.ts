import {
  NotificationCountType,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import {
  getResolvedTandemRelationships,
  getTandemRoomMeta,
  TANDEM_SPACE_EVENT_TYPE,
  type TandemRelationshipRecord,
} from './tandem';
import { getRoomDisplayName } from './chatCatalog';
import { getRoomIcon, getRoomTopic } from './identity';
import { getRoomTimelineSummary } from './roomTimelineSummary';
import {
  getPendingTandemRoomsForSpace,
  type PendingTandemRoomRecord,
} from './pendingTandemRoom';

const ROOM_CREATE_EVENT_TYPE = 'm.room.create';
const SPACE_CHILD_EVENT_TYPE = 'm.space.child';
const SPACE_ROOM_TYPE = 'm.space';

export interface TandemSpaceSummary {
  spaceId: string;
  name: string;
  icon: string | null;
  description: string | null;
  partnerUserId: string;
  mainRoomId: string;
  preview: string;
  timestamp: number;
  unreadCount: number;
  roomCount: number;
}

export interface TandemSpaceRoomSummary {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  preview: string;
  timestamp: number;
  unreadCount: number;
  memberCount: number;
  membership: string;
  isPinned: boolean;
  isArchived: boolean;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getRoomType(room: Room) {
  return room.currentState
    .getStateEvents(ROOM_CREATE_EVENT_TYPE, '')
    ?.getContent<{ type?: string }>().type;
}

function isSpaceRoom(room: Room) {
  return getRoomType(room) === SPACE_ROOM_TYPE;
}

function hasLinkedParent(
  client: MatrixClient,
  spaceRoom: Room,
  childRoomId: string
) {
  const childRoom = client.getRoom(childRoomId);
  if (!childRoom) {
    return false;
  }

  return getTandemRoomMeta(childRoom).hidden !== true &&
    childRoom.currentState.getStateEvents('m.space.parent', spaceRoom.roomId) !== null;
}

function getChildRoomIds(client: MatrixClient, spaceRoom: Room) {
  return asArray(
    spaceRoom.currentState.getStateEvents(SPACE_CHILD_EVENT_TYPE) as
      | MatrixEvent
      | MatrixEvent[]
      | null
  )
    .filter((event) => {
      const content = event.getContent<{ via?: string[] }>();
      if (Array.isArray(content?.via) && content.via.length > 0) {
        return true;
      }

      const childRoomId = event.getStateKey();
      return childRoomId ? hasLinkedParent(client, spaceRoom, childRoomId) : false;
    })
    .map((event) => event.getStateKey())
    .filter((roomId): roomId is string => Boolean(roomId));
}

export function compareTandemSpaceRooms(
  a: TandemSpaceRoomSummary,
  b: TandemSpaceRoomSummary
) {
  return (
    Number(b.isPinned) - Number(a.isPinned) ||
    b.timestamp - a.timestamp ||
    a.name.localeCompare(b.name)
  );
}

export function compareTandemSpaces(
  a: TandemSpaceSummary,
  b: TandemSpaceSummary
) {
  return b.timestamp - a.timestamp || a.name.localeCompare(b.name);
}

function relationshipBySpaceId(client: MatrixClient) {
  return new Map(
    getResolvedTandemRelationships(client).relationships.map((relationship) => [
      relationship.sharedSpaceId,
      relationship,
    ])
  );
}

function getLocallyJoinedRooms(client: MatrixClient) {
  return client
    .getRooms()
    .filter((room) => room.getMyMembership() === 'join');
}

function toPendingRoomSummary(
  pendingRoom: PendingTandemRoomRecord
): TandemSpaceRoomSummary {
  return {
    id: pendingRoom.pendingRoomId,
    name: pendingRoom.roomName,
    icon: null,
    description: pendingRoom.topic ?? null,
    preview:
      pendingRoom.status === 'failed'
        ? pendingRoom.error ?? 'Topic setup failed'
        : 'Creating topic...',
    timestamp: pendingRoom.createdAt,
    unreadCount: 0,
    memberCount: 2,
    membership: 'join',
    isPinned: false,
    isArchived: false,
  };
}

export function buildTandemSpaceSummary(
  client: MatrixClient,
  spaceRoom: Room,
  relationship: TandemRelationshipRecord,
  userId: string
): TandemSpaceSummary {
  const childRoomSummaries = getChildRoomIds(client, spaceRoom)
    .map((roomId) => client.getRoom(roomId))
    .filter((room): room is Room => room !== null)
    .map((room) => ({
      room,
      timelineSummary: getRoomTimelineSummary(room),
    }));

  const mostRecentRoom =
    childRoomSummaries.sort(
      (left, right) => right.timelineSummary.timestamp - left.timelineSummary.timestamp
    )[0] ?? null;

  return {
    spaceId: spaceRoom.roomId,
    name: getRoomDisplayName(spaceRoom, userId),
    icon: getRoomIcon(spaceRoom),
    description: getRoomTopic(spaceRoom),
    partnerUserId: relationship.partnerUserId,
    mainRoomId: relationship.mainRoomId,
    preview: mostRecentRoom
      ? mostRecentRoom.timelineSummary.preview
      : 'No messages yet',
    timestamp: mostRecentRoom?.timelineSummary.timestamp ?? 0,
    unreadCount: childRoomSummaries.reduce(
      (count, room) =>
        count + room.room.getUnreadNotificationCount(NotificationCountType.Total),
      0
    ),
    roomCount: childRoomSummaries.filter(
      ({ room }) => !getTandemRoomMeta(room).hidden
    ).length,
  };
}

export function buildTandemSpaceRoomSummary(
  room: Room,
  userId: string
): TandemSpaceRoomSummary | null {
  const timelineSummary = getRoomTimelineSummary(room);
  const meta = getTandemRoomMeta(room);
  if (meta.hidden) {
    return null;
  }

  return {
    id: room.roomId,
    name: getRoomDisplayName(room, userId),
    icon: getRoomIcon(room),
    description: getRoomTopic(room),
    preview: timelineSummary.preview,
    timestamp: timelineSummary.timestamp,
    unreadCount: room.getUnreadNotificationCount(NotificationCountType.Total),
    memberCount: room.getJoinedMemberCount(),
    membership: room.getMyMembership(),
    isPinned: Boolean(meta.pinned),
    isArchived: Boolean(meta.archived),
  } satisfies TandemSpaceRoomSummary;
}

export async function buildTandemSpaceCatalog(
  client: MatrixClient,
  userId: string
): Promise<TandemSpaceSummary[]> {
  const joinedRooms = getLocallyJoinedRooms(client);

  const relationships = relationshipBySpaceId(client);

  return joinedRooms
    .filter((room) => isSpaceRoom(room))
    .filter((room) =>
      room.currentState.getStateEvents(TANDEM_SPACE_EVENT_TYPE, '')
    )
    .map((spaceRoom) => {
      const relationship = relationships.get(spaceRoom.roomId);
      if (!relationship) {
        return null;
      }

      return buildTandemSpaceSummary(client, spaceRoom, relationship, userId);
    })
    .filter((space): space is TandemSpaceSummary => space !== null)
    .sort(compareTandemSpaces);
}

export async function buildTandemSpaceRoomCatalog(
  client: MatrixClient,
  userId: string,
  spaceId: string
): Promise<TandemSpaceRoomSummary[]> {
  return buildTandemSpaceRoomCatalogFromLocalState(client, userId, spaceId);
}

export function buildTandemSpaceRoomCatalogFromLocalState(
  client: MatrixClient,
  userId: string,
  spaceId: string
): TandemSpaceRoomSummary[] {
  const spaceRoom = client.getRoom(spaceId);
  if (!spaceRoom) {
    throw new Error('Tandem space not found.');
  }

  const childRoomIds = getChildRoomIds(client, spaceRoom);

  const rooms = childRoomIds.map((roomId) => {
    const room = client.getRoom(roomId);
    if (!room) {
      return null;
    }

    return buildTandemSpaceRoomSummary(room, userId);
  });

  return rooms
    .filter((room): room is TandemSpaceRoomSummary => room !== null)
    .concat(getPendingTandemRoomsForSpace(spaceId).map(toPendingRoomSummary))
    .sort(compareTandemSpaceRooms);
}
