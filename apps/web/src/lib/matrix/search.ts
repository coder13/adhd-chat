import type { ISearchResults, MatrixClient, SearchResult } from 'matrix-js-sdk';
import { buildChatCatalog } from './chatCatalog';
import {
  getRoomTimelineEvents,
  getTimelineEventContent,
  isRenderableTimelineMessage,
} from './timelineEvents';

export interface TandemSearchRoomSummary {
  roomId: string;
  roomName: string;
  roomIcon: string | null;
  hubName: string | null;
  isEncrypted: boolean;
}

export interface TandemSearchIndex {
  rooms: TandemSearchRoomSummary[];
  encryptedRoomCount: number;
}

export interface TandemMessageSearchResult {
  id: string;
  eventId: string | null;
  roomId: string;
  roomName: string;
  roomIcon: string | null;
  hubName: string | null;
  senderName: string;
  body: string;
  timestamp: number;
  source: 'server' | 'local-encrypted';
}

function normalizeBody(result: SearchResult) {
  return (
    result.context.ourEvent.getContent<{ body?: string }>().body?.trim() ||
    'Message'
  );
}

function normalizeSenderName(result: SearchResult) {
  return (
    result.context.ourEvent.sender?.name ||
    result.context.ourEvent.getSender() ||
    'Unknown sender'
  );
}

export async function buildTandemSearchIndex(
  client: MatrixClient,
  userId: string
): Promise<TandemSearchIndex> {
  const catalog = await buildChatCatalog(client, userId);
  const rooms = [...catalog.primaryChats, ...catalog.otherChats].map((chat) => ({
    roomId: chat.id,
    roomName: chat.name,
    roomIcon: chat.icon,
    hubName: chat.nativeSpaceName,
    isEncrypted: chat.isEncrypted,
  }));

  return {
    rooms,
    encryptedRoomCount: rooms.filter((room) => room.isEncrypted).length,
  };
}

export function mapTandemSearchResults(
  results: ISearchResults,
  index: TandemSearchIndex
): TandemMessageSearchResult[] {
  const roomsById = new Map(index.rooms.map((room) => [room.roomId, room]));
  const mappedResults: TandemMessageSearchResult[] = [];

  results.results.forEach((result) => {
    const event = result.context.ourEvent;
    const roomId = event.getRoomId();
    if (!roomId) {
      return;
    }

    const room = roomsById.get(roomId);
    if (!room) {
      return;
    }

    const eventId = event.getId() ?? null;
    mappedResults.push({
      id: eventId || `${roomId}:${event.getTs()}:${result.rank}`,
      eventId,
      roomId,
      roomName: room.roomName,
      roomIcon: room.roomIcon,
      hubName: room.hubName,
      senderName: normalizeSenderName(result),
      body: normalizeBody(result),
      timestamp: event.getTs(),
      source: 'server',
    });
  });

  return mappedResults;
}

export function searchLoadedEncryptedMessages(
  client: MatrixClient,
  index: TandemSearchIndex,
  term: string
) {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return [] as TandemMessageSearchResult[];
  }

  const encryptedRooms = index.rooms.filter((room) => room.isEncrypted);

  const matches: TandemMessageSearchResult[] = [];

  encryptedRooms.forEach((roomSummary) => {
    const room = client.getRoom(roomSummary.roomId);
    if (!room) {
      return;
    }

    getRoomTimelineEvents(room)
      .filter((event) => isRenderableTimelineMessage(event))
      .forEach((event) => {
        const content = getTimelineEventContent(event);
        const body = content.body?.trim();
        if (!body || !body.toLowerCase().includes(normalizedTerm)) {
          return;
        }

        const eventId = event.getId() ?? null;
        matches.push({
          id:
            eventId ||
            `local:${roomSummary.roomId}:${event.getTs()}:${body.slice(0, 24)}`,
          eventId,
          roomId: roomSummary.roomId,
          roomName: roomSummary.roomName,
          roomIcon: roomSummary.roomIcon,
          hubName: roomSummary.hubName,
          senderName: event.sender?.name || event.getSender() || 'Unknown sender',
          body,
          timestamp: event.getTs(),
          source: 'local-encrypted',
        });
      });
  });

  return matches.sort((a, b) => b.timestamp - a.timestamp);
}

export function mergeTandemSearchResults(
  serverResults: TandemMessageSearchResult[],
  localResults: TandemMessageSearchResult[]
) {
  const merged = [...serverResults];
  const seenKeys = new Set(
    serverResults.map((result) => result.eventId || result.id)
  );

  localResults.forEach((result) => {
    const key = result.eventId || result.id;
    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    merged.push(result);
  });

  return merged.sort((a, b) => b.timestamp - a.timestamp);
}
