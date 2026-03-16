import { MsgType, type MatrixClient } from 'matrix-js-sdk';
import type { TimelineMessage } from './chatCatalog';
import type { TimelineReaction } from './timelineRelations';

export type OptimisticTimelineMessage = TimelineMessage & {
  localId: string;
  transactionId: string;
  deliveryStatus: 'sending' | 'failed';
  errorText?: string | null;
  remoteEventId?: string | null;
  retryFile?: File | null;
  attachmentCaption?: string | null;
};

export type OptimisticReactionChange = {
  targetMessageId: string;
  key: string;
  senderName: string;
  mode: 'add' | 'remove';
};

export function createOptimisticTextMessage(options: {
  body: string;
  senderId: string;
  senderName: string;
  transactionId: string;
  timestamp?: number;
}): OptimisticTimelineMessage {
  const timestamp = options.timestamp ?? Date.now();

  return {
    id: `local:${options.transactionId}`,
    localId: `local:${options.transactionId}`,
    transactionId: options.transactionId,
    senderId: options.senderId,
    senderName: options.senderName,
    body: options.body,
    timestamp,
    isOwn: true,
    msgtype: MsgType.Text,
    deliveryStatus: 'sending',
    errorText: null,
    remoteEventId: null,
    isEdited: false,
    isDeleted: false,
    replyTo: null,
    reactions: [],
    mentionedUserIds: [],
  };
}

export function createOptimisticAttachmentMessage(options: {
  file: File;
  senderId: string;
  senderName: string;
  transactionId: string;
  caption?: string | null;
  timestamp?: number;
}) {
  const timestamp = options.timestamp ?? Date.now();
  const isImage = options.file.type.startsWith('image/');
  const previewUrl = URL.createObjectURL(options.file);
  const attachmentCaption = options.caption?.trim() || null;

  return {
    id: `local:${options.transactionId}`,
    localId: `local:${options.transactionId}`,
    transactionId: options.transactionId,
    senderId: options.senderId,
    senderName: options.senderName,
    body: attachmentCaption || options.file.name,
    timestamp,
    isOwn: true,
    msgtype: isImage ? MsgType.Image : MsgType.File,
    deliveryStatus: 'sending' as const,
    errorText: null,
    remoteEventId: null,
    retryFile: options.file,
    attachmentCaption,
    mediaUrl: previewUrl,
    mimeType: options.file.type || null,
    fileSize: options.file.size,
    isEdited: false,
    isDeleted: false,
    replyTo: null,
    reactions: [],
    mentionedUserIds: [],
  } satisfies OptimisticTimelineMessage;
}

export function mergeTimelineMessages(
  serverMessages: TimelineMessage[],
  optimisticMessages: OptimisticTimelineMessage[]
) {
  return [...serverMessages, ...optimisticMessages].sort(
    (a, b) => a.timestamp - b.timestamp
  );
}

export function reconcileOptimisticTimeline(
  serverMessages: TimelineMessage[],
  optimisticMessages: OptimisticTimelineMessage[]
) {
  return optimisticMessages.filter((message) => {
    if (
      serverMessages.some(
        (serverMessage) => serverMessage.transactionId === message.transactionId
      )
    ) {
      return false;
    }

    if (message.remoteEventId) {
      return !serverMessages.some(
        (serverMessage) => serverMessage.id === message.remoteEventId
      );
    }

    return true;
  });
}

export function resolveOwnSenderName(
  client: MatrixClient,
  roomId: string,
  userId: string
) {
  return (
    client.getRoom(roomId)?.getMember(userId)?.name ??
    client.getRoom(roomId)?.getMember(userId)?.rawDisplayName ??
    userId
  );
}

function mergeReactionChange(
  reactions: TimelineReaction[],
  change: OptimisticReactionChange
) {
  const existingReaction = reactions.find(
    (reaction) => reaction.key === change.key
  );

  if (change.mode === 'add') {
    if (existingReaction?.isOwn) {
      return reactions;
    }

    if (!existingReaction) {
      return [
        ...reactions,
        {
          key: change.key,
          count: 1,
          isOwn: true,
          ownEventId: null,
          senderNames: [change.senderName],
        },
      ].sort((left, right) => left.key.localeCompare(right.key));
    }

    return reactions.map((reaction) =>
      reaction.key === change.key
        ? {
            ...reaction,
            count: reaction.count + 1,
            isOwn: true,
            ownEventId: reaction.ownEventId ?? null,
            senderNames: [...reaction.senderNames, change.senderName].sort(
              (left, right) => left.localeCompare(right)
            ),
          }
        : reaction
    );
  }

  if (!existingReaction?.isOwn) {
    return reactions;
  }

  if (existingReaction.count <= 1) {
    return reactions.filter((reaction) => reaction.key !== change.key);
  }

  return reactions.map((reaction) =>
    reaction.key === change.key
      ? {
          ...reaction,
          count: Math.max(0, reaction.count - 1),
          isOwn: false,
          ownEventId: null,
          senderNames: reaction.senderNames.filter(
            (senderName) => senderName !== change.senderName
          ),
        }
      : reaction
  );
}

export function applyOptimisticReactionChanges(
  messages: TimelineMessage[],
  changes: OptimisticReactionChange[]
) {
  if (changes.length === 0) {
    return messages;
  }

  return messages.map((message) => {
    const relevantChanges = changes.filter(
      (change) => change.targetMessageId === message.id
    );
    if (relevantChanges.length === 0) {
      return message;
    }

    const nextReactions = relevantChanges.reduce(
      (reactions, change) => mergeReactionChange(reactions, change),
      message.reactions ?? []
    );

    return {
      ...message,
      reactions: nextReactions,
    };
  });
}

export function reconcileOptimisticReactionChanges(
  serverMessages: TimelineMessage[],
  changes: OptimisticReactionChange[]
) {
  return changes.filter((change) => {
    const serverMessage = serverMessages.find(
      (message) => message.id === change.targetMessageId
    );
    if (!serverMessage) {
      return true;
    }

    const hasOwnReaction = Boolean(
      serverMessage.reactions?.some(
        (reaction) => reaction.key === change.key && reaction.isOwn
      )
    );

    return change.mode === 'add' ? !hasOwnReaction : hasOwnReaction;
  });
}
