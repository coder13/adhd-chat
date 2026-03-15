import { MsgType, type MatrixClient, type MatrixEvent, type Room } from 'matrix-js-sdk';

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
  body: string;
  timestamp: number;
  isOwn: boolean;
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

  const content = latestMessageEvent.getContent<{ body?: string }>();
  return content.body?.trim() || 'No messages yet';
}

function getLatestTimestamp(room: Room) {
  return getLatestMessageEvent(room)?.getTs() ?? 0;
}

function compareChats(a: ChatSummary, b: ChatSummary) {
  return b.timestamp - a.timestamp || a.name.localeCompare(b.name);
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

      return {
        id: room.roomId,
        name: getRoomDisplayName(room, userId),
        preview: getPreviewText(room),
        timestamp: getLatestTimestamp(room),
        isDirect,
        isEncrypted: Boolean(encryptionEvent),
        memberCount: room.getJoinedMemberCount(),
        nativeSpaceName,
        source: isDirect || nativeSpaceName ? 'primary' : 'other',
      } satisfies ChatSummary;
    })
    .sort(compareChats);

  return {
    primaryChats: chats.filter((chat) => chat.source === 'primary'),
    otherChats: chats.filter((chat) => chat.source === 'other'),
  };
}

export function getTimelineMessages(room: Room, currentUserId: string): TimelineMessage[] {
  return room
    .getLiveTimeline()
    .getEvents()
    .filter((event) => event.getType() === 'm.room.message')
    .map((event) => {
      const content = event.getContent<{ body?: string; msgtype?: string }>();

      return {
        id: event.getId() ?? `${event.getTs()}`,
        senderId: event.getSender() ?? 'Unknown sender',
        body:
          content.msgtype === MsgType.Text || !content.msgtype
            ? content.body ?? ''
            : `[${content.msgtype}] ${content.body ?? ''}`,
        timestamp: event.getTs(),
        isOwn: event.getSender() === currentUserId,
      };
    })
    .filter((message) => message.body.trim().length > 0)
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
