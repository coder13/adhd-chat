/// <reference types="jest" />

jest.mock('../timelineEvents', () => ({
  getRoomTimelineEvents: jest.fn(),
}));

const mockEndMatrixPerfTimer = jest.fn();
const mockStartMatrixPerfTimer = jest.fn(() => ({
  end: mockEndMatrixPerfTimer,
}));

jest.mock('../performanceMetrics', () => ({
  startMatrixPerfTimer: mockStartMatrixPerfTimer,
}));

import { getRoomTimelineEvents } from '../timelineEvents';
import { startMatrixPerfTimer } from '../performanceMetrics';
import {
  hasMoreRoomHistoryBack,
  paginateRoomHistoryBack,
} from '../roomHistory';

describe('roomHistory', () => {
  beforeEach(() => {
    mockEndMatrixPerfTimer.mockClear();
    (
      startMatrixPerfTimer as jest.MockedFunction<typeof startMatrixPerfTimer>
    ).mockClear();
  });

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

    expect(startMatrixPerfTimer).toHaveBeenCalledWith(
      'matrix.room.history.paginate_back',
      {
        roomId: undefined,
        limit: 25,
      }
    );
    expect(mockEndMatrixPerfTimer).toHaveBeenCalledWith({
      didPaginate: true,
      hasMore: false,
      previousEventCount: 1,
      nextEventCount: 2,
      addedEventCount: 1,
    });
    expect(client.scrollback).toHaveBeenCalledWith(room, 25);
  });
});
