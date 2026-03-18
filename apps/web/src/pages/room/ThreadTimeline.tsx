import type { TimelineMessage } from '../../lib/matrix/chatCatalog';
import type { ChatViewMode } from '../../lib/matrix/preferences';
import TimelineMessageList from './TimelineMessageList';

interface ThreadTimelineProps {
  rootMessage: TimelineMessage | null;
  replies: TimelineMessage[];
  accessToken?: string | null;
  viewMode: ChatViewMode;
  mentionTargets: Array<{ userId: string; displayName: string }>;
  readReceiptMessageId: string | null;
  readReceiptNames: string[];
  onRetry?: (messageId: string) => void;
  onToggleReaction?: (message: TimelineMessage, reactionKey: string) => void;
  onRequestActions?: (
    message: TimelineMessage,
    position: { x: number; y: number }
  ) => void;
}

function ThreadTimeline({
  rootMessage,
  replies,
  accessToken = null,
  viewMode,
  mentionTargets,
  readReceiptMessageId,
  readReceiptNames,
  onRetry,
  onToggleReaction,
  onRequestActions,
}: ThreadTimelineProps) {
  if (!rootMessage) {
    return (
      <div className="py-8 text-center">
        <p className="text-base font-medium text-text">Thread unavailable</p>
        <p className="mt-2 text-sm text-text-muted">
          The thread starter is not loaded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TimelineMessageList
        messages={[rootMessage, ...replies]}
        accessToken={accessToken}
        viewMode={viewMode}
        mentionTargets={mentionTargets}
        readReceiptMessageId={readReceiptMessageId}
        readReceiptNames={readReceiptNames}
        onRetry={onRetry}
        onToggleReaction={onToggleReaction}
        onRequestActions={onRequestActions}
      />

      {replies.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line/70 bg-panel/70 px-4 py-5 text-sm text-text-muted">
          No replies yet. Your next message will start the thread.
        </div>
      ) : null}
    </div>
  );
}

export default ThreadTimeline;
