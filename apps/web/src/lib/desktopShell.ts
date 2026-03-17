import type { MatrixClient } from 'matrix-js-sdk';
import { loadPersistedValue, savePersistedValue } from './persistence';
import type { TandemSpaceSummary } from './matrix/spaceCatalog';
import { getTandemSpaceIdForRoom } from './matrix/tandem';

function keyFor(userId: string | null | undefined, suffix: string) {
  return userId ? `desktop-shell:${userId}:${suffix}` : null;
}

export function saveDesktopLastSelection(params: {
  userId: string | null | undefined;
  spaceId: string;
  roomId: string;
}) {
  const hubKey = keyFor(params.userId, 'last-hub');
  const roomKey = keyFor(params.userId, 'last-room');

  if (hubKey) {
    savePersistedValue(hubKey, params.spaceId);
  }

  if (roomKey) {
    savePersistedValue(roomKey, params.roomId);
  }
}

export function loadDesktopLastSelection(userId: string | null | undefined) {
  const hubKey = keyFor(userId, 'last-hub');
  const roomKey = keyFor(userId, 'last-room');

  return {
    lastHubId: hubKey ? loadPersistedValue<string>(hubKey) : null,
    lastRoomId: roomKey ? loadPersistedValue<string>(roomKey) : null,
  };
}

export function resolveDesktopHomeTarget(params: {
  client: MatrixClient | null;
  userId: string | null | undefined;
  spaces: TandemSpaceSummary[];
}) {
  const { client, userId, spaces } = params;
  if (!client || !userId || spaces.length === 0) {
    return null;
  }

  const { lastHubId, lastRoomId } = loadDesktopLastSelection(userId);
  const selectedSpace =
    spaces.find((space) => space.spaceId === lastHubId) ?? spaces[0] ?? null;

  if (!selectedSpace) {
    return null;
  }

  if (lastRoomId) {
    const lastRoom = client.getRoom(lastRoomId);
    if (
      lastRoom &&
      lastRoom.getMyMembership() === 'join' &&
      getTandemSpaceIdForRoom(client, lastRoom) === selectedSpace.spaceId
    ) {
      return {
        spaceId: selectedSpace.spaceId,
        roomId: lastRoomId,
      };
    }
  }

  return {
    spaceId: selectedSpace.spaceId,
    roomId: selectedSpace.mainRoomId,
  };
}
