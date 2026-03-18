import { EventStatus, MsgType, RelationType, type MatrixEvent, type Room } from 'matrix-js-sdk';
import {
  getTimelineEventContent,
  getTimelineEventType,
  isTimelineMessageEvent,
} from './timelineEvents';

type MessageContent = {
  body?: string;
  filename?: string;
  msgtype?: string;
  url?: string;
  info?: {
    mimetype?: string;
    size?: number;
    w?: number;
    h?: number;
  };
  'm.new_content'?: {
    body?: string;
    msgtype?: string;
  };
  'm.mentions'?: {
    user_ids?: string[];
  };
  'm.relates_to'?: {
    event_id?: string;
    rel_type?: string;
    key?: string;
    'm.in_reply_to'?: {
      event_id?: string;
    };
  };
};

export type TimelineReaction = {
  key: string;
  count: number;
  isOwn: boolean;
  ownEventId?: string | null;
  senderNames: string[];
};

export type TimelineReply = {
  messageId: string;
  senderName: string;
  body: string;
  isDeleted: boolean;
};

export type ResolvedTimelineEvent = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  filename: string | null;
  timestamp: number;
  isOwn: boolean;
  msgtype: string;
  transactionId: string | null;
  deliveryStatus: 'sent' | 'sending' | 'failed';
  errorText: string | null;
  mediaUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  readByNames: string[];
  isEdited: boolean;
  isDeleted: boolean;
  replyTo: TimelineReply | null;
  reactions: TimelineReaction[];
  mentionedUserIds: string[];
  threadRootId: string | null;
  isThreadRoot: boolean;
};

type ReactionAggregate = {
  key: string;
  senders: Map<string, { name: string; eventId: string | null }>;
};

function getContent(event: MatrixEvent): MessageContent {
  return getTimelineEventContent(event);
}

function getEventType(event: MatrixEvent) {
  return getTimelineEventType(event);
}

function isMessageReplacement(event: MatrixEvent) {
  return (
    getEventType(event) === 'm.room.message' &&
    (event.getRelation?.()?.rel_type === RelationType.Replace ||
      getContent(event)['m.relates_to']?.rel_type === RelationType.Replace)
  );
}

function getReplyTargetId(event: MatrixEvent) {
  return (
    event.replyEventId ??
    getContent(event)['m.relates_to']?.['m.in_reply_to']?.event_id ??
    null
  );
}

function getAssociatedStatus(event: MatrixEvent) {
  return event.getAssociatedStatus?.() ?? event.status ?? null;
}

function getReplacementContent(
  event: MatrixEvent,
  replacementsByTarget: Map<string, MatrixEvent>
) {
  const eventId = event.getId();
  if (!eventId) {
    return null;
  }

  const replacingEvent =
    event.replacingEvent?.() ?? replacementsByTarget.get(eventId) ?? null;

  if (!replacingEvent) {
    return null;
  }

  return {
    event: replacingEvent,
    content:
      getContent(replacingEvent)['m.new_content'] ??
      ({
        body: getContent(replacingEvent).body,
        msgtype: getContent(replacingEvent).msgtype,
      } satisfies MessageContent['m.new_content']),
  };
}

function getDisplayBody(content: MessageContent, msgtype: string, isDeleted: boolean) {
  if (isDeleted) {
    return 'Message deleted';
  }

  switch (msgtype) {
    case MsgType.Image:
      return content.body ?? 'Image';
    case MsgType.File:
      return content.body ?? 'File';
    case MsgType.Audio:
      return content.body ?? 'Audio';
    case MsgType.Video:
      return content.body ?? 'Video';
    case MsgType.Emote:
      return content.body ?? '';
    case MsgType.Notice:
    case MsgType.Text:
    default:
      return content.body ?? '';
  }
}

export function buildReplacementIndex(events: MatrixEvent[]) {
  const replacementsByTarget = new Map<string, MatrixEvent>();

  events
    .filter(isMessageReplacement)
    .forEach((event) => {
      const relation = event.getRelation?.() ?? getContent(event)['m.relates_to'];
      const targetId = relation?.event_id;
      if (!targetId) {
        return;
      }

      const existing = replacementsByTarget.get(targetId);
      if (!existing || existing.getTs() < event.getTs()) {
        replacementsByTarget.set(targetId, event);
      }
    });

  return replacementsByTarget;
}

export function buildReactionIndex(
  events: MatrixEvent[],
  room: Room,
  currentUserId: string
) {
  const reactionsByTarget = new Map<string, Map<string, ReactionAggregate>>();

  events
    .filter((event) => getEventType(event) === 'm.reaction' && !event.isRedacted?.())
    .forEach((event) => {
      const relation = event.getRelation?.() ?? getContent(event)['m.relates_to'];
      const targetId = relation?.event_id;
      const key = relation?.key;
      const senderId = event.getSender();

      if (!targetId || !key || !senderId) {
        return;
      }

      const targetReactions =
        reactionsByTarget.get(targetId) ?? new Map<string, ReactionAggregate>();
      const aggregate =
        targetReactions.get(key) ??
        ({
          key,
          senders: new Map<string, { name: string; eventId: string | null }>(),
        } satisfies ReactionAggregate);
      const senderName =
        room.getMember(senderId)?.name ||
        room.getMember(senderId)?.rawDisplayName ||
        senderId;

      aggregate.senders.set(senderId, {
        name: senderName,
        eventId: event.getId() ?? null,
      });
      targetReactions.set(key, aggregate);
      reactionsByTarget.set(targetId, targetReactions);
    });

  return new Map(
    [...reactionsByTarget.entries()].map(([targetId, aggregates]) => [
      targetId,
      [...aggregates.values()]
        .map((aggregate) => {
          const senderEntries = [...aggregate.senders.entries()];
          const senderNames = senderEntries
            .map(([, value]) => value.name)
            .sort((left, right) => left.localeCompare(right));
          const ownReaction = senderEntries.find(([senderId]) => senderId === currentUserId);

          return {
            key: aggregate.key,
            count: senderEntries.length,
            isOwn: Boolean(ownReaction),
            ownEventId: ownReaction?.[1].eventId ?? null,
            senderNames,
          } satisfies TimelineReaction;
        })
        .sort((left, right) => left.key.localeCompare(right.key)),
    ])
  );
}

export function resolveTimelineEvent(
  event: MatrixEvent,
  options: {
    currentUserId: string;
    room: Room;
    replacementsByTarget: Map<string, MatrixEvent>;
    reactionsByTarget: Map<string, TimelineReaction[]>;
    eventById: Map<string, MatrixEvent>;
  }
): ResolvedTimelineEvent {
  const { currentUserId, room, replacementsByTarget, reactionsByTarget, eventById } =
    options;
  const originalContent = getContent(event);
  const replacement = getReplacementContent(event, replacementsByTarget);
  const effectiveContent = replacement?.content
    ? { ...originalContent, ...replacement.content }
    : originalContent;
  const eventId = event.getId() ?? `${event.getTs()}`;
  const isDeleted = Boolean(event.isRedacted?.() || event.localRedactionEvent?.());
  const msgtype = effectiveContent.msgtype ?? originalContent.msgtype ?? MsgType.Text;
  const body = getDisplayBody(effectiveContent, msgtype, isDeleted);
  const replyTargetId = getReplyTargetId(event);
  const replyTargetEvent =
    replyTargetId ? eventById.get(replyTargetId) ?? null : null;
  const resolvedReply: ResolvedTimelineEvent | null = replyTargetEvent
    ? resolveTimelineEvent(replyTargetEvent, options)
    : null;
  const associatedStatus = getAssociatedStatus(event);

  return {
    id: eventId,
    senderId: event.getSender() ?? 'Unknown sender',
    senderName:
      room.getMember(event.getSender() ?? '')?.name ||
      room.getMember(event.getSender() ?? '')?.rawDisplayName ||
      event.getSender() ||
      'Unknown sender',
    body,
    filename: effectiveContent.filename ?? null,
    timestamp: event.getTs(),
    isOwn: event.getSender() === currentUserId,
    msgtype: isDeleted ? MsgType.Notice : msgtype,
    transactionId:
      event.getTxnId?.() ??
      (event.getUnsigned?.() as { transaction_id?: string } | undefined)
        ?.transaction_id ??
      null,
    deliveryStatus:
      associatedStatus === EventStatus.NOT_SENT
        ? 'failed'
        : associatedStatus === EventStatus.SENDING ||
            associatedStatus === EventStatus.QUEUED ||
            associatedStatus === EventStatus.ENCRYPTING
          ? 'sending'
          : 'sent',
    errorText:
      associatedStatus === EventStatus.NOT_SENT
        ? event.error?.message ?? 'Failed to send'
        : null,
    mediaUrl: effectiveContent.url ?? null,
    mimeType: effectiveContent.info?.mimetype ?? null,
    fileSize: effectiveContent.info?.size ?? null,
    imageWidth: effectiveContent.info?.w ?? null,
    imageHeight: effectiveContent.info?.h ?? null,
    readByNames: [],
    isEdited: Boolean(replacement && !isDeleted),
    isDeleted,
    replyTo:
      replyTargetId && resolvedReply
        ? {
            messageId: replyTargetId,
            senderName: resolvedReply.senderName,
            body: resolvedReply.body,
            isDeleted: resolvedReply.isDeleted,
          }
        : null,
    reactions: reactionsByTarget.get(eventId) ?? [],
    mentionedUserIds: effectiveContent['m.mentions']?.user_ids ?? [],
    threadRootId: event.threadRootId ?? null,
    isThreadRoot: Boolean(event.isThreadRoot),
  };
}

export function isVisibleTimelineMessage(event: MatrixEvent) {
  return isTimelineMessageEvent(event) && !isMessageReplacement(event);
}
