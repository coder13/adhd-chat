/// <reference types="jest" />

jest.mock('../timelineEvents', () => ({
  getRoomTimelineEvents: jest.fn(),
}));

import { getRoomTimelineEvents } from '../timelineEvents';
import {
  hasMoreRoomHistoryBack,
  paginateRoomHistoryBack,
} from '../roomHistory';

describe('roomHistory', () => {
  it('reports whether a room can paginate backward', () => {
    expect(
      hasMoreRoomHistoryBack({
        oldState: {
          paginationToken: 't1',
        },
      } as never)
    ).toBe(true);

    expect(
      hasMoreRoomHistoryBack({
        oldState: {
          paginationToken: null,
        },
      } as never)
    ).toBe(false);
  });

  it('paginates backward and reports whether older events were added', async () => {
    const room = {
      oldState: {
        paginationToken: 'before' as string | null,
      },
    };
    const client = {
      scrollback: jest.fn(async () => {
        room.oldState.paginationToken = null;
        return room;
      }),
    };
    const getTimelineEventsMock = jest.mocked(getRoomTimelineEvents);
    getTimelineEventsMock
      .mockReturnValueOnce([{ id: '$1' }] as never)
      .mockReturnValueOnce([{ id: '$0' }, { id: '$1' }] as never);

    await expect(
      paginateRoomHistoryBack(client as never, room as never, 25)
    ).resolves.toEqual({
      didPaginate: true,
      hasMore: false,
    });

    expect(client.scrollback).toHaveBeenCalledWith(room, 25);
  });
});
