import type { TimelineMessage } from '../../lib/matrix/chatCatalog';

interface ThreadSummaryChipProps {
  replyCount: number;
  latestReply: TimelineMessage | null;
  onOpenThread: () => void;
}

function formatReplyCount(replyCount: number) {
  return replyCount === 1 ? '1 reply' : `${replyCount} replies`;
}

function ThreadSummaryChip({
  replyCount,
  latestReply,
  onOpenThread,
}: ThreadSummaryChipProps) {
  const previewText = latestReply
    ? `${latestReply.senderName}: ${
        latestReply.isDeleted ? 'Message deleted' : latestReply.body
      }`
    : 'Open thread';

  return (
    <button
      type="button"
      onClick={onOpenThread}
      className="mt-2 flex max-w-full items-center gap-2 rounded-full bg-primary-soft/80 px-3 py-1.5 text-left text-[11px] text-primary-strong transition-colors hover:bg-primary-soft"
    >
      <span className="shrink-0 font-semibold">{formatReplyCount(replyCount)}</span>
      <span className="truncate text-primary/80">{previewText}</span>
    </button>
  );
}

export default ThreadSummaryChip;
