/// <reference types="jest" />

jest.mock('matrix-js-sdk', () => ({
  MsgType: {
    Text: 'm.text',
    Image: 'm.image',
    File: 'm.file',
  },
}));

import {
  applyOptimisticReactionChanges,
  createOptimisticAttachmentMessage,
  createOptimisticTextMessage,
  mergeTimelineMessages,
  reconcileOptimisticReactionChanges,
  reconcileOptimisticTimeline,
} from '../optimisticTimeline';

describe('optimistic timeline helpers', () => {
  const originalCreateObjectUrlDescriptor = Object.getOwnPropertyDescriptor(
    URL,
    'createObjectURL'
  );

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:preview') as never;
  });

  afterEach(() => {
    if (originalCreateObjectUrlDescriptor) {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrlDescriptor);
      return;
    }

    delete (URL as { createObjectURL?: typeof URL.createObjectURL })
      .createObjectURL;
  });

  it('creates local sending text messages', () => {
    expect(
      createOptimisticTextMessage({
        body: 'hello',
        senderId: '@me:matrix.org',
        senderName: 'Me',
        transactionId: 'txn-1',
        timestamp: 10,
      })
    ).toEqual(
      expect.objectContaining({
        id: 'local:txn-1',
        deliveryStatus: 'sending',
        body: 'hello',
        senderName: 'Me',
        msgtype: 'm.text',
      })
    );
  });

  it('creates local sending attachment messages with retry data', () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const message = createOptimisticAttachmentMessage({
      file,
      senderId: '@me:matrix.org',
      senderName: 'Me',
      transactionId: 'txn-file-1',
      timestamp: 12,
    });

    expect(message).toEqual(
      expect.objectContaining({
        id: 'local:txn-file-1',
        body: 'hello.txt',
        msgtype: 'm.file',
        deliveryStatus: 'sending',
        retryFile: file,
        mimeType: 'text/plain',
        mediaUrl: 'blob:preview',
      })
    );
  });

  it('keeps image captions separate from filenames in optimistic messages', () => {
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    const message = createOptimisticAttachmentMessage({
      file,
      senderId: '@me:matrix.org',
      senderName: 'Me',
      transactionId: 'txn-image-1',
      caption: 'Look at this',
      timestamp: 14,
    });

    expect(message).toEqual(
      expect.objectContaining({
        body: 'Look at this',
        filename: 'photo.jpg',
        attachmentCaption: 'Look at this',
        msgtype: 'm.image',
      })
    );
  });

  it('merges optimistic messages into timeline order', () => {
    const optimisticMessage = createOptimisticTextMessage({
      body: 'pending',
      senderId: '@me:matrix.org',
      senderName: 'Me',
      transactionId: 'txn-2',
      timestamp: 20,
    });

    const merged = mergeTimelineMessages(
      [
        {
          id: 'server-1',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'hi',
          timestamp: 10,
          isOwn: false,
          msgtype: 'm.text',
        },
      ],
      [optimisticMessage]
    );

    expect(merged.map((message) => message.id)).toEqual([
      'server-1',
      'local:txn-2',
    ]);
  });

  it('removes optimistic messages once the matching server event arrives', () => {
    const optimisticMessage = {
      ...createOptimisticTextMessage({
        body: 'pending',
        senderId: '@me:matrix.org',
        senderName: 'Me',
        transactionId: 'txn-3',
        timestamp: 20,
      }),
      remoteEventId: '$event-3',
    };

    const reconciled = reconcileOptimisticTimeline(
      [
        {
          id: '$event-3',
          senderId: '@me:matrix.org',
          senderName: 'Me',
          body: 'pending',
          timestamp: 25,
          isOwn: true,
          msgtype: 'm.text',
        },
      ],
      [optimisticMessage]
    );

    expect(reconciled).toEqual([]);
  });

  it('removes optimistic messages when Matrix local echo with the same transaction id appears', () => {
    const optimisticMessage = createOptimisticTextMessage({
      body: 'pending',
      senderId: '@me:matrix.org',
      senderName: 'Me',
      transactionId: 'txn-4',
      timestamp: 20,
    });

    const reconciled = reconcileOptimisticTimeline(
      [
        {
          id: 'local-echo-4',
          senderId: '@me:matrix.org',
          senderName: 'Me',
          body: 'pending',
          timestamp: 21,
          isOwn: true,
          msgtype: 'm.text',
          transactionId: 'txn-4',
          deliveryStatus: 'sending',
        },
      ],
      [optimisticMessage]
    );

    expect(reconciled).toEqual([]);
  });

  it('applies optimistic reaction additions immediately', () => {
    const [message] = applyOptimisticReactionChanges(
      [
        {
          id: 'server-1',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'hi',
          timestamp: 10,
          isOwn: false,
          msgtype: 'm.text',
          reactions: [],
        },
      ],
      [
        {
          targetMessageId: 'server-1',
          key: '❤️',
          senderName: 'Me',
          mode: 'add',
        },
      ]
    );

    expect(message.reactions).toEqual([
      expect.objectContaining({
        key: '❤️',
        count: 1,
        isOwn: true,
        senderNames: ['Me'],
      }),
    ]);
  });

  it('applies optimistic reaction removals immediately', () => {
    const [message] = applyOptimisticReactionChanges(
      [
        {
          id: 'server-1',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'hi',
          timestamp: 10,
          isOwn: false,
          msgtype: 'm.text',
          reactions: [
            {
              key: '❤️',
              count: 2,
              isOwn: true,
              ownEventId: '$reaction',
              senderNames: ['Alex', 'Me'],
            },
          ],
        },
      ],
      [
        {
          targetMessageId: 'server-1',
          key: '❤️',
          senderName: 'Me',
          mode: 'remove',
        },
      ]
    );

    expect(message.reactions).toEqual([
      expect.objectContaining({
        key: '❤️',
        count: 1,
        isOwn: false,
        senderNames: ['Alex'],
      }),
    ]);
  });

  it('reconciles optimistic reaction changes once the server catches up', () => {
    const reconciled = reconcileOptimisticReactionChanges(
      [
        {
          id: 'server-1',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'hi',
          timestamp: 10,
          isOwn: false,
          msgtype: 'm.text',
          reactions: [
            {
              key: '❤️',
              count: 1,
              isOwn: true,
              ownEventId: '$reaction',
              senderNames: ['Me'],
            },
          ],
        },
      ],
      [
        {
          targetMessageId: 'server-1',
          key: '❤️',
          senderName: 'Me',
          mode: 'add',
        },
      ]
    );

    expect(reconciled).toEqual([]);
  });
});
