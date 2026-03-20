import type { TimelineMessage } from '../chatCatalog';
import type { RoomSnapshot } from '../roomSnapshot';
import type { RoomThreadSnapshot } from '../threadCatalog';

function normalizeTimelineMessageOwnership(
  message: TimelineMessage,
  userId: string
) {
  const nextIsOwn = message.senderId === userId;

  if (message.isOwn === nextIsOwn) {
    return message;
  }

  return {
    ...message,
    isOwn: nextIsOwn,
  };
}

function normalizeTimelineMessagesOwnership(
  messages: TimelineMessage[],
  userId: string
) {
  let didChange = false;
  const nextMessages = messages.map((message) => {
    const nextMessage = normalizeTimelineMessageOwnership(message, userId);
    if (nextMessage !== message) {
      didChange = true;
    }

    return nextMessage;
  });

  return didChange ? nextMessages : messages;
}

function normalizeThreadOwnership(
  thread: RoomThreadSnapshot,
  userId: string
) {
  const nextRootMessage = thread.rootMessage
    ? normalizeTimelineMessageOwnership(thread.rootMessage, userId)
    : null;
  const nextReplies = normalizeTimelineMessagesOwnership(thread.replies, userId);
  const nextLatestReply = thread.latestReply
    ? normalizeTimelineMessageOwnership(thread.latestReply, userId)
    : null;

  if (
    nextRootMessage === thread.rootMessage &&
    nextReplies === thread.replies &&
    nextLatestReply === thread.latestReply
  ) {
    return thread;
  }

  return {
    ...thread,
    rootMessage: nextRootMessage,
    replies: nextReplies,
    latestReply: nextLatestReply,
  };
}

function normalizeThreadsOwnership(
  threads: RoomThreadSnapshot[],
  userId: string
) {
  let didChange = false;
  const nextThreads = threads.map((thread) => {
    const nextThread = normalizeThreadOwnership(thread, userId);
    if (nextThread !== thread) {
      didChange = true;
    }

    return nextThread;
  });

  return didChange ? nextThreads : threads;
}

export function normalizeRoomSnapshotOwnership(
  snapshot: RoomSnapshot,
  userId: string | null | undefined
) {
  if (!userId) {
    return snapshot;
  }

  const nextMessages = normalizeTimelineMessagesOwnership(snapshot.messages, userId);
  const nextThreads = normalizeThreadsOwnership(snapshot.threads, userId);

  if (nextMessages === snapshot.messages && nextThreads === snapshot.threads) {
    return snapshot;
  }

  return {
    ...snapshot,
    messages: nextMessages,
    threads: nextThreads,
  };
}
