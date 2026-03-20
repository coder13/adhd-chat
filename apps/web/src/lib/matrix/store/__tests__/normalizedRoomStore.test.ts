import {
  buildNormalizedRoomStoreFromSnapshot,
  buildRoomSnapshotFromNormalizedStore,
} from '../normalizedRoomStore';

describe('normalizedRoomStore', () => {
  it('converts a room snapshot into normalized records and back', () => {
    const snapshot = {
      roomName: 'Focus Room',
      roomDescription: 'Plan the day',
      roomIcon: 'checkmark',
      roomAvatarUrl: 'mxc://avatar',
      roomSubtitle: 'Shared Hub',
      messages: [
        {
          id: '$event-1',
          senderId: '@me:example.com',
          senderName: 'Me',
          body: 'Hello',
          timestamp: 1,
          isOwn: true,
          msgtype: 'm.text',
        },
      ],
      threads: [
        {
          rootMessageId: '$thread-root',
          rootMessage: {
            id: '$thread-root',
            senderId: '@you:example.com',
            senderName: 'You',
            body: 'Thread root',
            timestamp: 2,
            isOwn: false,
            msgtype: 'm.text',
          },
          replies: [],
          replyCount: 0,
          latestReply: null,
          hasCurrentUserParticipated: false,
        },
      ],
      isEncrypted: true,
      roomMeta: { pinned: true },
    };

    const normalized = buildNormalizedRoomStoreFromSnapshot(
      '@me:example.com',
      '!room:example.com',
      snapshot
    );
    const restoredSnapshot = buildRoomSnapshotFromNormalizedStore(normalized);

    expect(normalized.timelineEventIds).toEqual(['$event-1']);
    expect(normalized.timelineMessages['$event-1']?.body).toBe('Hello');
    expect(restoredSnapshot).toEqual({
      roomName: 'Focus Room',
      roomDescription: 'Plan the day',
      roomIcon: 'checkmark',
      roomAvatarUrl: 'mxc://avatar',
      roomSubtitle: 'Shared Hub',
      messages: [
        {
          id: '$event-1',
          senderId: '@me:example.com',
          senderName: 'Me',
          body: 'Hello',
          timestamp: 1,
          isOwn: true,
          msgtype: 'm.text',
        },
      ],
      threads: [],
      isEncrypted: true,
      roomMeta: { pinned: true },
    });
  });
});
