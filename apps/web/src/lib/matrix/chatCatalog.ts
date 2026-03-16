import { MsgType, type MatrixClient, type MatrixEvent, type Room } from 'matrix-js-sdk';
import {
  getResolvedTandemRelationships,
  getTandemRoomMeta,
  TANDEM_ROOM_EVENT_TYPE,
} from './tandem';

const ADHD_CHAT_SPACE_EVENT_TYPE = 'dev.adhd-chat.space';
const ROOM_CREATE_EVENT_TYPE = 'm.room.create';
const SPACE_CHILD_EVENT_TYPE = 'm.space.child';
const DIRECT_ACCOUNT_DATA_EVENT_TYPE = 'm.direct';
const SPACE_ROOM_TYPE = 'm.space';

export type ChatSummary = {
  id: string;
  name: string;
  preview: string;
  timestamp: number;
  isDirect: boolean;
  isEncrypted: boolean;
  memberCount: number;
  nativeSpaceName: string | null;
  source: 'primary' | 'other';
  isTandemMain: boolean;
  isPinned: boolean;
  isArchived: boolean;
  category: string | null;
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
  timestamp: number;
  isOwn: boolean;
  msgtype: string;
  mediaUrl?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
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
    room.currentState.getStateEvents(eventType) as MatrixEvent | MatrixEvent[] | null
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

  return content?.kind === 'adhd-chat-space' && typeof content.version === 'number';
}

function getLatestMessageEvent(room: Room) {
  const events = room.getLiveTimeline().getEvents();

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.getType() !== 'm.room.message') {
      continue;
    }

    const content = event.getContent<{ body?: string; msgtype?: string }>();
    if (
      content.msgtype === MsgType.Text ||
      content.msgtype === MsgType.Image ||
      content.msgtype === MsgType.File ||
      content.msgtype === MsgType.Audio ||
      content.msgtype === MsgType.Video ||
      content.msgtype === MsgType.Emote ||
      content.msgtype === MsgType.Notice ||
      !content.msgtype
    ) {
      return event;
    }
  }

  return null;
}

function getPreviewText(room: Room) {
  const latestMessageEvent = getLatestMessageEvent(room);
  if (!latestMessageEvent) {
    return 'No messages yet';
  }

  const content = latestMessageEvent.getContent<{
    body?: string;
    msgtype?: string;
  }>();

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

  const directRoomIds = getDirectRoomIds(client);
  const tandemRelationships = getResolvedTandemRelationships(client);
  const tandemMainRoomIds = new Set(
    tandemRelationships.relationships.map((relationship) => relationship.mainRoomId)
  );
  const spaces = joinedRooms.filter(isSpaceRoom);
  const nativeSpaceNamesByRoomId = new Map<string, string>();

  spaces
    .filter(hasNativeSpaceMetadata)
    .forEach((spaceRoom) => {
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
      const encryptionEvent = room.currentState.getStateEvents('m.room.encryption', '');
      const tandemRoomMeta = getTandemRoomMeta(room);
      const isTandemMain = Boolean(
        tandemMainRoomIds.has(room.roomId) ||
          room.currentState.getStateEvents(TANDEM_ROOM_EVENT_TYPE, '')
      );

      return {
        id: room.roomId,
        name: getRoomDisplayName(room, userId),
        preview: getPreviewText(room),
        timestamp: getLatestTimestamp(room),
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
        category: tandemRoomMeta.category ?? null,
      } satisfies ChatSummary;
    })
    .filter((chat) => !getTandemRoomMeta(client.getRoom(chat.id)).hidden)
    .sort(compareChats);

  return {
    primaryChats: chats.filter((chat) => chat.source === 'primary' && !chat.isArchived),
    otherChats: chats.filter((chat) => chat.source === 'other' || chat.isArchived),
  };
}

export function getTimelineMessages(
  client: MatrixClient,
  room: Room,
  currentUserId: string
): TimelineMessage[] {
  return room
    .getLiveTimeline()
    .getEvents()
    .filter((event) => event.getType() === 'm.room.message')
    .map((event) => {
      const content = event.getContent<{
        body?: string;
        msgtype?: string;
        url?: string;
        info?: {
          mimetype?: string;
          size?: number;
          w?: number;
          h?: number;
        };
      }>();
      const mediaUrl = content.url
        ? client.mxcUrlToHttp(
            content.url,
            undefined,
            undefined,
            undefined,
            false,
            true,
            true
          ) ?? null
        : null;
      const msgtype = content.msgtype ?? MsgType.Text;
      const body = (() => {
        switch (msgtype) {
          case MsgType.Image:
            return content.body ?? 'Image';
          case MsgType.File:
            return content.body ?? 'File';
          case MsgType.Audio:
            return content.body ?? 'Audio';
          case MsgType.Video:
            return content.body ?? 'Video';
          case MsgType.Emote:
            return content.body ?? '';
          case MsgType.Notice:
          case MsgType.Text:
          default:
            return content.body ?? '';
        }
      })();

      return {
        id: event.getId() ?? `${event.getTs()}`,
        senderId: event.getSender() ?? 'Unknown sender',
        senderName:
          room.getMember(event.getSender() ?? '')?.name ||
          room.getMember(event.getSender() ?? '')?.rawDisplayName ||
          event.getSender() ||
          'Unknown sender',
        body,
        timestamp: event.getTs(),
        isOwn: event.getSender() === currentUserId,
        msgtype,
        mediaUrl,
        mimeType: content.info?.mimetype ?? null,
        fileSize: content.info?.size ?? null,
        imageWidth: content.info?.w ?? null,
        imageHeight: content.info?.h ?? null,
      };
    })
    .filter((message) => message.body.trim().length > 0 || Boolean(message.mediaUrl))
    .sort((a, b) => a.timestamp - b.timestamp);
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
    return b.lastMessageTs - a.lastMessageTs || a.displayName.localeCompare(b.displayName);
  });
}
