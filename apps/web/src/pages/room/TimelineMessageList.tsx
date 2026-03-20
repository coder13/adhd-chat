import { ChatMessage } from '../../components/chat';
import type { TimelineMessage } from '../../lib/matrix/chatCatalog';
import type { ChatViewMode } from '../../lib/matrix/preferences';
import TimelineDaySeparator from './TimelineDaySeparator';
import { buildTimelineDaySections } from './timelineDaySections';

interface TimelineMessageListProps {
  messages: TimelineMessage[];
  accessToken?: string | null;
  viewMode: ChatViewMode;
  mentionTargets: Array<{ userId: string; displayName: string }>;
  readReceiptMessageId: string | null;
  readReceiptNames: string[];
  onRetry?: (messageId: string) => void;
  onToggleReaction?: (message: TimelineMessage, reactionKey: string) => void;
  onOpenThread?: (rootMessageId: string) => void;
  onRequestActions?: (
    message: TimelineMessage,
    position: { x: number; y: number }
  ) => void;
  getThreadSummary?: (
    message: TimelineMessage
  ) =>
    | {
        replyCount: number;
        latestReply: TimelineMessage | null;
      }
    | null;
}

function TimelineMessageList({
  messages,
  accessToken = null,
  viewMode,
  mentionTargets,
  readReceiptMessageId,
  readReceiptNames,
  onRetry,
  onToggleReaction,
  onOpenThread,
  onRequestActions,
  getThreadSummary,
}: TimelineMessageListProps) {
  const sections = buildTimelineDaySections(messages);

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className={viewMode === 'bubbles' ? 'space-y-3' : 'space-y-2'}>
      {sections.map((section) => (
        <div
          key={section.dayStart}
          className={viewMode === 'bubbles' ? 'space-y-3' : 'space-y-2'}
        >
          <TimelineDaySeparator label={section.label} />
          {section.messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              accessToken={accessToken}
              viewMode={viewMode}
              onRetry={onRetry}
              onToggleReaction={onToggleReaction}
              onRequestActions={onRequestActions}
              onOpenThread={onOpenThread}
              threadSummary={getThreadSummary?.(message) ?? null}
              mentionTargets={mentionTargets}
              receiptNames={
                message.id === readReceiptMessageId ? readReceiptNames : null
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default TimelineMessageList;
