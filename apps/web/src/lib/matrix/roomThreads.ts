import type { Room } from 'matrix-js-sdk';

type RoomThreadBootstrapBridge = {
  createThreadsTimelineSets: () => Promise<unknown>;
  fetchRoomThreads: () => Promise<void>;
  threadsReady?: boolean;
  threadsTimelineSets?: unknown[];
};

export async function ensureRoomThreadsLoaded(room: Room) {
  const threadRoom = room as unknown as RoomThreadBootstrapBridge;
  const hadThreadTimelineSets =
    (threadRoom.threadsTimelineSets?.length ?? 0) > 0;
  const wasThreadsReady = threadRoom.threadsReady === true;

  await threadRoom.createThreadsTimelineSets();

  if ((threadRoom.threadsTimelineSets?.length ?? 0) === 0) {
    return;
  }

  // The SDK treats fetchRoomThreads as one-shot. If the room was already marked
  // ready before its thread timeline sets existed, reset that guard once so we
  // can bootstrap threads for the current session.
  if (wasThreadsReady && !hadThreadTimelineSets) {
    threadRoom.threadsReady = false;
  }

  if (!wasThreadsReady || !hadThreadTimelineSets) {
    await room.fetchRoomThreads();
  }
}
