/// <reference types="jest" />

import {
  buildMessageNotificationBody,
  getBrowserNotificationsEnabled,
  setBrowserNotificationsEnabled,
} from '../browserNotifications';

describe('browser notification helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores whether browser notifications are enabled in app settings', () => {
    expect(getBrowserNotificationsEnabled()).toBe(true);

    setBrowserNotificationsEnabled(false);
    expect(getBrowserNotificationsEnabled()).toBe(false);

    setBrowserNotificationsEnabled(true);
    expect(getBrowserNotificationsEnabled()).toBe(true);
  });

  it('builds concise notification bodies for common message types', () => {
    expect(
      buildMessageNotificationBody({
        senderName: 'Alex',
        body: 'Checking in',
        msgtype: 'm.text',
      })
    ).toBe('Checking in');

    expect(
      buildMessageNotificationBody({
        senderName: 'Alex',
        body: 'photo.jpg',
        msgtype: 'm.image',
      })
    ).toBe('Alex sent a photo');
  });
});
