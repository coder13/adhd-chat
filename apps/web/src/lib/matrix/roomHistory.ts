import type { MatrixClient, Room } from 'matrix-js-sdk';
import { getRoomTimelineEvents } from './timelineEvents';

const DEFAULT_HISTORY_PAGE_SIZE = 50;

type RoomHistoryBridge = {
  oldState?: {
    paginationToken?: string | null;
  };
};

export interface RoomHistoryPaginationResult {
  didPaginate: boolean;
  hasMore: boolean;
}

export function hasMoreRoomHistoryBack(room: Room) {
  return (room as RoomHistoryBridge).oldState?.paginationToken !== null;
}

export async function paginateRoomHistoryBack(
  client: MatrixClient,
  room: Room,
  limit = DEFAULT_HISTORY_PAGE_SIZE
): Promise<RoomHistoryPaginationResult> {
  if (!hasMoreRoomHistoryBack(room)) {
    return {
      didPaginate: false,
      hasMore: false,
    };
  }

  const previousEventCount = getRoomTimelineEvents(room).length;

  await client.scrollback(room, limit);

  const nextEventCount = getRoomTimelineEvents(room).length;

  return {
    didPaginate: nextEventCount > previousEventCount,
    hasMore: hasMoreRoomHistoryBack(room),
  };
}
