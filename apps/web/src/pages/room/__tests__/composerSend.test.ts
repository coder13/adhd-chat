/// <reference types="jest" />

jest.mock('matrix-js-sdk', () => ({
  MsgType: {
    Text: 'm.text',
  },
  RelationType: {
    Replace: 'm.replace',
  },
}));

import { buildTextMessageRequest } from '../composerSend';

describe('buildTextMessageRequest', () => {
  it('builds a plain reply relation outside thread mode', () => {
    const request = buildTextMessageRequest({
      body: 'On it',
      mentionedUserIds: ['@alex:matrix.org'],
      replyToMessage: {
        id: '$reply-target',
      } as never,
      threadRootId: null,
    });

    expect(request.threadRootId).toBeNull();
    expect(request.content).toMatchObject({
      msgtype: 'm.text',
      body: 'On it',
      'm.relates_to': {
        'm.in_reply_to': {
          event_id: '$reply-target',
        },
      },
      'm.mentions': {
        user_ids: ['@alex:matrix.org'],
      },
    });
  });

  it('sends a threaded reply without adding a plain in-reply-to relation', () => {
    const request = buildTextMessageRequest({
      body: 'Continuing the thread',
      mentionedUserIds: [],
      replyToMessage: {
        id: '$reply-target',
      } as never,
      threadRootId: '$thread-root',
    });

    expect(request.threadRootId).toBe('$thread-root');
    expect(request.content).toMatchObject({
      msgtype: 'm.text',
      body: 'Continuing the thread',
    });
    expect(request.content).not.toHaveProperty('m.relates_to');
  });

  it('builds replacement content for edits and clears thread routing', () => {
    const request = buildTextMessageRequest({
      body: 'Edited body',
      mentionedUserIds: ['@alex:matrix.org'],
      editMessage: {
        id: '$original-event',
      } as never,
      threadRootId: '$thread-root',
    });

    expect(request.threadRootId).toBeNull();
    expect(request.content).toMatchObject({
      msgtype: 'm.text',
      body: '* Edited body',
      'm.new_content': {
        msgtype: 'm.text',
        body: 'Edited body',
        'm.mentions': {
          user_ids: ['@alex:matrix.org'],
        },
      },
      'm.relates_to': {
        event_id: '$original-event',
        rel_type: 'm.replace',
      },
    });
  });
});
