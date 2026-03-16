/// <reference types="jest" />

jest.mock('matrix-js-sdk', () => ({
  ClientEvent: {
    AccountData: 'accountData',
  },
}));

import {
  getResolvedRoomNotificationMode,
  type TandemPreferences,
} from '../preferences';

describe('notification preferences', () => {
  it('falls back to the account default when a room has no override', () => {
    const preferences: TandemPreferences = {
      chatViewMode: 'timeline',
      accountNotificationMode: 'mute',
      roomNotificationOverrides: {},
    };

    expect(getResolvedRoomNotificationMode(preferences, '!room:example.org')).toBe(
      'mute'
    );
  });

  it('uses a room override when one is present', () => {
    const preferences: TandemPreferences = {
      chatViewMode: 'timeline',
      accountNotificationMode: 'mute',
      roomNotificationOverrides: {
        '!room:example.org': 'all',
      },
    };

    expect(getResolvedRoomNotificationMode(preferences, '!room:example.org')).toBe(
      'all'
    );
  });
});
