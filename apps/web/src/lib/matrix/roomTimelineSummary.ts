import { MsgType, type MatrixEvent, type Room } from 'matrix-js-sdk';
import {
  getRoomTimelineEvents,
  getTimelineEventContent,
  isRenderableTimelineMessage,
} from './timelineEvents';

export interface RoomTimelineSummary {
  event: MatrixEvent | null;
  preview: string;
  timestamp: number;
}

function findLatestRenderableEvent(events: MatrixEvent[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (isRenderableTimelineMessage(event)) {
      return event;
    }
  }

  return null;
}

function getPreviewForEvent(event: MatrixEvent | null) {
  if (!event) {
    return 'No messages yet';
  }

  const content = getTimelineEventContent(event);

  switch (content.msgtype) {
    case MsgType.Image:
      return 'Photo';
    case MsgType.File:
      return 'File';
    case MsgType.Audio:
      return 'Audio';
    case MsgType.Video:
      return 'Video';
    case MsgType.Emote:
      return content.body?.trim() ? `* ${content.body.trim()}` : 'Emote';
    default:
      return content.body?.trim() || 'No messages yet';
  }
}

export function getLatestRenderableRoomEvent(room: Room) {
  const liveTimelineEvent = findLatestRenderableEvent(
    room.getLiveTimeline().getEvents()
  );
  if (liveTimelineEvent) {
    return liveTimelineEvent;
  }

  return findLatestRenderableEvent(getRoomTimelineEvents(room));
}

export function getRoomTimelineSummary(room: Room): RoomTimelineSummary {
  const event = getLatestRenderableRoomEvent(room);

  return {
    event,
    preview: getPreviewForEvent(event),
    timestamp: event?.getTs() ?? 0,
  };
}
