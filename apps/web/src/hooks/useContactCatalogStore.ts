import type { MatrixClient } from 'matrix-js-sdk';
import { useMatrixRoomEvents } from './useMatrixRoomEvents';
import { useMatrixViewResource } from './useMatrixViewResource';
import {
  loadContactCatalog,
  patchContactCatalogAction,
  preserveNonEmptyArray,
} from '../lib/matrix/store/matrixViewActions';
import { applyContactCatalogRoomPatch } from '../lib/matrix/catalogPatches';
import type { ContactSummary } from '../lib/matrix/chatCatalog';

interface UseContactCatalogStoreOptions {
  client: MatrixClient | null;
  enabled: boolean;
  isReady: boolean;
  userId: string | null;
}

export function useContactCatalogStore({
  client,
  enabled,
  isReady,
  userId,
}: UseContactCatalogStoreOptions) {
  const cacheKey = userId ? `contacts:${userId}` : null;
  const resource = useMatrixViewResource<ContactSummary[]>({
    cacheKey,
    enabled: Boolean(client && userId && enabled),
    initialValue: [],
    storage: 'indexeddb',
    load: async () => loadContactCatalog(client!, userId!),
    preserveValue: preserveNonEmptyArray,
  });

  useMatrixRoomEvents({
    client,
    enabled: Boolean(client && userId && enabled && isReady),
    onRoomChange: (room) => {
      if (!client || !userId) {
        return;
      }

      void patchContactCatalogAction(client, userId, room).then(
        ({ roomContacts, roomId }) => {
          resource.updateData((currentContacts) =>
            applyContactCatalogRoomPatch(
              currentContacts,
              roomId,
              roomContacts
            )
          );
        }
      );
    },
  });

  return resource;
}
