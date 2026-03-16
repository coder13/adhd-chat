const BROWSER_NOTIFICATIONS_STORAGE_KEY = 'tandem.browserNotifications.enabled';
const BROWSER_NOTIFICATIONS_CHANGE_EVENT =
  'tandem:browser-notifications-changed';
const NOTIFICATION_SERVICE_WORKER_PATH = '/notifications-sw.js';

export type BrowserNotificationPermission =
  | NotificationPermission
  | 'unsupported';

export function areBrowserNotificationsSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (!areBrowserNotificationsSupported()) {
    return 'unsupported';
  }

  return Notification.permission;
}

export function getBrowserNotificationsEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  const savedValue = window.localStorage.getItem(
    BROWSER_NOTIFICATIONS_STORAGE_KEY
  );
  return savedValue === null ? true : savedValue === 'true';
}

export function setBrowserNotificationsEnabled(enabled: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    BROWSER_NOTIFICATIONS_STORAGE_KEY,
    String(enabled)
  );
  window.dispatchEvent(new Event(BROWSER_NOTIFICATIONS_CHANGE_EVENT));
}

export function subscribeToBrowserNotificationSettings(
  listener: () => void
) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === BROWSER_NOTIFICATIONS_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(BROWSER_NOTIFICATIONS_CHANGE_EVENT, listener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(BROWSER_NOTIFICATIONS_CHANGE_EVENT, listener);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function requestBrowserNotificationPermission() {
  if (!areBrowserNotificationsSupported()) {
    return 'unsupported' as const;
  }

  return Notification.requestPermission();
}

export async function registerNotificationServiceWorker() {
  if (!areBrowserNotificationsSupported()) {
    return null;
  }

  return navigator.serviceWorker.register(NOTIFICATION_SERVICE_WORKER_PATH);
}

export function buildMessageNotificationBody({
  senderName,
  body,
  msgtype,
}: {
  senderName: string;
  body?: string | null;
  msgtype?: string | null;
}) {
  switch (msgtype) {
    case 'm.image':
      return `${senderName} sent a photo`;
    case 'm.file':
      return `${senderName} sent a file`;
    case 'm.audio':
      return `${senderName} sent audio`;
    case 'm.video':
      return `${senderName} sent a video`;
    case 'm.emote':
      return `* ${senderName} ${body?.trim() || ''}`.trim();
    default:
      return body?.trim() || `${senderName} sent a message`;
  }
}

export async function showBrowserNotification({
  title,
  body,
  url,
  tag,
}: {
  title: string;
  body: string;
  url: string;
  tag: string;
}) {
  const registration = await registerNotificationServiceWorker();

  if (registration) {
    await registration.showNotification(title, {
      body,
      tag,
      data: { url },
      badge: '/vite.svg',
      icon: '/vite.svg',
    });
    return;
  }

  if (!('Notification' in window)) {
    return;
  }

  const notification = new Notification(title, {
    body,
    tag,
    data: { url },
  });
  notification.onclick = () => {
    window.focus();
    window.location.assign(url);
    notification.close();
  };
}
