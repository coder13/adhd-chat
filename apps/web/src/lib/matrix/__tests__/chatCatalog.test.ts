/// <reference types="jest" />

jest.mock('matrix-js-sdk', () => ({
  MsgType: {
    Text: 'm.text',
    Image: 'm.image',
    File: 'm.file',
    Audio: 'm.audio',
    Video: 'm.video',
    Emote: 'm.emote',
    Notice: 'm.notice',
  },
}));

jest.mock('../tandem', () => ({
  TANDEM_ROOM_EVENT_TYPE: 'com.tandem.room',
  getResolvedTandemRelationships: () => ({
    relationships: [],
  }),
  getTandemRoomMeta: () => ({}),
}));

import { getTimelineMessages } from '../chatCatalog';

type MockEvent = {
  getType: jest.Mock<string, []>;
  getContent: jest.Mock<
    {
      body?: string;
      msgtype?: string;
      url?: string;
      info?: {
        mimetype?: string;
        size?: number;
        w?: number;
        h?: number;
      };
    },
    []
  >;
  getId: jest.Mock<string, []>;
  getTs: jest.Mock<number, []>;
  getSender: jest.Mock<string, []>;
};

function createMessageEvent({
  id,
  sender,
  timestamp,
  body,
  msgtype = 'm.text',
}: {
  id: string;
  sender: string;
  timestamp: number;
  body: string;
  msgtype?: string;
}): MockEvent {
  return {
    getType: jest.fn(() => 'm.room.message'),
    getContent: jest.fn(() => ({ body, msgtype })),
    getId: jest.fn(() => id),
    getTs: jest.fn(() => timestamp),
    getSender: jest.fn(() => sender),
  };
}

function createRoom(events: MockEvent[]) {
  return {
    getLiveTimeline: jest.fn(() => ({
      getEvents: jest.fn(() => events),
    })),
    getMember: jest.fn((userId: string) => ({
      name: userId === '@me:matrix.org' ? 'Me' : 'Alex',
      rawDisplayName: userId === '@me:matrix.org' ? 'Me' : 'Alex',
    })),
  };
}

describe('getTimelineMessages', () => {
  it('keeps plain text and emoji messages in the timeline output', () => {
    const room = createRoom([
      createMessageEvent({
        id: 'emoji',
        sender: '@alex:matrix.org',
        timestamp: 20,
        body: '😀🎉😀',
      }),
      createMessageEvent({
        id: 'text',
        sender: '@me:matrix.org',
        timestamp: 10,
        body: 'Checking in before dinner',
      }),
    ]);

    const messages = getTimelineMessages(
      {
        mxcUrlToHttp: jest.fn(() => null),
      } as never,
      room as never,
      '@me:matrix.org'
    );

    expect(messages).toEqual([
      expect.objectContaining({
        id: 'text',
        body: 'Checking in before dinner',
        isOwn: true,
        senderName: 'Me',
        msgtype: 'm.text',
      }),
      expect.objectContaining({
        id: 'emoji',
        body: '😀🎉😀',
        isOwn: false,
        senderName: 'Alex',
        msgtype: 'm.text',
      }),
    ]);
  });

  it('treats formatting markup as literal text for milestone 1 messages', () => {
    const room = createRoom([
      createMessageEvent({
        id: 'literal-markup',
        sender: '@alex:matrix.org',
        timestamp: 30,
        body: '<strong>bold</strong> 😀 but still plain text',
      }),
    ]);

    const [message] = getTimelineMessages(
      {
        mxcUrlToHttp: jest.fn(() => null),
      } as never,
      room as never,
      '@me:matrix.org'
    );

    expect(message.body).toBe('<strong>bold</strong> 😀 but still plain text');
    expect(message.msgtype).toBe('m.text');
  });
});
