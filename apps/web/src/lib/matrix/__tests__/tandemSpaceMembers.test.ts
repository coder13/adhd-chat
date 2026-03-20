/// <reference types="jest" />

import { buildTandemSpaceMemberSummaries } from '../tandemSpaceMembers';

describe('buildTandemSpaceMemberSummaries', () => {
  it('keeps joined and invited members and sorts by display name', () => {
    const room = {
      getMembers: jest.fn(() => [
        {
          userId: '@zane:example.com',
          name: 'Zane',
          membership: 'join',
        },
        {
          userId: '@alex:example.com',
          name: 'Alex',
          membership: 'invite',
        },
        {
          userId: '@left:example.com',
          name: 'Left',
          membership: 'leave',
        },
      ]),
    };

    expect(buildTandemSpaceMemberSummaries(room as never)).toEqual([
      {
        userId: '@alex:example.com',
        displayName: 'Alex',
        membership: 'invite',
      },
      {
        userId: '@zane:example.com',
        displayName: 'Zane',
        membership: 'join',
      },
    ]);
  });
});
