import { createId } from '../id';
import { createTandemChildRoom, type TandemRelationshipRecord } from './tandem';
import type { MatrixClient } from 'matrix-js-sdk';

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

function emitChange() {
  listeners.forEach((listener) => listener());
}

function canUseStorage() {
  return (
    typeof window !== 'undefined' &&
    typeof window.sessionStorage !== 'undefined'
  );
}

function readPendingRooms() {
  if (!canUseStorage()) {
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

function writePendingRooms(next: Record<string, PendingTandemRoomRecord>) {
  if (!canUseStorage()) {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitChange();
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

  return () => {
    listeners.delete(listener);
  };
}

export function clearPendingTandemRoom(roomId: string) {
  const pendingRooms = readPendingRooms();
  if (!pendingRooms[roomId]) {
    return;
  }

  delete pendingRooms[roomId];
  writePendingRooms(pendingRooms);
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
