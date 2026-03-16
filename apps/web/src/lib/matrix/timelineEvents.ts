import { MsgType, type MatrixEvent, type Room } from 'matrix-js-sdk';

type MessageContent = {
  body?: string;
  msgtype?: string;
};

export function getTimelineEventType(event: MatrixEvent) {
  return event.getEffectiveEvent?.().type ?? event.getType();
}

export function getTimelineEventContent(event: MatrixEvent): MessageContent {
  return (
    event.getClearContent?.() ??
    event.getEffectiveEvent?.().content ??
    event.getContent<MessageContent>()
  ) as MessageContent;
}

export function isTimelineMessageEvent(event: MatrixEvent) {
  const eventType = getTimelineEventType(event);
  return eventType === 'm.room.message' || event.isEncrypted?.();
}

export function isRenderableTimelineMessage(event: MatrixEvent) {
  if (!isTimelineMessageEvent(event)) {
    return false;
  }

  const content = getTimelineEventContent(event);
  return (
    content.msgtype === MsgType.Text ||
    content.msgtype === MsgType.Image ||
    content.msgtype === MsgType.File ||
    content.msgtype === MsgType.Audio ||
    content.msgtype === MsgType.Video ||
    content.msgtype === MsgType.Emote ||
    content.msgtype === MsgType.Notice ||
    !content.msgtype
  );
}

export function getRoomTimelineEvents(room: Room) {
  let timeline = room.getLiveTimeline();
  const backwards = 'b' as Parameters<typeof timeline.getNeighbouringTimeline>[0];
  const forwards = 'f' as Parameters<typeof timeline.getNeighbouringTimeline>[0];

  while (true) {
    const previous = timeline.getNeighbouringTimeline(backwards);
    if (!previous) {
      break;
    }
    timeline = previous;
  }

  const events: MatrixEvent[] = [];
  const seenIds = new Set<string>();
  const seenEvents = new Set<MatrixEvent>();

  while (timeline) {
    timeline.getEvents().forEach((event) => {
      const eventId = event.getId();
      if (eventId) {
        if (seenIds.has(eventId)) {
          return;
        }
        seenIds.add(eventId);
      } else if (seenEvents.has(event)) {
        return;
      }

      seenEvents.add(event);
      events.push(event);
    });

    const next = timeline.getNeighbouringTimeline(forwards);
    if (!next) {
      break;
    }
    timeline = next;
  }

  return events;
}
