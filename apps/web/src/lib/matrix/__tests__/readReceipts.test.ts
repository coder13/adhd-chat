/// <reference types="jest" />

import {
  findLatestOwnReadReceipt,
} from '../readReceipts';

describe('read receipt helpers', () => {
  it('returns the latest own sent message with readers', () => {
    expect(
      findLatestOwnReadReceipt([
        {
          id: 'older-own',
          isOwn: true,
          deliveryStatus: 'sent',
          readByNames: ['Alex'],
        },
        {
          id: 'incoming',
          isOwn: false,
          deliveryStatus: 'sent',
          readByNames: ['Alex'],
        },
        {
          id: 'latest-own',
          isOwn: true,
          deliveryStatus: 'sent',
          readByNames: ['Alex', 'Zoe'],
        },
      ])
    ).toEqual({
      messageId: 'latest-own',
      readerNames: ['Alex', 'Zoe'],
    });
  });
});
