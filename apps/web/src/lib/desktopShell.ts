import type { MatrixClient } from 'matrix-js-sdk';
import { loadPersistedValue, savePersistedValue } from './persistence';
import type { TandemSpaceSummary } from './matrix/spaceCatalog';
import { getTandemSpaceIdForRoom } from './matrix/tandem';

const DESKTOP_RAIL_STATE_KEY = 'desktop-room-rail-state';

export type DesktopShellRailView =
  | 'topics'
  | 'settings'
  | 'contacts'
  | 'other'
  | 'hubs'
  | 'add-contact';

interface PersistedDesktopRailState {
  railView: DesktopShellRailView;
  settingsSection:
    | 'menu'
    | 'profile'
    | 'notifications'
    | 'encryption'
    | 'account'
    | 'devices'
    | 'unverified-devices'
    | 'chat-appearance';
  settingsHistory: PersistedDesktopRailState['settingsSection'][];
}

function keyFor(userId: string | null | undefined, suffix: string) {
  return userId ? `desktop-shell:${userId}:${suffix}` : null;
}

function getDesktopRailStateKey(userId: string | null | undefined) {
  return userId ? `${DESKTOP_RAIL_STATE_KEY}:${userId}` : null;
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

export function saveDesktopRailState(params: {
  userId: string | null | undefined;
  railView: DesktopShellRailView;
  settingsSection?: PersistedDesktopRailState['settingsSection'];
  settingsHistory?: PersistedDesktopRailState['settingsSection'][];
}) {
  const railStateKey = getDesktopRailStateKey(params.userId);
  if (!railStateKey) {
    return;
  }

  savePersistedValue<PersistedDesktopRailState>(railStateKey, {
    railView: params.railView,
    settingsSection: params.settingsSection ?? 'menu',
    settingsHistory: params.settingsHistory ?? [],
  });
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
