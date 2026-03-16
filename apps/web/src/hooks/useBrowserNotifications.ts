import { RoomEvent, type MatrixEvent, type Room } from 'matrix-js-sdk';
import { useEffect, useState } from 'react';
import { useMatrixClient } from './useMatrixClient';
import {
  areBrowserNotificationsSupported,
  buildMessageNotificationBody,
  getBrowserNotificationPermission,
  getBrowserNotificationsEnabled,
  registerNotificationServiceWorker,
  requestBrowserNotificationPermission,
  setBrowserNotificationsEnabled,
  showBrowserNotification,
  subscribeToBrowserNotificationSettings,
  type BrowserNotificationPermission,
} from '../lib/notifications/browserNotifications';

function readNotificationSettings() {
  return {
    permission: getBrowserNotificationPermission(),
    enabled: getBrowserNotificationsEnabled(),
  };
}

export function useBrowserNotificationSettings() {
  const [settings, setSettings] = useState(readNotificationSettings);
  const isSupported = areBrowserNotificationsSupported();

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    void registerNotificationServiceWorker();

    return subscribeToBrowserNotificationSettings(() => {
      setSettings(readNotificationSettings());
    });
  }, [isSupported]);

  const requestAccess = async (): Promise<BrowserNotificationPermission> => {
    const permission = await requestBrowserNotificationPermission();
    if (permission === 'granted') {
      setBrowserNotificationsEnabled(true);
      await registerNotificationServiceWorker();
    }

    setSettings(readNotificationSettings());
    return permission;
  };

  const updateEnabled = (enabled: boolean) => {
    setBrowserNotificationsEnabled(enabled);
    setSettings(readNotificationSettings());
  };

  return {
    isSupported,
    permission: settings.permission,
    isEnabled: settings.enabled && settings.permission === 'granted',
    isMuted: !settings.enabled && settings.permission === 'granted',
    requestAccess,
    updateEnabled,
  };
}

export function useBrowserNotifications() {
  const { client, isReady, user } = useMatrixClient();
  const { isSupported, isEnabled } = useBrowserNotificationSettings();

  useEffect(() => {
    if (!client || !isReady || !user || !isSupported || !isEnabled) {
      return;
    }

    const notifiedEventIds = new Set<string>();

    const handleTimeline = (
      event: MatrixEvent,
      eventRoom: Room | undefined,
      _toStartOfTimeline: boolean | undefined,
      _removed: boolean,
      data: { liveEvent?: boolean }
    ) => {
      if (!data.liveEvent || document.visibilityState === 'visible' || !eventRoom) {
        return;
      }

      if (
        event.getType() !== 'm.room.message' ||
        event.getSender() === user.userId ||
        !event.getId()
      ) {
        return;
      }

      const eventId = event.getId()!;
      if (notifiedEventIds.has(eventId)) {
        return;
      }
      notifiedEventIds.add(eventId);

      const content = event.getContent<{ body?: string; msgtype?: string }>();
      const senderId = event.getSender() ?? 'Unknown sender';
      const senderName =
        eventRoom.getMember(senderId)?.name ||
        eventRoom.getMember(senderId)?.rawDisplayName ||
        senderId;

      void showBrowserNotification({
        title: eventRoom.name || 'New message',
        body: buildMessageNotificationBody({
          senderName,
          body: content.body,
          msgtype: content.msgtype,
        }),
        url: `${window.location.origin}/room/${encodeURIComponent(eventRoom.roomId)}`,
        tag: eventRoom.roomId,
      }).catch((cause) => {
        console.error('Failed to show browser notification', cause);
      });
    };

    client.on(RoomEvent.Timeline, handleTimeline);

    return () => {
      client.off(RoomEvent.Timeline, handleTimeline);
    };
  }, [client, isEnabled, isReady, isSupported, user]);
}
