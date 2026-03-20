import { createId } from '../id';
import { createTandemChildRoom, type TandemRelationshipRecord } from './tandem';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  clearPersistedValueAsync,
  loadPersistedValueAsync,
  savePersistedValueAsync,
} from '../asyncPersistence';

const STORAGE_KEY = 'tandem.pending_rooms';
const PENDING_ROOM_PREFIX = 'pending:tandem:';

export type PendingTandemRoomStatus = 'creating' | 'ready' | 'failed';

export interface PendingTandemRoomRecord {
  pendingRoomId: string;
  roomName: string;
  topic?: string;
  sharedSpaceId: string;
  partnerUserId: string;
  createdAt: number;
  status: PendingTandemRoomStatus;
  roomId?: string;
  error?: string;
}

type PendingRoomListener = () => void;

const listeners = new Set<PendingRoomListener>();
let hydrationPromise: Promise<void> | null = null;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function canUseSessionStorage() {
  return (
    typeof window !== 'undefined' &&
    typeof window.sessionStorage !== 'undefined'
  );
}

function readPendingRoomsFromSessionStorage() {
  if (!canUseSessionStorage()) {
    return {} as Record<string, PendingTandemRoomRecord>;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {} as Record<string, PendingTandemRoomRecord>;
    }

    const parsed = JSON.parse(raw) as Record<string, PendingTandemRoomRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (cause) {
    console.error('Failed to read pending Tandem rooms', cause);
    return {} as Record<string, PendingTandemRoomRecord>;
  }
}

let pendingRoomsState = readPendingRoomsFromSessionStorage();

function hasPendingRooms(pendingRooms: Record<string, PendingTandemRoomRecord>) {
  return Object.keys(pendingRooms).length > 0;
}

function persistPendingRooms(next: Record<string, PendingTandemRoomRecord>) {
  if (hasPendingRooms(next)) {
    void savePersistedValueAsync(STORAGE_KEY, next, {
      bucket: 'pending-actions',
    });
    return;
  }

  void clearPersistedValueAsync(STORAGE_KEY, { bucket: 'pending-actions' });
}

function writePendingRoomsMirror(next: Record<string, PendingTandemRoomRecord>) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    if (hasPendingRooms(next)) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch (cause) {
    console.error('Failed to write pending Tandem rooms session mirror', cause);
  }
}

function writePendingRooms(next: Record<string, PendingTandemRoomRecord>) {
  pendingRoomsState = next;
  writePendingRoomsMirror(next);
  persistPendingRooms(next);
  emitChange();
}

function ensurePendingRoomsHydrated() {
  if (hydrationPromise) {
    return hydrationPromise;
  }

  hydrationPromise = loadPersistedValueAsync<
    Record<string, PendingTandemRoomRecord>
  >(STORAGE_KEY, { bucket: 'pending-actions' })
    .then((persistedPendingRooms) => {
      if (!persistedPendingRooms || !hasPendingRooms(persistedPendingRooms)) {
        if (hasPendingRooms(pendingRoomsState)) {
          persistPendingRooms(pendingRoomsState);
        }
        return;
      }

      const mergedPendingRooms = {
        ...persistedPendingRooms,
        ...pendingRoomsState,
      };
      const nextState = JSON.stringify(mergedPendingRooms);
      const currentState = JSON.stringify(pendingRoomsState);
      if (nextState === currentState) {
        return;
      }

      pendingRoomsState = mergedPendingRooms;
      writePendingRoomsMirror(mergedPendingRooms);
      emitChange();
    })
    .catch((cause) => {
      console.error('Failed to hydrate pending Tandem rooms', cause);
    });

  return hydrationPromise;
}

function upsertPendingRoom(record: PendingTandemRoomRecord) {
  const pendingRooms = readPendingRooms();
  pendingRooms[record.pendingRoomId] = record;
  writePendingRooms(pendingRooms);
}

export function isPendingTandemRoomId(roomId: string) {
  return roomId.startsWith(PENDING_ROOM_PREFIX);
}

export function getPendingTandemRoom(roomId: string | null) {
  if (!roomId || !isPendingTandemRoomId(roomId)) {
    return null;
  }

  return readPendingRooms()[roomId] ?? null;
}

export function subscribeToPendingTandemRooms(listener: PendingRoomListener) {
  listeners.add(listener);
  void ensurePendingRoomsHydrated();

  return () => {
    listeners.delete(listener);
  };
}

export function getPendingTandemRooms() {
  return Object.values(readPendingRooms()).sort(
    (left, right) => right.createdAt - left.createdAt
  );
}

export function getPendingTandemRoomsForSpace(spaceId: string) {
  return getPendingTandemRooms().filter(
    (room) => room.sharedSpaceId === spaceId && room.status !== 'ready'
  );
}

export function clearPendingTandemRoom(roomId: string) {
  const pendingRooms = readPendingRooms();
  if (!pendingRooms[roomId]) {
    return;
  }

  delete pendingRooms[roomId];
  writePendingRooms(pendingRooms);
}

function readPendingRooms() {
  void ensurePendingRoomsHydrated();
  return { ...pendingRoomsState };
}

export function startPendingTandemRoomCreation(params: {
  client: MatrixClient;
  relationship: TandemRelationshipRecord;
  creatorUserId: string;
  name?: string;
  topic?: string;
}) {
  const { client, relationship, creatorUserId, name, topic } = params;
  const pendingRoomId = `${PENDING_ROOM_PREFIX}${createId('room')}`;
  const record: PendingTandemRoomRecord = {
    pendingRoomId,
    roomName: name?.trim() || 'Tangent',
    topic: topic?.trim() || undefined,
    sharedSpaceId: relationship.sharedSpaceId,
    partnerUserId: relationship.partnerUserId,
    createdAt: Date.now(),
    status: 'creating',
  };

  upsertPendingRoom(record);

  void (async () => {
    try {
      const roomId = await createTandemChildRoom({
        client,
        relationship,
        creatorUserId,
        name,
        topic,
      });

      upsertPendingRoom({
        ...record,
        status: 'ready',
        roomId,
      });
    } catch (cause) {
      upsertPendingRoom({
        ...record,
        status: 'failed',
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  })();

  return record;
}
