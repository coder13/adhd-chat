/// <reference types="jest" />

jest.mock('../chatCatalog', () => ({
  buildChatCatalog: jest.fn(),
}));

jest.mock('../timelineEvents', () => ({
  getRoomTimelineEvents: jest.fn(),
  getTimelineEventContent: jest.fn(
    (event: { getContent: () => { body?: string; msgtype?: string } }) =>
      event.getContent()
  ),
  isRenderableTimelineMessage: jest.fn(() => true),
}));

import { mapTandemSearchResults } from '../search';
import {
  mergeTandemSearchResults,
  searchLoadedEncryptedMessages,
} from '../search';

describe('tandem search mapping', () => {
  it('maps server search results into product search results', () => {
    const results = mapTandemSearchResults(
      {
        highlights: [],
        results: [
          {
            rank: 1,
            context: {
              ourEvent: {
                getRoomId: () => '!room:example.com',
                getId: () => '$event',
                getTs: () => 1234,
                getContent: () => ({ body: 'Plan dinner tonight' }),
                getSender: () => '@alex:example.com',
                sender: {
                  name: 'Alex',
                },
              },
            },
          },
        ],
      } as never,
      {
        encryptedRoomCount: 0,
        encryptedEntries: [],
        rooms: [
          {
            roomId: '!room:example.com',
            roomName: 'Plans',
            roomIcon: '🍎',
            hubName: 'Home',
            isEncrypted: false,
          },
        ],
      }
    );

    expect(results).toEqual([
      {
        id: '$event',
        eventId: '$event',
        roomId: '!room:example.com',
        roomName: 'Plans',
        roomIcon: '🍎',
        hubName: 'Home',
        senderName: 'Alex',
        body: 'Plan dinner tonight',
        timestamp: 1234,
        source: 'server',
      },
    ]);
  });

  it('searches loaded decrypted messages in encrypted rooms locally', () => {
    const results = searchLoadedEncryptedMessages(
      {
        encryptedRoomCount: 1,
        encryptedEntries: [
          {
            id: '$local',
            eventId: '$local',
            roomId: '!room:example.com',
            roomName: 'Plans',
            roomIcon: '🍎',
            hubName: 'Home',
            senderName: 'Sam',
            body: 'Encrypted dinner plan',
            timestamp: 2345,
            source: 'local-encrypted',
          },
        ],
        rooms: [
          {
            roomId: '!room:example.com',
            roomName: 'Plans',
            roomIcon: '🍎',
            hubName: 'Home',
            isEncrypted: true,
          },
        ],
      },
      'dinner'
    );

    expect(results).toEqual([
      {
        id: '$local',
        eventId: '$local',
        roomId: '!room:example.com',
        roomName: 'Plans',
        roomIcon: '🍎',
        hubName: 'Home',
        senderName: 'Sam',
        body: 'Encrypted dinner plan',
        timestamp: 2345,
        source: 'local-encrypted',
      },
    ]);
  });

  it('merges server and local results without duplicating the same event', () => {
    expect(
      mergeTandemSearchResults(
        [
          {
            id: '$one',
            eventId: '$event',
            roomId: '!room:example.com',
            roomName: 'Plans',
            roomIcon: '🍎',
            hubName: 'Home',
            senderName: 'Alex',
            body: 'Plan dinner tonight',
            timestamp: 2000,
            source: 'server',
          },
        ],
        [
          {
            id: '$two',
            eventId: '$event',
            roomId: '!room:example.com',
            roomName: 'Plans',
            roomIcon: '🍎',
            hubName: 'Home',
            senderName: 'Alex',
            body: 'Plan dinner tonight',
            timestamp: 2000,
            source: 'local-encrypted',
          },
          {
            id: '$three',
            eventId: '$other',
            roomId: '!room:example.com',
            roomName: 'Plans',
            roomIcon: '🍎',
            hubName: 'Home',
            senderName: 'Sam',
            body: 'Encrypted dinner plan',
            timestamp: 3000,
            source: 'local-encrypted',
          },
        ]
      )
    ).toEqual([
      {
        id: '$three',
        eventId: '$other',
        roomId: '!room:example.com',
        roomName: 'Plans',
        roomIcon: '🍎',
        hubName: 'Home',
        senderName: 'Sam',
        body: 'Encrypted dinner plan',
        timestamp: 3000,
        source: 'local-encrypted',
      },
      {
        id: '$one',
        eventId: '$event',
        roomId: '!room:example.com',
        roomName: 'Plans',
        roomIcon: '🍎',
        hubName: 'Home',
        senderName: 'Alex',
        body: 'Plan dinner tonight',
        timestamp: 2000,
        source: 'server',
      },
    ]);
  });
});
