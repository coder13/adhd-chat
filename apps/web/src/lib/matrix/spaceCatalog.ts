import {
  MsgType,
  NotificationCountType,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import {
  getResolvedTandemRelationships,
  getTandemRoomMeta,
  TANDEM_ROOM_EVENT_TYPE,
  TANDEM_SPACE_EVENT_TYPE,
  type TandemRelationshipRecord,
} from './tandem';
import { getRoomDisplayName } from './chatCatalog';
import { getRoomTopic } from './identity';
import {
  getRoomTimelineEvents,
  getTimelineEventContent,
  isRenderableTimelineMessage,
} from './timelineEvents';

const ROOM_CREATE_EVENT_TYPE = 'm.room.create';
const SPACE_CHILD_EVENT_TYPE = 'm.space.child';
const SPACE_ROOM_TYPE = 'm.space';

export interface TandemSpaceSummary {
  spaceId: string;
  name: string;
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
  description: string | null;
  preview: string;
  timestamp: number;
  unreadCount: number;
  memberCount: number;
  membership: string;
  isMain: boolean;
  isPinned: boolean;
  isArchived: boolean;
  category: string | null;
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

function getLatestMessageEvent(room: Room) {
  const events = getRoomTimelineEvents(room);

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!isRenderableTimelineMessage(event)) {
      continue;
    }
    return event;
  }

  return null;
}

function getPreviewText(room: Room) {
  const latestMessageEvent = getLatestMessageEvent(room);
  if (!latestMessageEvent) {
    return 'No messages yet';
  }

  const content = getTimelineEventContent(latestMessageEvent);

  switch (content.msgtype) {
    case MsgType.Image:
      return 'Photo';
    case MsgType.File:
      return 'File';
    case MsgType.Audio:
      return 'Audio';
    case MsgType.Video:
      return 'Video';
    case MsgType.Emote:
      return content.body?.trim() ? `* ${content.body.trim()}` : 'Emote';
    default:
      return content.body?.trim() || 'No messages yet';
  }
}

function getLatestTimestamp(room: Room) {
  return getLatestMessageEvent(room)?.getTs() ?? 0;
}

function getChildRoomIds(spaceRoom: Room) {
  return asArray(
    spaceRoom.currentState.getStateEvents(SPACE_CHILD_EVENT_TYPE) as
      | MatrixEvent
      | MatrixEvent[]
      | null
  )
    .map((event) => event.getStateKey())
    .filter((roomId): roomId is string => Boolean(roomId));
}

function compareRooms(a: TandemSpaceRoomSummary, b: TandemSpaceRoomSummary) {
  return (
    Number(b.isPinned) - Number(a.isPinned) ||
    Number(b.isMain) - Number(a.isMain) ||
    b.timestamp - a.timestamp ||
    a.name.localeCompare(b.name)
  );
}

function relationshipBySpaceId(client: MatrixClient) {
  return new Map(
    getResolvedTandemRelationships(client).relationships.map((relationship) => [
      relationship.sharedSpaceId,
      relationship,
    ])
  );
}

function getSpaceSummary(
  client: MatrixClient,
  spaceRoom: Room,
  relationship: TandemRelationshipRecord,
  userId: string
): TandemSpaceSummary {
  const childRooms = getChildRoomIds(spaceRoom)
    .map((roomId) => client.getRoom(roomId))
    .filter((room): room is Room => room !== null);

  const mostRecentRoom =
    childRooms.sort(
      (a, b) => getLatestTimestamp(b) - getLatestTimestamp(a)
    )[0] ?? null;

  return {
    spaceId: spaceRoom.roomId,
    name: getRoomDisplayName(spaceRoom, userId),
    description: getRoomTopic(spaceRoom),
    partnerUserId: relationship.partnerUserId,
    mainRoomId: relationship.mainRoomId,
    preview: mostRecentRoom
      ? getPreviewText(mostRecentRoom)
      : 'No messages yet',
    timestamp: mostRecentRoom ? getLatestTimestamp(mostRecentRoom) : 0,
    unreadCount: childRooms.reduce(
      (count, room) =>
        count + room.getUnreadNotificationCount(NotificationCountType.Total),
      0
    ),
    roomCount: childRooms.filter((room) => !getTandemRoomMeta(room).hidden)
      .length,
  };
}

export async function buildTandemSpaceCatalog(
  client: MatrixClient,
  userId: string
): Promise<TandemSpaceSummary[]> {
  const joinedRoomsResponse = await client.getJoinedRooms();
  const joinedRooms = joinedRoomsResponse.joined_rooms
    .map((roomId) => client.getRoom(roomId))
    .filter((room): room is Room => room !== null);

  await Promise.all(
    joinedRooms.map(async (room) => {
      try {
        await room.loadMembersIfNeeded();
      } catch (error) {
        console.error(`Failed to load members for room ${room.roomId}`, error);
      }
    })
  );

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

      return getSpaceSummary(client, spaceRoom, relationship, userId);
    })
    .filter((space): space is TandemSpaceSummary => space !== null)
    .sort((a, b) => b.timestamp - a.timestamp || a.name.localeCompare(b.name));
}

export async function buildTandemSpaceRoomCatalog(
  client: MatrixClient,
  userId: string,
  spaceId: string
): Promise<TandemSpaceRoomSummary[]> {
  const spaceRoom = client.getRoom(spaceId);
  if (!spaceRoom) {
    throw new Error('Tandem space not found.');
  }

  await spaceRoom.loadMembersIfNeeded();

  const relationship = relationshipBySpaceId(client).get(spaceId);
  const childRoomIds = getChildRoomIds(spaceRoom);

  const rooms = await Promise.all(
    childRoomIds.map(async (roomId) => {
      const room = client.getRoom(roomId);
      if (!room) {
        return null;
      }

      try {
        await room.loadMembersIfNeeded();
      } catch (error) {
        console.error(`Failed to load members for room ${room.roomId}`, error);
      }

      const meta = getTandemRoomMeta(room);
      if (meta.hidden) {
        return null;
      }

      return {
        id: room.roomId,
        name: getRoomDisplayName(room, userId),
        description: getRoomTopic(room),
        preview: getPreviewText(room),
        timestamp: getLatestTimestamp(room),
        unreadCount: room.getUnreadNotificationCount(NotificationCountType.Total),
        memberCount: room.getJoinedMemberCount(),
        membership: room.getMyMembership(),
        isMain:
          relationship?.mainRoomId === room.roomId ||
          Boolean(room.currentState.getStateEvents(TANDEM_ROOM_EVENT_TYPE, '')),
        isPinned: Boolean(meta.pinned),
        isArchived: Boolean(meta.archived),
        category: meta.category ?? null,
      } satisfies TandemSpaceRoomSummary;
    })
  );

  return rooms
    .filter((room): room is TandemSpaceRoomSummary => room !== null)
    .sort(compareRooms);
}
