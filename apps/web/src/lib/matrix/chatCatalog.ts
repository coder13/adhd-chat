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
} from './tandem';
import { getRoomIcon } from './identity';
import {
  type TimelineReaction,
  type TimelineReply,
} from './timelineRelations';
import {
  getTimelineEventContent,
  getRoomTimelineEvents,
  isRenderableTimelineMessage,
} from './timelineEvents';
import { resolveTimelineMessagesFromEvents } from './timelineMessageResolver';

const ADHD_CHAT_SPACE_EVENT_TYPE = 'dev.adhd-chat.space';
const ROOM_CREATE_EVENT_TYPE = 'm.room.create';
const SPACE_CHILD_EVENT_TYPE = 'm.space.child';
const DIRECT_ACCOUNT_DATA_EVENT_TYPE = 'm.direct';
const SPACE_ROOM_TYPE = 'm.space';

export type ChatSummary = {
  id: string;
  name: string;
  icon: string | null;
  preview: string;
  timestamp: number;
  unreadCount: number;
  isDirect: boolean;
  isEncrypted: boolean;
  memberCount: number;
  nativeSpaceName: string | null;
  source: 'primary' | 'other';
  isTandemMain: boolean;
  isPinned: boolean;
  isArchived: boolean;
};

export type ChatCatalog = {
  primaryChats: ChatSummary[];
  otherChats: ChatSummary[];
};

export type ContactSummary = {
  userId: string;
  displayName: string;
  roomId: string;
  lastMessageTs: number;
};

export type TimelineMessage = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  filename?: string | null;
  timestamp: number;
  isOwn: boolean;
  msgtype: string;
  transactionId?: string | null;
  deliveryStatus?: 'sent' | 'sending' | 'failed';
  errorText?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  readByNames?: string[] | null;
  isEdited?: boolean;
  isDeleted?: boolean;
  replyTo?: TimelineReply | null;
  reactions?: TimelineReaction[];
  mentionedUserIds?: string[] | null;
  threadRootId?: string | null;
  isThreadRoot?: boolean;
};

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

export function getRoomDisplayName(room: Room, userId: string) {
  const explicitName = room.name?.trim();
  if (explicitName && explicitName !== room.roomId) {
    return explicitName;
  }

  const canonicalAlias = room.getCanonicalAlias();
  if (canonicalAlias) {
    return canonicalAlias;
  }

  const generatedName = room.getDefaultRoomName(userId)?.trim();
  if (generatedName && generatedName !== room.roomId) {
    return generatedName;
  }

  return room.roomId;
}

function getStateEvents(room: Room, eventType: string) {
  return asArray(
    room.currentState.getStateEvents(eventType) as
      | MatrixEvent
      | MatrixEvent[]
      | null
  );
}

function getDirectRoomIds(client: MatrixClient) {
  const directAccountData = client
    .getAccountData(DIRECT_ACCOUNT_DATA_EVENT_TYPE)
    ?.getContent<Record<string, string[]>>();

  const directRoomIds = new Set<string>();
  if (!directAccountData || typeof directAccountData !== 'object') {
    return directRoomIds;
  }

  Object.values(directAccountData).forEach((roomIds) => {
    roomIds.forEach((roomId) => {
      directRoomIds.add(roomId);
    });
  });

  return directRoomIds;
}

function hasNativeSpaceMetadata(room: Room) {
  const content = room.currentState
    .getStateEvents(ADHD_CHAT_SPACE_EVENT_TYPE, '')
    ?.getContent<{ kind?: string; version?: number }>();

  return (
    content?.kind === 'adhd-chat-space' && typeof content.version === 'number'
  );
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

function compareChats(a: ChatSummary, b: ChatSummary) {
  return (
    Number(b.isPinned) - Number(a.isPinned) ||
    Number(b.isTandemMain) - Number(a.isTandemMain) ||
    b.timestamp - a.timestamp ||
    a.name.localeCompare(b.name)
  );
}

export async function buildChatCatalog(
  client: MatrixClient,
  userId: string
): Promise<ChatCatalog> {
  const joinedRooms = client
    .getRooms()
    .filter((room) => room.getMyMembership() === 'join');

  const directRoomIds = getDirectRoomIds(client);
  const tandemRelationships = getResolvedTandemRelationships(client);
  const tandemMainRoomIds = new Set(
    tandemRelationships.relationships.map(
      (relationship) => relationship.mainRoomId
    )
  );
  const spaces = joinedRooms.filter(isSpaceRoom);
  const nativeSpaceNamesByRoomId = new Map<string, string>();

  spaces.filter(hasNativeSpaceMetadata).forEach((spaceRoom) => {
    const spaceName = getRoomDisplayName(spaceRoom, userId);
    getStateEvents(spaceRoom, SPACE_CHILD_EVENT_TYPE).forEach((event) => {
      const childRoomId = event.getStateKey();
      if (childRoomId) {
        nativeSpaceNamesByRoomId.set(childRoomId, spaceName);
      }
    });
  });

  const chats = joinedRooms
    .filter((room) => !isSpaceRoom(room))
    .map((room) => {
      const isDirect = directRoomIds.has(room.roomId);
      const nativeSpaceName = nativeSpaceNamesByRoomId.get(room.roomId) ?? null;
      const encryptionEvent = room.currentState.getStateEvents(
        'm.room.encryption',
        ''
      );
      const tandemRoomMeta = getTandemRoomMeta(room);
      const isTandemMain = Boolean(
        tandemMainRoomIds.has(room.roomId) ||
          room.currentState.getStateEvents(TANDEM_ROOM_EVENT_TYPE, '')
      );

      return {
        id: room.roomId,
        name: getRoomDisplayName(room, userId),
        icon: getRoomIcon(room),
        preview: getPreviewText(room),
        timestamp: getLatestTimestamp(room),
        unreadCount: room.getUnreadNotificationCount(NotificationCountType.Total),
        isDirect,
        isEncrypted: Boolean(encryptionEvent),
        memberCount: room.getJoinedMemberCount(),
        nativeSpaceName,
        source:
          isTandemMain || (isDirect && !tandemRoomMeta.archived)
            ? 'primary'
            : nativeSpaceName || !tandemRoomMeta.archived
              ? 'other'
              : 'other',
        isTandemMain,
        isPinned: Boolean(tandemRoomMeta.pinned),
        isArchived: Boolean(tandemRoomMeta.archived),
      } satisfies ChatSummary;
    })
    .filter((chat) => !getTandemRoomMeta(client.getRoom(chat.id)).hidden)
    .sort(compareChats);

  return {
    primaryChats: chats.filter(
      (chat) => chat.source === 'primary' && !chat.isArchived
    ),
    otherChats: chats.filter(
      (chat) => chat.source === 'other' || chat.isArchived
    ),
  };
}

export function getTimelineMessages(
  client: MatrixClient,
  room: Room,
  currentUserId: string
): TimelineMessage[] {
  const events = getRoomTimelineEvents(room);
  const resolvedMessages = resolveTimelineMessagesFromEvents(
    client,
    room,
    currentUserId,
    events
  );
  const readByNamesByEventId = new Map<string, string[]>();

  events.forEach((event) => {
    const eventId = event.getId();
    if (!eventId) {
      return;
    }

    readByNamesByEventId.set(
      eventId,
      room
        .getUsersReadUpTo(event)
        .filter((readerId) => {
          if (readerId === currentUserId) {
            return false;
          }

          const member = room.getMember(readerId);
          return member?.membership === 'join';
        })
        .map((readerId) => {
          const member = room.getMember(readerId);
          return member?.name || member?.rawDisplayName || readerId;
        })
        .sort((left, right) => left.localeCompare(right))
    );
  });

  return resolvedMessages.map((message) => ({
    ...message,
    readByNames: readByNamesByEventId.get(message.id) ?? [],
  }));
}

export async function buildContactCatalog(
  client: MatrixClient,
  userId: string
): Promise<ContactSummary[]> {
  const joinedRoomsResponse = await client.getJoinedRooms();
  const joinedRooms = joinedRoomsResponse.joined_rooms
    .map((roomId) => client.getRoom(roomId))
    .filter((room): room is Room => room !== null && !isSpaceRoom(room));

  await Promise.all(
    joinedRooms.map(async (room) => {
      try {
        await room.loadMembersIfNeeded();
      } catch (error) {
        console.error(`Failed to load members for room ${room.roomId}`, error);
      }
    })
  );

  const directRoomIds = getDirectRoomIds(client);
  const contactsByUserId = new Map<string, ContactSummary>();

  joinedRooms
    .filter((room) => directRoomIds.has(room.roomId))
    .forEach((room) => {
      room
        .getJoinedMembers()
        .filter((member) => member.userId !== userId)
        .forEach((member) => {
          const existingContact = contactsByUserId.get(member.userId);
          const nextContact = {
            userId: member.userId,
            displayName: member.name || member.rawDisplayName || member.userId,
            roomId: room.roomId,
            lastMessageTs: getLatestTimestamp(room),
          } satisfies ContactSummary;

          if (
            !existingContact ||
            existingContact.lastMessageTs < nextContact.lastMessageTs
          ) {
            contactsByUserId.set(member.userId, nextContact);
          }
        });
    });

  return [...contactsByUserId.values()].sort((a, b) => {
    return (
      b.lastMessageTs - a.lastMessageTs ||
      a.displayName.localeCompare(b.displayName)
    );
  });
}
