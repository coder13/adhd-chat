import type { MatrixClient } from 'matrix-js-sdk';
import { useMatrixRoomEvents } from './useMatrixRoomEvents';
import { useMatrixViewResource } from './useMatrixViewResource';
import {
  loadOtherChatCatalog,
  patchOtherChatCatalogAction,
  preserveNonEmptyArray,
} from '../lib/matrix/store/matrixViewActions';
import type { ChatSummary } from '../lib/matrix/chatCatalog';

interface UseOtherChatCatalogStoreOptions {
  client: MatrixClient | null;
  enabled: boolean;
  isReady: boolean;
  userId: string | null;
}

export function useOtherChatCatalogStore({
  client,
  enabled,
  isReady,
  userId,
}: UseOtherChatCatalogStoreOptions) {
  const cacheKey = userId ? `other-rooms:${userId}` : null;
  const resource = useMatrixViewResource<ChatSummary[]>({
    cacheKey,
    enabled: Boolean(client && userId && enabled),
    initialValue: [],
    storage: 'indexeddb',
    load: async () => loadOtherChatCatalog(client!, userId!),
    preserveValue: preserveNonEmptyArray,
  });

  useMatrixRoomEvents({
    client,
    enabled: Boolean(client && userId && enabled && isReady),
    onRoomChange: (room) => {
      if (!client || !userId) {
        return;
      }

      resource.updateData((currentChats) =>
        patchOtherChatCatalogAction(currentChats, client, userId, room)
      );
    },
  });

  return resource;
}
