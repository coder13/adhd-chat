import type { TimelineMessage } from '../../lib/matrix/chatCatalog';
import type { ChatViewMode } from '../../lib/matrix/preferences';

export interface ChatMessageThreadSummary {
  replyCount: number;
  latestReply: TimelineMessage | null;
}

export interface ChatMessageProps {
  message: TimelineMessage;
  threadSummary?: ChatMessageThreadSummary | null;
  accessToken?: string | null;
  viewMode?: ChatViewMode;
  onRetry?: (messageId: string) => void;
  onToggleReaction?: (message: TimelineMessage, reactionKey: string) => void;
  onOpenThread?: (rootMessageId: string) => void;
  receiptNames?: string[] | null;
  mentionTargets?: Array<{ userId: string; displayName: string }>;
  onRequestActions?: (
    message: TimelineMessage,
    position: { x: number; y: number }
  ) => void;
}
