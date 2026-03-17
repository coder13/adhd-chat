/// <reference types="jest" />

jest.mock('matrix-js-sdk', () => ({
  EventStatus: {
    NOT_SENT: 'not_sent',
    ENCRYPTING: 'encrypting',
    SENDING: 'sending',
    QUEUED: 'queued',
    SENT: 'sent',
  },
  MsgType: {
    Text: 'm.text',
    Image: 'm.image',
    File: 'm.file',
    Audio: 'm.audio',
    Video: 'm.video',
    Emote: 'm.emote',
    Notice: 'm.notice',
  },
  NotificationCountType: {
    Total: 'total',
    Highlight: 'highlight',
  },
  RelationType: {
    Replace: 'm.replace',
    Annotation: 'm.annotation',
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
  getEffectiveEvent?: jest.Mock<{ type?: string; content?: Record<string, unknown> }, []>;
  getClearContent?: jest.Mock<Record<string, unknown> | null, []>;
  isEncrypted?: jest.Mock<boolean, []>;
  getContent: jest.Mock<
    {
      body?: string;
      filename?: string;
      msgtype?: string;
      url?: string;
      'm.new_content'?: {
        body?: string;
        msgtype?: string;
      };
      'm.mentions'?: {
        user_ids?: string[];
      };
      'm.relates_to'?: {
        event_id?: string;
        rel_type?: string;
        key?: string;
      };
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
  getTxnId: jest.Mock<string | null, []>;
  getUnsigned: jest.Mock<{ transaction_id?: string }, []>;
  getRelation?: jest.Mock<
    { event_id?: string; rel_type?: string; key?: string } | null,
    []
  >;
  isRedacted?: jest.Mock<boolean, []>;
  localRedactionEvent?: jest.Mock<null, []>;
  replacingEvent?: jest.Mock<null, []>;
  getAssociatedStatus?: jest.Mock<string | null, []>;
  replyEventId?: string | null;
  status?: string | null;
  error?: { message?: string };
};

type MockTimeline = {
  getEvents: jest.Mock<MockEvent[], []>;
  getNeighbouringTimeline: jest.Mock<MockTimeline | null, [string]>;
};

function createMessageEvent({
  id,
  sender,
  timestamp,
  body,
  filename = undefined,
  url = undefined,
  msgtype = 'm.text',
  txnId = null,
  status = null,
  relation = null,
  mentions = undefined,
  isRedacted = false,
}: {
  id: string;
  sender: string;
  timestamp: number;
  body: string;
  filename?: string;
  url?: string;
  msgtype?: string;
  txnId?: string | null;
  status?: string | null;
  relation?: { event_id?: string; rel_type?: string; key?: string } | null;
  mentions?: { user_ids?: string[] };
  isRedacted?: boolean;
}): MockEvent {
  const content = {
    body,
    ...(filename ? { filename } : {}),
    ...(url ? { url } : {}),
    msgtype,
    ...(relation ? { 'm.relates_to': relation } : {}),
    ...(mentions ? { 'm.mentions': mentions } : {}),
  };

  return {
    getType: jest.fn(() => 'm.room.message'),
    getEffectiveEvent: jest.fn(() => ({ type: 'm.room.message', content })),
    getClearContent: jest.fn(() => content),
    isEncrypted: jest.fn(() => false),
    getContent: jest.fn(() => content),
    getId: jest.fn(() => id),
    getTs: jest.fn(() => timestamp),
    getSender: jest.fn(() => sender),
    getTxnId: jest.fn(() => txnId),
    getUnsigned: jest.fn(() => (txnId ? { transaction_id: txnId } : {})),
    getRelation: jest.fn(() => relation),
    isRedacted: jest.fn(() => isRedacted),
    localRedactionEvent: jest.fn(() => null),
    replacingEvent: jest.fn(() => null),
    getAssociatedStatus: jest.fn(() => status),
    replyEventId: null,
    status,
  };
}

function createRoom(events: MockEvent[]) {
  const earliestTimeline = {
    getEvents: jest.fn(() => events),
    getNeighbouringTimeline: jest.fn(() => null),
  };

  return {
    getLiveTimeline: jest.fn(() => ({
      getEvents: jest.fn(() => events),
      getNeighbouringTimeline: jest.fn((direction: string) =>
        direction === 'b' ? earliestTimeline : null
      ),
    })),
    getUsersReadUpTo: jest.fn((_event: MockEvent) => [] as string[]),
    getMember: jest.fn((userId: string) => ({
      name: userId === '@me:matrix.org' ? 'Me' : 'Alex',
      rawDisplayName: userId === '@me:matrix.org' ? 'Me' : 'Alex',
      membership: 'join',
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
        deliveryStatus: 'sent',
      }),
      expect.objectContaining({
        id: 'emoji',
        body: '😀🎉😀',
        isOwn: false,
        senderName: 'Alex',
        msgtype: 'm.text',
        deliveryStatus: 'sent',
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

  it('captures Matrix local echo transaction ids and delivery status', () => {
    const room = createRoom([
      createMessageEvent({
        id: 'local-echo',
        sender: '@me:matrix.org',
        timestamp: 40,
        body: 'Still sending',
        txnId: 'txn-local-echo',
        status: 'sending',
      }),
    ]);

    const [message] = getTimelineMessages(
      {
        mxcUrlToHttp: jest.fn(() => null),
      } as never,
      room as never,
      '@me:matrix.org'
    );

    expect(message.transactionId).toBe('txn-local-echo');
    expect(message.deliveryStatus).toBe('sending');
  });

  it('preserves image filenames separately from captions', () => {
    const room = createRoom([
      createMessageEvent({
        id: 'captioned-image',
        sender: '@alex:matrix.org',
        timestamp: 50,
        body: 'Look at this',
        filename: 'photo.jpg',
        url: 'mxc://example/photo',
        msgtype: 'm.image',
      }),
    ]);

    const [message] = getTimelineMessages(
      {
        mxcUrlToHttp: jest.fn(() => 'https://media.example/photo.jpg'),
      } as never,
      room as never,
      '@me:matrix.org'
    );

    expect(message.body).toBe('Look at this');
    expect(message.filename).toBe('photo.jpg');
    expect(message.mediaUrl).toBe('https://media.example/photo.jpg');
  });

  it('keeps messages from older linked timeline fragments after live timeline reset', () => {
    const olderEvent = createMessageEvent({
      id: 'older',
      sender: '@alex:matrix.org',
      timestamp: 10,
      body: 'Before encryption',
    });
    const newerEvent = createMessageEvent({
      id: 'newer',
      sender: '@me:matrix.org',
      timestamp: 20,
      body: 'After encryption',
    });
    const linkedTimelines: { live: MockTimeline | null } = { live: null };
    const olderTimeline: MockTimeline = {
      getEvents: jest.fn(() => [olderEvent]),
      getNeighbouringTimeline: jest.fn((direction: string): MockTimeline | null =>
        direction === 'f' ? linkedTimelines.live : null
      ),
    };
    const liveTimeline: MockTimeline = {
      getEvents: jest.fn(() => [newerEvent]),
      getNeighbouringTimeline: jest.fn((direction: string): MockTimeline | null =>
        direction === 'b' ? olderTimeline : null
      ),
    };
    linkedTimelines.live = liveTimeline;
    const room = {
      getLiveTimeline: jest.fn(() => liveTimeline),
      getUsersReadUpTo: jest.fn(() => [] as string[]),
      getMember: jest.fn((userId: string) => ({
        name: userId === '@me:matrix.org' ? 'Me' : 'Alex',
        rawDisplayName: userId === '@me:matrix.org' ? 'Me' : 'Alex',
        membership: 'join',
      })),
    };

    const messages = getTimelineMessages(
      {
        mxcUrlToHttp: jest.fn(() => null),
      } as never,
      room as never,
      '@me:matrix.org'
    );

    expect(messages.map((message) => message.id)).toEqual(['older', 'newer']);
  });

  it('includes reader names from joined members on timeline messages', () => {
    const room = createRoom([
      createMessageEvent({
        id: 'sent-message',
        sender: '@me:matrix.org',
        timestamp: 50,
        body: 'Seen by someone',
      }),
    ]);
    room.getUsersReadUpTo.mockImplementation((_event: MockEvent) => [
      '@me:matrix.org',
      '@alex:matrix.org',
    ]);

    const [message] = getTimelineMessages(
      {
        mxcUrlToHttp: jest.fn(() => null),
      } as never,
      room as never,
      '@me:matrix.org'
    );

    expect(message.readByNames).toEqual(['Alex']);
  });

  it('applies replacement content and keeps reply context on a message', () => {
    const original = createMessageEvent({
      id: 'original',
      sender: '@alex:matrix.org',
      timestamp: 10,
      body: 'Original reply target',
    });
    const reply = createMessageEvent({
      id: 'reply',
      sender: '@me:matrix.org',
      timestamp: 20,
      body: 'Old body',
      relation: {
        event_id: 'original',
      },
    });
    const edit = createMessageEvent({
      id: 'edit',
      sender: '@me:matrix.org',
      timestamp: 30,
      body: '* Updated body',
      relation: {
        event_id: 'reply',
        rel_type: 'm.replace',
      },
    });
    edit.getContent = jest.fn(() => ({
      body: '* Updated body',
      msgtype: 'm.text',
      'm.new_content': {
        body: 'Updated body',
        msgtype: 'm.text',
      },
    }));
    edit.getClearContent = jest.fn(() => ({
      body: '* Updated body',
      msgtype: 'm.text',
      'm.new_content': {
        body: 'Updated body',
        msgtype: 'm.text',
      },
    }));
    edit.getEffectiveEvent = jest.fn(() => ({
      type: 'm.room.message',
      content: {
        body: '* Updated body',
        msgtype: 'm.text',
        'm.new_content': {
          body: 'Updated body',
          msgtype: 'm.text',
        },
      },
    }));

    const room = createRoom([original, reply, edit]);
    reply.replyEventId = 'original';

    const [, resolvedReply] = getTimelineMessages(
      {
        mxcUrlToHttp: jest.fn(() => null),
      } as never,
      room as never,
      '@me:matrix.org'
    );

    expect(resolvedReply.body).toBe('Updated body');
    expect(resolvedReply.isEdited).toBe(true);
    expect(resolvedReply.replyTo).toEqual({
      messageId: 'original',
      senderName: 'Alex',
      body: 'Original reply target',
      isDeleted: false,
    });
  });

  it('keeps deleted messages in the timeline and aggregates reactions', () => {
    const deleted = createMessageEvent({
      id: 'deleted',
      sender: '@alex:matrix.org',
      timestamp: 40,
      body: 'Will be deleted',
      isRedacted: true,
    });
    const reaction = {
      getType: jest.fn(() => 'm.reaction'),
      getContent: jest.fn(() => ({
        'm.relates_to': {
          event_id: 'deleted',
          rel_type: 'm.annotation',
          key: '❤️',
        },
      })),
      getId: jest.fn(() => 'reaction-1'),
      getTs: jest.fn(() => 41),
      getSender: jest.fn(() => '@me:matrix.org'),
      getTxnId: jest.fn(() => null),
      getUnsigned: jest.fn(() => ({})),
      getRelation: jest.fn(() => ({
        event_id: 'deleted',
        rel_type: 'm.annotation',
        key: '❤️',
      })),
      isRedacted: jest.fn(() => false),
      localRedactionEvent: jest.fn(() => null),
      replacingEvent: jest.fn(() => null),
      getAssociatedStatus: jest.fn(() => null),
    } satisfies MockEvent;
    const room = createRoom([deleted, reaction]);

    const [message] = getTimelineMessages(
      {
        mxcUrlToHttp: jest.fn(() => null),
      } as never,
      room as never,
      '@me:matrix.org'
    );

    expect(message.body).toBe('Message deleted');
    expect(message.isDeleted).toBe(true);
    expect(message.reactions).toEqual([
      expect.objectContaining({
        key: '❤️',
        count: 1,
        isOwn: true,
      }),
    ]);
  });
});
