/// <reference types="jest" />

jest.mock('matrix-js-sdk', () => ({
  MsgType: {
    Text: 'm.text',
    Image: 'm.image',
    File: 'm.file',
    Audio: 'm.audio',
    Video: 'm.video',
    Emote: 'm.emote',
  },
}));

jest.mock('../timelineEvents', () => ({
  getRoomTimelineEvents: jest.fn(() => []),
  getTimelineEventContent: jest.fn(
    (event: { getContent: () => { body?: string; msgtype?: string } }) =>
      event.getContent()
  ),
  isRenderableTimelineMessage: jest.fn(
    (event: { getContent: () => { msgtype?: string } }) =>
      event.getContent().msgtype === 'm.text'
  ),
}));

import { getRoomTimelineEvents } from '../timelineEvents';
import {
  getLatestRenderableRoomEvent,
  getRoomTimelineSummary,
} from '../roomTimelineSummary';

function createEvent(
  id: string,
  body: string,
  msgtype = 'm.text'
) {
  return {
    getId: jest.fn(() => id),
    getTs: jest.fn(() => Number(id.replace(/\D/g, '')) || 0),
    getContent: jest.fn(() => ({ body, msgtype })),
  };
}

describe('roomTimelineSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers the live timeline before falling back to linked timelines', () => {
    const liveEvent = createEvent('$2', 'Latest');
    const room = {
      getLiveTimeline: jest.fn(() => ({
        getEvents: jest.fn(() => [createEvent('$1', 'Earlier'), liveEvent]),
      })),
    };

    expect(getLatestRenderableRoomEvent(room as never)).toBe(liveEvent);
    expect(getRoomTimelineEvents).not.toHaveBeenCalled();
  });

  it('falls back to linked timeline scans when the live timeline has no renderable message', () => {
    const fallbackEvent = createEvent('$3', 'Fallback');
    (getRoomTimelineEvents as jest.Mock).mockReturnValue([
      createEvent('$1', '', 'm.image'),
      fallbackEvent,
    ]);

    const room = {
      getLiveTimeline: jest.fn(() => ({
        getEvents: jest.fn(() => [createEvent('$2', '', 'm.image')]),
      })),
    };

    const summary = getRoomTimelineSummary(room as never);

    expect(summary.preview).toBe('Fallback');
    expect(summary.timestamp).toBe(3);
    expect(getRoomTimelineEvents).toHaveBeenCalledWith(room);
  });
});
