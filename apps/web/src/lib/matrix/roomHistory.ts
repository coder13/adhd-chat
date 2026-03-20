import type { MatrixClient, Room } from 'matrix-js-sdk';
import { getRoomTimelineEvents } from './timelineEvents';
import { startMatrixPerfTimer } from './performanceMetrics';

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
  const timer = startMatrixPerfTimer('matrix.room.history.paginate_back', {
    roomId: room.roomId,
    limit,
  });
  if (!hasMoreRoomHistoryBack(room)) {
    timer.end({
      didPaginate: false,
      hasMore: false,
      addedEventCount: 0,
    });
    return {
      didPaginate: false,
      hasMore: false,
    };
  }

  const previousEventCount = getRoomTimelineEvents(room).length;

  await client.scrollback(room, limit);

  const nextEventCount = getRoomTimelineEvents(room).length;
  const didPaginate = nextEventCount > previousEventCount;
  const hasMore = hasMoreRoomHistoryBack(room);

  timer.end({
    didPaginate,
    hasMore,
    previousEventCount,
    nextEventCount,
    addedEventCount: Math.max(0, nextEventCount - previousEventCount),
  });

  return {
    didPaginate,
    hasMore,
  };
}
