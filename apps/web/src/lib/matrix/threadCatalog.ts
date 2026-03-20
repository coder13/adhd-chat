import type { MatrixClient, MatrixEvent, Room, Thread } from 'matrix-js-sdk';
import type { TimelineMessage } from './chatCatalog';
import { resolveTimelineMessagesFromEvents } from './timelineMessageResolver';

export type RoomThreadSnapshot = {
  rootMessageId: string;
  rootMessage: TimelineMessage | null;
  replies: TimelineMessage[];
  replyCount: number;
  latestReply: TimelineMessage | null;
  hasCurrentUserParticipated: boolean;
};

function compareThreadSnapshots(left: RoomThreadSnapshot, right: RoomThreadSnapshot) {
  const rightTimestamp =
    right.latestReply?.timestamp ?? right.rootMessage?.timestamp ?? 0;
  const leftTimestamp =
    left.latestReply?.timestamp ?? left.rootMessage?.timestamp ?? 0;

  return rightTimestamp - leftTimestamp;
}

type BundledThreadRelation = {
  count?: number;
  current_user_participated?: boolean;
};

function uniqueEventsById(events: Array<MatrixEvent | null | undefined>) {
  const byId = new Map<string, MatrixEvent>();

  events.forEach((event) => {
    const eventId = event?.getId();
    if (!event || !eventId) {
      return;
    }

    byId.set(eventId, event);
  });

  return [...byId.values()];
}

function resolveFirstMessage(
  client: MatrixClient,
  room: Room,
  currentUserId: string,
  event: MatrixEvent | null | undefined,
  relatedEvents: MatrixEvent[]
) {
  if (!event) {
    return null;
  }

  return (
    resolveTimelineMessagesFromEvents(
      client,
      room,
      currentUserId,
      [event],
      relatedEvents
    )[0] ?? null
  );
}

function getBundledThreadRelation(event: MatrixEvent | undefined) {
  const relation = event?.getServerAggregatedRelation?.('m.thread');

  if (!relation || typeof relation !== 'object') {
    return null;
  }

  return relation as BundledThreadRelation;
}

export function buildRoomThreadSnapshot(
  client: MatrixClient,
  room: Room,
  currentUserId: string,
  thread: Thread
): RoomThreadSnapshot | null {
  const rootEvent = thread.rootEvent ?? room.findEventById(thread.id) ?? null;
  const threadEvents = uniqueEventsById(thread.events);
  const relatedEvents = uniqueEventsById([rootEvent, ...threadEvents]);
  const rootMessage = resolveFirstMessage(
    client,
    room,
    currentUserId,
    rootEvent,
    relatedEvents
  );
  const replyEvents = threadEvents.filter((event) => event.getId() !== thread.id);
  const replies = resolveTimelineMessagesFromEvents(
    client,
    room,
    currentUserId,
    replyEvents,
    relatedEvents
  );
  const latestReplyEvent = thread.lastReply() ?? null;
  const latestReply =
    replies.find((message) => message.id === latestReplyEvent?.getId()) ?? null;
  const bundledRelation = getBundledThreadRelation(rootEvent ?? undefined);
  const replyCount = Math.max(
    replies.length,
    thread.length,
    bundledRelation?.count ?? 0
  );

  if (!rootMessage) {
    return null;
  }

  return {
    rootMessageId: thread.id,
    rootMessage,
    replies,
    replyCount,
    latestReply,
    hasCurrentUserParticipated:
      thread.hasCurrentUserParticipated ||
      Boolean(bundledRelation?.current_user_participated),
  } satisfies RoomThreadSnapshot;
}

export function getRoomThreadSnapshots(
  client: MatrixClient,
  room: Room,
  currentUserId: string
): RoomThreadSnapshot[] {
  return room
    .getThreads()
    .map((thread) => buildRoomThreadSnapshot(client, room, currentUserId, thread))
    .filter((thread): thread is RoomThreadSnapshot => thread !== null)
    .sort(compareThreadSnapshots);
}
