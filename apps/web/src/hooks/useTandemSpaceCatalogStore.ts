import { useEffect } from 'react';
import { useMatrixRoomEvents } from './useMatrixRoomEvents';
import { useMatrixViewResource } from './useMatrixViewResource';
import {
  loadTandemSpaceCatalog,
  patchTandemSpaceCatalogAction,
  preserveNonEmptyArray,
} from '../lib/matrix/store/matrixViewActions';
import type { MatrixClient } from 'matrix-js-sdk';
import type { TandemRelationshipRecord } from '../lib/matrix/tandem';
import type { TandemSpaceSummary } from '../lib/matrix/spaceCatalog';

interface UseTandemSpaceCatalogStoreOptions {
  client: MatrixClient | null;
  enabled: boolean;
  isReady: boolean;
  relationships: TandemRelationshipRecord[];
  userId: string | null;
}

export function useTandemSpaceCatalogStore({
  client,
  enabled,
  isReady,
  relationships,
  userId,
}: UseTandemSpaceCatalogStoreOptions) {
  const cacheKey = userId ? `tandem-spaces:${userId}` : null;
  const resource = useMatrixViewResource<TandemSpaceSummary[]>({
    cacheKey,
    enabled: Boolean(client && userId && enabled),
    initialValue: [],
    storage: 'indexeddb',
    load: async () => loadTandemSpaceCatalog(client!, userId!),
    preserveValue: preserveNonEmptyArray,
  });
  const { refresh } = resource;

  useMatrixRoomEvents({
    client,
    enabled: Boolean(client && userId && enabled && isReady),
    onRoomChange: (room) => {
      if (!client || !userId) {
        return;
      }

      resource.updateData((currentSpaces) =>
        patchTandemSpaceCatalogAction(
          currentSpaces,
          client,
          userId,
          relationships,
          room
        )
      );
    },
  });

  useEffect(() => {
    if (!client || !userId || relationships.length === 0) {
      return;
    }

    void refresh();
  }, [client, refresh, relationships, userId]);

  return resource;
}
