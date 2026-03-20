import type { MatrixClient, MatrixEvent, Room, Thread } from 'matrix-js-sdk';
import {
  getRoomDisplayName,
  getTimelineMessages,
  type TimelineMessage,
} from './chatCatalog';
import { getRoomIcon, getRoomTopic } from './identity';
import type { RoomSnapshot } from './roomSnapshot';
import { getRoomSubtitle } from './roomSnapshot';
import {
  buildRoomThreadSnapshot,
  getRoomThreadSnapshots,
  type RoomThreadSnapshot,
} from './threadCatalog';
import { getTandemRoomMeta } from './tandem';
import {
  getTimelineEventContent,
  isRenderableTimelineMessage,
} from './timelineEvents';
import { buildReactionIndex } from './timelineRelations';
import { resolveTimelineMessagesFromEvents } from './timelineMessageResolver';

function isMainTimelineMessage(message: TimelineMessage) {
  return message.threadRootId === null || message.isThreadRoot === true;
}

const MAIN_ROOM_TIMELINE = 'main';

type TimelineRelationContent = {
  event_id?: string;
  rel_type?: string;
  key?: string;
  'm.in_reply_to'?: {
    event_id?: string;
  };
};

function getTimelineRelation(event: MatrixEvent) {
  const content = getTimelineEventContent(event) as {
    'm.relates_to'?: TimelineRelationContent;
  };

  return (
    (event.getRelation?.() as TimelineRelationContent | null | undefined) ??
    content['m.relates_to'] ??
    null
  );
}

function getReplyTargetId(event: MatrixEvent) {
  const relation = getTimelineRelation(event);
  return event.replyEventId ?? relation?.['m.in_reply_to']?.event_id ?? null;
}

function getReplacementTargetId(event: MatrixEvent) {
  const relation = getTimelineRelation(event);
  if (relation?.rel_type !== 'm.replace') {
    return null;
  }

  return relation.event_id ?? null;
}

function getReactionTargetId(event: MatrixEvent) {
  const relation = getTimelineRelation(event);
  if (relation?.rel_type !== 'm.annotation') {
    return null;
  }

  return relation.event_id ?? null;
}

function shouldFallbackToFullTimelinePatch(event: MatrixEvent) {
  const relation = getTimelineRelation(event);

  if (!isRenderableTimelineMessage(event)) {
    return true;
  }

  if (event.threadRootId || event.isThreadRoot) {
    return true;
  }

  if (relation?.rel_type) {
    return true;
  }

  return false;
}

function buildIncrementalTimelineMessage(
  client: MatrixClient,
  room: Room,
  currentUserId: string,
  event: MatrixEvent
) {
  const replyTargetId = getReplyTargetId(event);
  const replyTargetEvent = replyTargetId ? room.findEventById(replyTargetId) : null;
  const resolvedMessages = resolveTimelineMessagesFromEvents(
    client,
    room,
    currentUserId,
    [event],
    replyTargetEvent ? [event, replyTargetEvent] : [event]
  );
  const nextMessage = resolvedMessages[0];
  if (!nextMessage || !isMainTimelineMessage(nextMessage)) {
    return null;
  }

  return {
    ...nextMessage,
    readByNames: getReadByNames(room, event, currentUserId),
  } satisfies TimelineMessage;
}

function buildIncrementalEditedTimelineMessage(
  client: MatrixClient,
  room: Room,
  currentUserId: string,
  event: MatrixEvent
) {
  const targetEventId = getReplacementTargetId(event);
  if (!targetEventId) {
    return null;
  }

  const targetEvent = room.findEventById(targetEventId);
  if (!targetEvent || !isRenderableTimelineMessage(targetEvent)) {
    return null;
  }

  return buildResolvedTargetTimelineMessage(
    client,
    room,
    currentUserId,
    targetEvent,
    [event]
  );
}

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

function buildResolvedTargetTimelineMessage(
  client: MatrixClient,
  room: Room,
  currentUserId: string,
  targetEvent: MatrixEvent,
  extraRelatedEvents: MatrixEvent[] = []
) {
  const targetEventId = targetEvent.getId();
  const replyTargetId = getReplyTargetId(targetEvent);
  const replyTargetEvent = replyTargetId ? room.findEventById(replyTargetId) : null;
  const relatedRoomEvents = targetEventId
    ? room.relations?.getAllChildEventsForEvent?.(targetEventId) ?? []
    : [];
  const nextMessage =
    resolveTimelineMessagesFromEvents(
      client,
      room,
      currentUserId,
      [targetEvent],
      uniqueEventsById([
        targetEvent,
        ...relatedRoomEvents,
        ...extraRelatedEvents,
        replyTargetEvent,
      ])
    )[0] ?? null;

  if (!nextMessage) {
    return null;
  }

  return {
    ...nextMessage,
    readByNames: getReadByNames(room, targetEvent, currentUserId),
  } satisfies TimelineMessage;
}

function mergeTimelineMessage(
  messages: TimelineMessage[],
  nextMessage: TimelineMessage
) {
  const nextMessages = [...messages];
  const existingIndex = nextMessages.findIndex(
    (message) =>
      message.id === nextMessage.id ||
      Boolean(
        message.transactionId &&
          nextMessage.transactionId &&
          message.transactionId === nextMessage.transactionId
      )
  );

  if (existingIndex >= 0) {
    nextMessages[existingIndex] = nextMessage;
  } else {
    nextMessages.push(nextMessage);
  }

  return nextMessages.sort((left, right) => left.timestamp - right.timestamp);
}

function getReadByNames(
  room: Room,
  event: MatrixEvent,
  currentUserId: string
) {
  return room
    .getUsersReadUpTo(event)
    .filter((readerId) => {
      if (readerId === currentUserId) {
        return false;
      }

      const member = room.getMember(readerId);
      return member?.membership === 'join';
    })
    .map((readerId) => {
      const member = room.getMember(readerId);
      return member?.name || member?.rawDisplayName || readerId;
    })
    .sort((left, right) => left.localeCompare(right));
}

function patchMessageReadReceipts(
  room: Room,
  currentUserId: string,
  message: TimelineMessage
) {
  const event = room.findEventById(message.id);
  if (!event) {
    return message;
  }

  return {
    ...message,
    readByNames: getReadByNames(room, event, currentUserId),
  };
}

type ReceiptUpdate = {
  readerName: string;
  targetTimestamp: number;
  threadId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function getReceiptEventContent(
  receiptEvent:
    | MatrixEvent
    | {
        content?: unknown;
      }
    | null
    | undefined
) {
  if (!receiptEvent) {
    return null;
  }

  if (typeof (receiptEvent as MatrixEvent).getContent === 'function') {
    return (receiptEvent as MatrixEvent).getContent();
  }

  if (
    typeof receiptEvent === 'object' &&
    receiptEvent !== null &&
    'content' in receiptEvent
  ) {
    return receiptEvent.content;
  }

  return null;
}

function extractReceiptUpdates(
  room: Room,
  currentUserId: string,
  receiptEvent:
    | MatrixEvent
    | {
        content?: unknown;
      }
    | null
    | undefined
) {
  const content = getReceiptEventContent(receiptEvent);
  const receiptContent = asRecord(content);
  if (!receiptContent) {
    return null;
  }

  const updates: ReceiptUpdate[] = [];
  for (const [eventId, receiptTypes] of Object.entries(receiptContent)) {
    const receiptTypeMap = asRecord(receiptTypes);
    if (!receiptTypeMap) {
      continue;
    }

    const readReceipts = asRecord(receiptTypeMap['m.read']);
    if (!readReceipts) {
      continue;
    }

    const targetEvent = room.findEventById(eventId);
    const targetTimestamp = targetEvent?.getTs?.();
    if (typeof targetTimestamp !== 'number' || !Number.isFinite(targetTimestamp)) {
      return null;
    }

    for (const [readerId, receiptData] of Object.entries(readReceipts)) {
      if (readerId === currentUserId) {
        continue;
      }

      const member = room.getMember(readerId);
      if (member?.membership !== 'join') {
        continue;
      }

      const receiptDataMap = asRecord(receiptData);
      const threadId =
        typeof receiptDataMap?.thread_id === 'string'
          ? receiptDataMap.thread_id
          : null;

      updates.push({
        readerName: member.name || member.rawDisplayName || readerId,
        targetTimestamp,
        threadId,
      });
    }
  }

  return updates.length > 0 ? updates : null;
}

function shouldApplyReceiptUpdate(
  message: TimelineMessage,
  receiptUpdate: ReceiptUpdate
) {
  if (message.timestamp > receiptUpdate.targetTimestamp) {
    return false;
  }

  if (receiptUpdate.threadId === null) {
    return true;
  }

  if (receiptUpdate.threadId === MAIN_ROOM_TIMELINE) {
    return isMainTimelineMessage(message);
  }

  return (
    message.id === receiptUpdate.threadId ||
    message.threadRootId === receiptUpdate.threadId
  );
}

function patchMessageReadReceiptsIncrementally(
  message: TimelineMessage,
  receiptUpdates: ReceiptUpdate[]
) {
  const nextReadByNames = new Set(message.readByNames ?? []);

  receiptUpdates.forEach((receiptUpdate) => {
    if (shouldApplyReceiptUpdate(message, receiptUpdate)) {
      nextReadByNames.add(receiptUpdate.readerName);
    }
  });

  const sortedReadByNames = [...nextReadByNames].sort((left, right) =>
    left.localeCompare(right)
  );
  const currentReadByNames = message.readByNames ?? [];
  const didChange =
    sortedReadByNames.length !== currentReadByNames.length ||
    sortedReadByNames.some((name, index) => name !== currentReadByNames[index]);

  if (!didChange) {
    return message;
  }

  return {
    ...message,
    readByNames: sortedReadByNames,
  };
}

function patchMessagesReadReceiptsIncrementally(
  messages: TimelineMessage[],
  receiptUpdates: ReceiptUpdate[]
) {
  let didChange = false;
  const nextMessages = messages.map((message) => {
    const nextMessage = patchMessageReadReceiptsIncrementally(
      message,
      receiptUpdates
    );
    if (nextMessage !== message) {
      didChange = true;
    }

    return nextMessage;
  });

  return didChange ? nextMessages : messages;
}

function patchRoomSnapshotMessageById(
  snapshot: RoomSnapshot,
  messageId: string,
  patchMessage: (message: TimelineMessage) => TimelineMessage
) {
  let didChange = false;

  const patchExistingMessage = (message: TimelineMessage) => {
    if (message.id !== messageId) {
      return message;
    }

    didChange = true;
    return patchMessage(message);
  };
  const patchNullableMessage = (message: TimelineMessage | null) =>
    message ? patchExistingMessage(message) : null;

  return {
    snapshot: {
      ...snapshot,
      messages: (snapshot.messages ?? []).map((message) =>
        patchExistingMessage(message)
      ),
      threads: (snapshot.threads ?? []).map((thread) => ({
        ...thread,
        rootMessage: patchNullableMessage(thread.rootMessage),
        replies: thread.replies.map((reply) => patchExistingMessage(reply)),
        latestReply: patchNullableMessage(thread.latestReply),
      })),
    } satisfies RoomSnapshot,
    didChange,
  };
}

function patchRoomSnapshotWithEditedMessage(
  snapshot: RoomSnapshot,
  nextMessage: TimelineMessage
) {
  const { didChange, snapshot: nextSnapshot } = patchRoomSnapshotMessageById(
    snapshot,
    nextMessage.id,
    () => nextMessage
  );

  return didChange ? nextSnapshot : null;
}

function buildIncrementalReactionPatch(
  room: Room,
  currentUserId: string,
  event: MatrixEvent
) {
  const reactionTargetId = getReactionTargetId(event);
  const redactedReactionEventId = reactionTargetId
    ? null
    : event.getAssociatedId?.() ?? null;
  const redactedReactionEvent = redactedReactionEventId
    ? room.findEventById(redactedReactionEventId)
    : null;
  const targetEventId =
    reactionTargetId ??
    (redactedReactionEvent ? getReactionTargetId(redactedReactionEvent) : null);

  if (!targetEventId) {
    return null;
  }

  const targetEvent = room.findEventById(targetEventId);
  if (!targetEvent || !isRenderableTimelineMessage(targetEvent)) {
    return null;
  }

  const reactionRelations = room.relations?.getChildEventsForEvent?.(
    targetEventId,
    'm.annotation',
    'm.reaction'
  );
  const relationEvents = reactionRelations?.getRelations?.() ?? [];
  const nextRelationEvents = uniqueEventsById(
    reactionTargetId ? [...relationEvents, event] : relationEvents
  ).filter((relationEvent) => relationEvent.getId() !== redactedReactionEventId);

  return {
    targetMessageId: targetEventId,
    reactions:
      buildReactionIndex(nextRelationEvents, room, currentUserId).get(
        targetEventId
      ) ?? [],
  };
}

function buildIncrementalRedactedTimelineMessage(
  client: MatrixClient,
  room: Room,
  currentUserId: string,
  event: MatrixEvent
) {
  if (!event.isRedaction?.()) {
    return null;
  }

  const targetEventId = event.getAssociatedId?.();
  if (!targetEventId) {
    return null;
  }

  const targetEvent = room.findEventById(targetEventId);
  if (!targetEvent || !isRenderableTimelineMessage(targetEvent)) {
    return null;
  }

  return buildResolvedTargetTimelineMessage(
    client,
    room,
    currentUserId,
    targetEvent
  );
}

function mergeThreadSnapshot(
  threads: RoomThreadSnapshot[],
  nextThread: RoomThreadSnapshot | null,
  threadId: string
) {
  const remainingThreads = threads.filter(
    (thread) => thread.rootMessageId !== threadId
  );

  if (!nextThread) {
    return remainingThreads.sort((left, right) => {
      const rightTimestamp =
        right.latestReply?.timestamp ?? right.rootMessage?.timestamp ?? 0;
      const leftTimestamp =
        left.latestReply?.timestamp ?? left.rootMessage?.timestamp ?? 0;

      return rightTimestamp - leftTimestamp;
    });
  }

  return [...remainingThreads, nextThread].sort((left, right) => {
    const rightTimestamp =
      right.latestReply?.timestamp ?? right.rootMessage?.timestamp ?? 0;
    const leftTimestamp =
      left.latestReply?.timestamp ?? left.rootMessage?.timestamp ?? 0;

    return rightTimestamp - leftTimestamp;
  });
}

export function patchRoomSnapshotWithTimelineEvent(
  snapshot: RoomSnapshot,
  client: MatrixClient,
  room: Room,
  currentUserId: string,
  event: MatrixEvent
) {
  const editedMessage = buildIncrementalEditedTimelineMessage(
    client,
    room,
    currentUserId,
    event
  );
  if (editedMessage) {
    return patchRoomSnapshotWithEditedMessage(snapshot, editedMessage);
  }

  const reactionPatch = buildIncrementalReactionPatch(room, currentUserId, event);
  if (reactionPatch) {
    const { didChange, snapshot: nextSnapshot } = patchRoomSnapshotMessageById(
      snapshot,
      reactionPatch.targetMessageId,
      (message) => ({
        ...message,
        reactions: reactionPatch.reactions,
      })
    );

    return didChange ? nextSnapshot : null;
  }

  const redactedMessage = buildIncrementalRedactedTimelineMessage(
    client,
    room,
    currentUserId,
    event
  );
  if (redactedMessage) {
    const { didChange, snapshot: nextSnapshot } = patchRoomSnapshotMessageById(
      snapshot,
      redactedMessage.id,
      () => redactedMessage
    );

    return didChange ? nextSnapshot : null;
  }

  if (shouldFallbackToFullTimelinePatch(event)) {
    return null;
  }

  const nextMessage = buildIncrementalTimelineMessage(
    client,
    room,
    currentUserId,
    event
  );
  if (!nextMessage) {
    return null;
  }

  return {
    ...snapshot,
    messages: mergeTimelineMessage(snapshot.messages ?? [], nextMessage),
  } satisfies RoomSnapshot;
}

export function patchRoomSnapshotWithThreadEvent(
  snapshot: RoomSnapshot,
  client: MatrixClient,
  room: Room,
  currentUserId: string,
  thread: Thread | { id: string },
  options?: {
    remove?: boolean;
  }
) {
  return {
    ...snapshot,
    threads: mergeThreadSnapshot(
      snapshot.threads ?? [],
      options?.remove
        ? null
        : buildRoomThreadSnapshot(
            client,
            room,
            currentUserId,
            thread as Thread
          ),
      thread.id
    ),
  } satisfies RoomSnapshot;
}

export function patchRoomSnapshotFromTimeline(
  snapshot: RoomSnapshot,
  client: MatrixClient,
  room: Room,
  currentUserId: string
): RoomSnapshot {
  const allTimelineMessages = getTimelineMessages(client, room, currentUserId);

  return {
    ...snapshot,
    messages: allTimelineMessages.filter(isMainTimelineMessage),
    threads: getRoomThreadSnapshots(client, room, currentUserId),
  };
}

export function patchRoomSnapshotMetadata(
  snapshot: RoomSnapshot,
  client: MatrixClient,
  room: Room,
  currentUserId: string
): RoomSnapshot {
  const encryptionEvent = room.currentState.getStateEvents(
    'm.room.encryption',
    ''
  );

  return {
    ...snapshot,
    roomName: getRoomDisplayName(room, currentUserId),
    roomDescription: getRoomTopic(room),
    roomIcon: getRoomIcon(room),
    roomAvatarUrl:
      room.getAvatarUrl(client.getHomeserverUrl(), 96, 96, 'crop', false) ??
      null,
    roomSubtitle: getRoomSubtitle(client, room, currentUserId),
    isEncrypted: Boolean(encryptionEvent),
    roomMeta: getTandemRoomMeta(room),
  };
}

export function patchRoomSnapshotReadReceipts(
  snapshot: RoomSnapshot,
  room: Room,
  currentUserId: string,
  receiptEvent?:
    | MatrixEvent
    | {
        content?: unknown;
      }
    | null
): RoomSnapshot {
  const receiptUpdates = extractReceiptUpdates(room, currentUserId, receiptEvent);
  if (receiptUpdates) {
    return {
      ...snapshot,
      messages: patchMessagesReadReceiptsIncrementally(
        snapshot.messages ?? [],
        receiptUpdates
      ),
      threads: (snapshot.threads ?? []).map((thread) => ({
        ...thread,
        rootMessage: thread.rootMessage
          ? patchMessageReadReceiptsIncrementally(
              thread.rootMessage,
              receiptUpdates
            )
          : null,
        replies: patchMessagesReadReceiptsIncrementally(
          thread.replies,
          receiptUpdates
        ),
        latestReply: thread.latestReply
          ? patchMessageReadReceiptsIncrementally(
              thread.latestReply,
              receiptUpdates
            )
          : null,
      })),
    };
  }

  return {
    ...snapshot,
    messages: (snapshot.messages ?? []).map((message) =>
      patchMessageReadReceipts(room, currentUserId, message)
    ),
    threads: (snapshot.threads ?? []).map((thread) => ({
      ...thread,
      rootMessage: thread.rootMessage
        ? patchMessageReadReceipts(room, currentUserId, thread.rootMessage)
        : null,
      replies: thread.replies.map((reply) =>
        patchMessageReadReceipts(room, currentUserId, reply)
      ),
      latestReply: thread.latestReply
        ? patchMessageReadReceipts(room, currentUserId, thread.latestReply)
        : null,
    })),
  };
}
