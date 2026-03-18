import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import {
  buildReactionIndex,
  buildReplacementIndex,
  isVisibleTimelineMessage,
  resolveTimelineEvent,
} from './timelineRelations';
import type { TimelineMessage } from './chatCatalog';

function uniqueEventsById(events: MatrixEvent[]) {
  const byId = new Map<string, MatrixEvent>();

  events.forEach((event) => {
    const eventId = event.getId();
    if (!eventId) {
      return;
    }

    byId.set(eventId, event);
  });

  return [...byId.values()];
}

export function resolveTimelineMessagesFromEvents(
  client: MatrixClient,
  room: Room,
  currentUserId: string,
  events: MatrixEvent[],
  relatedEvents: MatrixEvent[] = events
): TimelineMessage[] {
  const contextEvents = uniqueEventsById([...events, ...relatedEvents]);
  const eventById = new Map(
    contextEvents
      .map((event) => [event.getId(), event] as const)
      .filter((entry): entry is [string, MatrixEvent] => Boolean(entry[0]))
  );
  const replacementsByTarget = buildReplacementIndex(contextEvents);
  const reactionsByTarget = buildReactionIndex(contextEvents, room, currentUserId);

  return events
    .filter(isVisibleTimelineMessage)
    .map((event) => {
      const resolvedMessage = resolveTimelineEvent(event, {
        currentUserId,
        room,
        replacementsByTarget,
        reactionsByTarget,
        eventById,
      });

      return {
        ...resolvedMessage,
        mediaUrl: resolvedMessage.mediaUrl
          ? (client.mxcUrlToHttp(
              resolvedMessage.mediaUrl,
              undefined,
              undefined,
              undefined,
              false,
              true,
              true
            ) ?? null)
          : null,
      };
    })
    .filter(
      (message) =>
        message.isDeleted ||
        message.body.trim().length > 0 ||
        Boolean(message.mediaUrl)
    )
    .sort((left, right) => left.timestamp - right.timestamp);
}
