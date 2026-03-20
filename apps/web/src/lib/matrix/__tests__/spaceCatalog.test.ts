/// <reference types="jest" />

import { buildTandemSpaceSummary } from '../spaceCatalog';

jest.mock('matrix-js-sdk', () => ({
  NotificationCountType: {
    Total: 'total',
  },
}));

jest.mock('../tandem', () => ({
  TANDEM_SPACE_EVENT_TYPE: 'com.tandem.space',
  getResolvedTandemRelationships: jest.fn(() => ({ relationships: [] })),
  getTandemRoomMeta: jest.fn(() => ({})),
}));

jest.mock('../chatCatalog', () => ({
  getRoomDisplayName: jest.fn((room: { roomId: string }) =>
    room.roomId === '!space:example.com' ? 'Shared Hub' : 'Weekly Plans'
  ),
}));

jest.mock('../identity', () => ({
  getRoomIcon: jest.fn(() => null),
  getRoomTopic: jest.fn(() => null),
}));

jest.mock('../roomTimelineSummary', () => ({
  getRoomTimelineSummary: jest.fn(() => ({
    preview: 'Latest update',
    timestamp: 42,
  })),
}));

describe('spaceCatalog', () => {
  it('counts child rooms that only have a parent link back to the space', () => {
    const childRoom = {
      roomId: '!topic:example.com',
      currentState: {
        getStateEvents: jest.fn((eventType: string, stateKey?: string) => {
          if (eventType === 'm.space.parent' && stateKey === '!space:example.com') {
            return { getContent: () => ({}) };
          }

          return null;
        }),
      },
      getUnreadNotificationCount: jest.fn(() => 3),
      getJoinedMemberCount: jest.fn(() => 2),
    };

    const spaceRoom = {
      roomId: '!space:example.com',
      currentState: {
        getStateEvents: jest.fn((eventType: string) => {
          if (eventType === 'm.space.child') {
            return [
              {
                getContent: () => ({}),
                getStateKey: () => '!topic:example.com',
              },
            ];
          }

          return null;
        }),
      },
    };

    const client = {
      getRoom: jest.fn((roomId: string) => {
        if (roomId === '!space:example.com') {
          return spaceRoom;
        }

        if (roomId === '!topic:example.com') {
          return childRoom;
        }

        return null;
      }),
    };

    const summary = buildTandemSpaceSummary(
      client as never,
      spaceRoom as never,
      {
        sharedSpaceId: '!space:example.com',
        partnerUserId: '@partner:example.com',
        mainRoomId: '!main:example.com',
      } as never,
      '@me:example.com'
    );

    expect(summary.roomCount).toBe(1);
    expect(summary.preview).toBe('Latest update');
    expect(summary.unreadCount).toBe(3);
  });
});
