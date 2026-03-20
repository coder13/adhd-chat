import { useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useMatrixRoomEvents } from './useMatrixRoomEvents';
import { useMatrixViewResource } from './useMatrixViewResource';
import {
  loadTandemSpaceRoomCatalog,
  patchTandemSpaceRoomCatalogAction,
  preserveNonEmptyArray,
  replaceTandemSpaceRoomCatalogAction,
} from '../lib/matrix/store/matrixViewActions';
import { subscribeToPendingTandemRooms } from '../lib/matrix/pendingTandemRoom';
import type { TandemSpaceRoomSummary } from '../lib/matrix/spaceCatalog';

interface UseTandemSpaceRoomCatalogStoreOptions {
  client: MatrixClient | null;
  enabled: boolean;
  isReady: boolean;
  spaceId: string | null;
  userId: string | null;
}

export function useTandemSpaceRoomCatalogStore({
  client,
  enabled,
  isReady,
  spaceId,
  userId,
}: UseTandemSpaceRoomCatalogStoreOptions) {
  const cacheKey =
    userId && spaceId ? `space-rooms:${userId}:${spaceId}` : null;
  const resource = useMatrixViewResource<TandemSpaceRoomSummary[]>({
    cacheKey,
    enabled: Boolean(client && userId && spaceId && enabled),
    initialValue: [],
    storage: 'indexeddb',
    load: async () => loadTandemSpaceRoomCatalog(client!, userId!, spaceId!),
    preserveValue: preserveNonEmptyArray,
  });
  const { updateData } = resource;

  useMatrixRoomEvents({
    client,
    enabled: Boolean(client && userId && spaceId && enabled && isReady),
    onRoomChange: (room) => {
      if (!client || !userId || !spaceId) {
        return;
      }

      updateData((currentRooms) =>
        patchTandemSpaceRoomCatalogAction(
          currentRooms,
          client,
          userId,
          spaceId,
          room
        )
      );
    },
  });

  useEffect(() => {
    if (!client || !userId || !spaceId) {
      return;
    }

    const syncPendingRooms = () => {
      updateData(
        replaceTandemSpaceRoomCatalogAction(client, userId, spaceId)
      );
    };

    return subscribeToPendingTandemRooms(syncPendingRooms);
  }, [client, spaceId, updateData, userId]);

  return resource;
}
