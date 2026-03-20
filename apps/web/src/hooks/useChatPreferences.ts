import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { usePersistedResource } from './usePersistedResource';
import { recordChatPreferenceDebugEvent } from '../lib/matrix/chatPreferenceDebug';
import {
  attachTandemPreferencesListener,
  getResolvedRoomNotificationMode,
  getTandemPreferences,
  setAccountNotificationMode,
  setChatViewMode,
  setRoomNotificationMode,
  type ChatViewMode,
  type NotificationMode,
  type RoomNotificationMode,
  type TandemPreferences,
} from '../lib/matrix/preferences';

const DEFAULT_PREFERENCES: TandemPreferences = {
  chatViewMode: 'timeline',
  accountNotificationMode: 'all',
  roomNotificationOverrides: {},
};

function getInitialPreferences() {
  return DEFAULT_PREFERENCES;
}

export function useChatPreferences(
  client: MatrixClient | null,
  currentUserId: string | null | undefined
) {
  const cacheKey = currentUserId ? `tandem-preferences:${currentUserId}` : null;
  const isEnabled = Boolean(client && currentUserId);
  const initialPreferences = useMemo(
    () => getInitialPreferences(),
    []
  );
  const {
    data: preferences,
    refresh,
    updateData,
    isLoading,
    hasCachedData,
  } =
    usePersistedResource<TandemPreferences>({
      cacheKey,
      enabled: isEnabled,
      initialValue: initialPreferences,
      storage: 'localStorage',
      load: async () =>
        client
          ? getTandemPreferences(client)
          : DEFAULT_PREFERENCES,
    });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoaded =
    Boolean(currentUserId) &&
    (hasCachedData || Boolean(isEnabled && !isLoading));
  const previousStateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!client || !currentUserId) {
      return;
    }

    return attachTandemPreferencesListener(client, refresh);
  }, [client, currentUserId, refresh]);

  useEffect(() => {
    const nextState = JSON.stringify({
      cacheKey,
      currentUserId,
      hasCachedData,
      isEnabled,
      isLoaded,
      isLoading,
      preferenceMode: preferences.chatViewMode,
      initialMode: initialPreferences.chatViewMode,
    });
    if (previousStateRef.current === nextState) {
      return;
    }

    previousStateRef.current = nextState;
    recordChatPreferenceDebugEvent('useChatPreferences.state', {
      cacheKey,
      currentUserId,
      hasCachedData,
      isEnabled,
      isLoaded,
      isLoading,
      preferenceMode: preferences.chatViewMode,
      initialMode: initialPreferences.chatViewMode,
    });
  }, [
    cacheKey,
    currentUserId,
    hasCachedData,
    initialPreferences.chatViewMode,
    isEnabled,
    isLoaded,
    isLoading,
    preferences.chatViewMode,
  ]);

  const updateChatViewMode = useCallback(
    async (chatViewMode: ChatViewMode) => {
      if (!client) {
        return;
      }

      const nextPreferences = {
        ...preferences,
        chatViewMode,
      } satisfies TandemPreferences;

      recordChatPreferenceDebugEvent('useChatPreferences.updateChatViewMode', {
        cacheKey,
        currentUserId,
        nextMode: chatViewMode,
        previousMode: preferences.chatViewMode,
      });
      updateData(nextPreferences);
      setIsSaving(true);
      setError(null);

      try {
        await setChatViewMode(client, chatViewMode);
        await refresh();
      } catch (cause) {
        await refresh();
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setIsSaving(false);
      }
    },
    [cacheKey, client, currentUserId, preferences, refresh, updateData]
  );

  const updateAccountNotificationMode = useCallback(
    async (mode: NotificationMode) => {
      if (!client) {
        return;
      }

      const nextPreferences = {
        ...preferences,
        accountNotificationMode: mode,
      } satisfies TandemPreferences;

      updateData(nextPreferences);
      setIsSaving(true);
      setError(null);

      try {
        await setAccountNotificationMode(client, mode);
        await refresh();
      } catch (cause) {
        await refresh();
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setIsSaving(false);
      }
    },
    [client, preferences, refresh, updateData]
  );

  const updateRoomNotificationMode = useCallback(
    async (roomId: string, mode: RoomNotificationMode) => {
      if (!client) {
        return;
      }

      const nextPreferences = {
        ...preferences,
        roomNotificationOverrides: {
          ...preferences.roomNotificationOverrides,
          ...(mode === 'default'
            ? {}
            : {
                [roomId]: mode,
              }),
        },
      } satisfies TandemPreferences;

      if (mode === 'default') {
        delete nextPreferences.roomNotificationOverrides[roomId];
      }

      updateData(nextPreferences);
      setIsSaving(true);
      setError(null);

      try {
        await setRoomNotificationMode(client, roomId, mode);
        await refresh();
      } catch (cause) {
        await refresh();
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setIsSaving(false);
      }
    },
    [client, preferences, refresh, updateData]
  );

  return {
    preferences,
    updateChatViewMode,
    updateAccountNotificationMode,
    updateRoomNotificationMode,
    isLoaded,
    resolveRoomNotificationMode: (roomId: string | null | undefined) =>
      getResolvedRoomNotificationMode(preferences, roomId),
    isSaving,
    error,
  };
}
