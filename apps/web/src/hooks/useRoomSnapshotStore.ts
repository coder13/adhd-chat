import { useCallback, useMemo, useRef } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useMatrixViewResource } from './useMatrixViewResource';
import {
  createInitialRoomSnapshot,
  loadRoomSnapshotAction,
  paginateRoomSnapshotAction,
  persistNormalizedRoomSnapshot,
  refreshRoomSnapshotAction,
} from '../lib/matrix/store/matrixViewActions';
import { normalizeRoomSnapshotOwnership } from '../lib/matrix/store/normalizeRoomSnapshot';
import type { RoomSnapshot } from '../lib/matrix/roomSnapshot';

interface UseRoomSnapshotStoreOptions {
  client: MatrixClient | null;
  enabled: boolean;
  roomId: string | null;
  userId: string | null;
}

export function useRoomSnapshotStore({
  client,
  enabled,
  roomId,
  userId,
}: UseRoomSnapshotStoreOptions) {
  const cacheKey = userId && roomId ? `room:${userId}:${roomId}` : null;
  const initialSnapshotRef = useRef<{
    cacheKey: string | null;
    value: RoomSnapshot;
  } | null>(null);

  if (
    initialSnapshotRef.current === null ||
    initialSnapshotRef.current.cacheKey !== cacheKey
  ) {
    initialSnapshotRef.current = {
      cacheKey,
      value: createInitialRoomSnapshot(),
    };
  }

  const initialSnapshot = initialSnapshotRef.current.value;
  const resource = useMatrixViewResource<RoomSnapshot>({
    cacheKey,
    enabled: Boolean(client && userId && roomId && enabled),
    initialValue: initialSnapshot,
    storage: 'indexeddb',
    load: async () => loadRoomSnapshotAction(client!, userId!, roomId!),
  });
  const { updateData: baseUpdateData } = resource;
  const data = useMemo(
    () => normalizeRoomSnapshotOwnership(resource.data, userId),
    [resource.data, userId]
  );

  const refresh = useCallback(async () => {
    if (!client || !userId || !roomId) {
      return;
    }

    const nextSnapshot = await refreshRoomSnapshotAction(client, userId, roomId);
    baseUpdateData(normalizeRoomSnapshotOwnership(nextSnapshot, userId));
  }, [baseUpdateData, client, roomId, userId]);

  const updateData = useCallback(
    (
      updater:
        | RoomSnapshot
        | ((currentValue: RoomSnapshot) => RoomSnapshot)
    ) => {
      const nextSnapshot = baseUpdateData((currentValue) => {
        const normalizedCurrentValue = normalizeRoomSnapshotOwnership(
          currentValue,
          userId
        );
        const rawNextSnapshot =
          typeof updater === 'function'
            ? updater(normalizedCurrentValue)
            : updater;

        return normalizeRoomSnapshotOwnership(rawNextSnapshot, userId);
      });

      if (userId && roomId) {
        void persistNormalizedRoomSnapshot(userId, roomId, nextSnapshot);
      }

      return nextSnapshot;
    },
    [baseUpdateData, roomId, userId]
  );

  const paginateBack = useCallback(async () => {
    if (!client || !userId || !roomId) {
      return null;
    }

    const nextSnapshot = await paginateRoomSnapshotAction(client, userId, roomId);

    if (nextSnapshot) {
      baseUpdateData(normalizeRoomSnapshotOwnership(nextSnapshot, userId));
    }

    return nextSnapshot;
  }, [baseUpdateData, client, roomId, userId]);

  return {
    ...resource,
    data,
    refresh,
    updateData,
    paginateBack,
  };
}
