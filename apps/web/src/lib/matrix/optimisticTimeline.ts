import { MsgType, type MatrixClient } from 'matrix-js-sdk';
import type { TimelineMessage } from './chatCatalog';

export type OptimisticTimelineMessage = TimelineMessage & {
  localId: string;
  transactionId: string;
  deliveryStatus: 'sending' | 'failed';
  errorText?: string | null;
  remoteEventId?: string | null;
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
  };
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
