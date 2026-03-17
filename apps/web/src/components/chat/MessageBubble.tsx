import { useEffect, useRef, useState } from 'react';
import { AppAvatar } from '..';
import type { TimelineMessage } from '../../lib/matrix/chatCatalog';
import type { ChatViewMode } from '../../lib/matrix/preferences';
import { cn } from '../../lib/cn';
import { renderLinkedMessageText } from './linkSegments';
import MessageLinkPreview from './MessageLinkPreview';

function formatMessageTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

function formatFileSize(fileSize?: number | null) {
  if (!fileSize) {
    return null;
  }

  if (fileSize < 1024) {
    return `${fileSize} B`;
  }

  if (fileSize < 1024 * 1024) {
    return `${Math.round(fileSize / 102.4) / 10} KB`;
  }

  return `${Math.round(fileSize / 104857.6) / 10} MB`;
}

interface MessageBubbleProps {
  message: TimelineMessage;
  accessToken?: string | null;
  viewMode?: ChatViewMode;
  onRetry?: (messageId: string) => void;
  onToggleReaction?: (message: TimelineMessage, reactionKey: string) => void;
  receiptNames?: string[] | null;
  mentionTargets?: Array<{ userId: string; displayName: string }>;
  onRequestActions?: (
    message: TimelineMessage,
    position: { x: number; y: number }
  ) => void;
}

function MessageBubble({
  message,
  accessToken = null,
  viewMode = 'timeline',
  onRetry,
  onToggleReaction,
  receiptNames = null,
  mentionTargets = [],
  onRequestActions,
}: MessageBubbleProps) {
  const fileSize = formatFileSize(message.fileSize);
  const isNotice = message.msgtype === 'm.notice';
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [mediaRetryToken, setMediaRetryToken] = useState(0);
  const longPressTimeoutRef = useRef<number | null>(null);

  const clearLongPressTimeout = () => {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(target.closest('button, a, input, textarea'));

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onRequestActions || isInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();
    onRequestActions(message, {
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      !onRequestActions ||
      event.pointerType !== 'touch' ||
      isInteractiveTarget(event.target)
    ) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + Math.min(rect.width - 24, 48);
    const y = rect.top + Math.min(rect.height - 24, 48);
    longPressTimeoutRef.current = window.setTimeout(() => {
      onRequestActions(message, { x, y });
      clearLongPressTimeout();
    }, 450);
  };

  useEffect(() => {
    if (!message.mediaUrl || !accessToken) {
      setResolvedMediaUrl(message.mediaUrl ?? null);
      setMediaError(false);
      return;
    }

    let isDisposed = false;
    let objectUrl: string | null = null;

    const loadMedia = async () => {
      try {
        setMediaError(false);
        const response = await fetch(message.mediaUrl!, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load media (${response.status})`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (!isDisposed) {
          setResolvedMediaUrl(objectUrl);
        }
      } catch (cause) {
        console.error(cause);
        if (!isDisposed) {
          setResolvedMediaUrl(null);
          setMediaError(true);
        }
      }
    };

    void loadMedia();

    return () => {
      isDisposed = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [accessToken, mediaRetryToken, message.mediaUrl]);

  if (isNotice) {
    return (
      <div className="flex gap-3 py-1">
        <div className="w-9 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs leading-6 text-text-muted">{message.body}</p>
        </div>
      </div>
    );
  }

  const imageAltText = message.body?.trim() || 'Image';
  const linkedMessageBody = renderLinkedMessageText(message.body, mentionTargets);
  const isSending = message.deliveryStatus === 'sending';
  const isFailed = message.deliveryStatus === 'failed';
  const mediaMeta = [message.mimeType, fileSize].filter(Boolean).join(' • ');
  const statusLabel = isSending
    ? 'Sending…'
    : isFailed
      ? 'Failed to send'
      : null;
  const visibleReceiptNames = receiptNames?.slice(0, 3) ?? [];
  const receiptAvatars = visibleReceiptNames.length ? (
    <div
      className="flex items-center"
      aria-label={`Read by ${visibleReceiptNames.join(', ')}`}
      title={`Read by ${visibleReceiptNames.join(', ')}`}
    >
      {visibleReceiptNames.map((name, index) => (
        <AppAvatar
          key={`${message.id}:receipt:${name}`}
          name={name}
          className={cn(
            'h-4 w-4 border border-panel text-[8px]',
            index === 0 ? '' : '-ml-1'
          )}
          textClassName="text-[8px]"
        />
      ))}
    </div>
  ) : null;
  const replyPreview = message.replyTo ? (
    <div className="mb-2 max-w-full rounded-2xl border border-line/80 bg-panel/70 px-3 py-2 text-left">
      <p className="truncate text-[11px] font-semibold text-text-subtle">
        {message.replyTo.senderName}
      </p>
      <p className="truncate text-xs text-text-muted">
        {message.replyTo.isDeleted ? 'Message deleted' : message.replyTo.body}
      </p>
    </div>
  ) : null;
  const reactionBar = message.reactions?.length ? (
    <div className="mt-2 flex flex-wrap gap-2">
      {message.reactions.map((reaction) => (
        <button
          key={`${message.id}:reaction:${reaction.key}`}
          type="button"
          onClick={() => onToggleReaction?.(message, reaction.key)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors',
            reaction.isOwn
              ? 'border-accent/30 bg-accent/10 text-accent hover:bg-accent/15'
              : 'border-line bg-panel/70 text-text-subtle hover:bg-panel'
          )}
          aria-label={`${reaction.key} ${reaction.count}`}
          title={reaction.senderNames.join(', ')}
        >
          <span>{reaction.key}</span>
          <span>{reaction.count}</span>
        </button>
      ))}
    </div>
  ) : null;
  const bubbleMeta = (
    <>
      {formatMessageTimestamp(message.timestamp)}
      {message.isEdited ? (
        <span>
          {' · '}
          Edited
        </span>
      ) : null}
      {statusLabel ? (
        <span>
          {' · '}
          {statusLabel}
        </span>
      ) : null}
    </>
  );
  const retryMediaLoadButton = mediaError ? (
    <button
      type="button"
      onClick={() => setMediaRetryToken((value) => value + 1)}
      className="text-xs font-medium text-accent underline underline-offset-2"
    >
      Retry load
    </button>
  ) : null;
  const expandedImagePreview = isImageExpanded ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}
      aria-modal="true"
      role="dialog"
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={() => setIsImageExpanded(false)}
        aria-label="Close image preview"
      />
      <div className="relative z-10">
        {resolvedMediaUrl ? (
          <img
            src={resolvedMediaUrl}
            alt={imageAltText}
            className="max-h-[70vh] min-h-[50vh] w-auto max-w-full object-contain"
          />
        ) : (
          <div className="rounded-3xl bg-panel px-5 py-4 text-sm text-text-muted">
            {mediaError ? 'Unable to load image' : 'Loading image...'}
          </div>
        )}
      </div>
    </div>
  ) : null;
  const imagePreview = resolvedMediaUrl ? (
    <button
      type="button"
      onClick={() => setIsImageExpanded(true)}
      className="inline-block max-w-full overflow-hidden rounded-2xl border border-line bg-panel text-left transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-accent/30"
      aria-label="Expand image"
    >
      <img
        src={resolvedMediaUrl}
        alt={imageAltText}
        className="max-h-[360px] w-full object-cover sm:w-auto sm:max-w-full sm:object-contain"
      />
    </button>
  ) : (
    <div className="flex aspect-[4/3] w-[min(18rem,70vw)] max-w-full flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-elevated px-4 text-center text-sm text-text-muted">
      <span>{mediaError ? 'Unable to load image' : 'Loading image…'}</span>
      {retryMediaLoadButton}
    </div>
  );

  const fileCard =
    message.msgtype === 'm.file' ? (
      resolvedMediaUrl ? (
        <a
          href={resolvedMediaUrl}
          target="_blank"
          rel="noreferrer"
          download={message.body || 'attachment'}
          className="mt-2 flex max-w-[320px] items-center justify-between gap-3 rounded-2xl border border-line bg-elevated px-3 py-3 text-text transition-colors hover:bg-panel"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{message.body}</p>
            <p className="mt-1 text-xs text-text-subtle">
              {mediaMeta || 'File'}
            </p>
            <p className="mt-2 text-xs font-medium text-accent">Open file</p>
          </div>
          <span className="text-xs font-medium text-accent">Open</span>
        </a>
      ) : (
        <div className="mt-2 flex max-w-[320px] items-center justify-between gap-3 rounded-2xl border border-line bg-elevated px-3 py-3 text-text">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{message.body}</p>
            <p className="mt-1 text-xs text-text-subtle">
              {mediaMeta || 'File'}
            </p>
            <p className="mt-2 text-xs text-text-subtle">
              {mediaError ? 'Unable to load file' : 'Preparing file…'}
            </p>
          </div>
          <div className="shrink-0">{retryMediaLoadButton}</div>
        </div>
      )
    ) : null;

  if (viewMode === 'bubbles') {
    return (
      <>
        <div
          className={cn('flex items-end gap-2', message.isOwn ? 'justify-end' : 'justify-start')}
        >
          <div
            className={`app-chat-bubble relative ${message.isOwn ? 'own' : 'other'}`}
            onContextMenu={handleContextMenu}
            onPointerDown={handlePointerDown}
            onPointerUp={clearLongPressTimeout}
            onPointerCancel={clearLongPressTimeout}
            onPointerMove={clearLongPressTimeout}
          >
            {!message.isOwn && (
              <p className="mb-1 text-xs font-medium text-text-subtle">
                {message.senderName}
              </p>
            )}
            {replyPreview}
            {message.msgtype === 'm.image' ? (
              <div className="max-w-[280px]">{imagePreview}</div>
            ) : message.msgtype === 'm.file' ? (
              <div className="max-w-[280px]">
                {fileCard}
              </div>
            ) : message.msgtype === 'm.emote' ? (
              <div className="flex max-w-full flex-wrap items-end gap-x-2 gap-y-1 text-sm italic leading-6">
                <p className="min-w-0 max-w-full flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                  * {message.senderName} {linkedMessageBody}
                </p>
                <p className="shrink-0 text-[11px] not-italic text-text-subtle">
                  {bubbleMeta}
                </p>
                {receiptAvatars}
              </div>
            ) : (
              <div className="flex max-w-full flex-wrap items-end gap-x-2 gap-y-1 text-sm leading-6">
                <p className="min-w-0 max-w-full flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {linkedMessageBody}
                </p>
                <p className="shrink-0 text-[11px] text-text-subtle">
                  {bubbleMeta}
                </p>
                {receiptAvatars}
              </div>
            )}
            {message.msgtype === 'm.text' ? (
              <MessageLinkPreview
                messageId={message.id}
                messageBody={message.body}
                isOwn={message.isOwn}
                compact
              />
            ) : null}
            {reactionBar}
            {isFailed && onRetry ? (
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => onRetry(message.id)}
                  className="text-[11px] font-medium text-accent underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {expandedImagePreview}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          'flex gap-3 rounded-2xl px-2 py-2 transition-colors',
          message.isOwn ? 'justify-end' : '',
          'hover:bg-elevated/70'
        )}
      >
        {!message.isOwn ? (
          <AppAvatar
            name={message.senderName}
            className="h-9 w-9 shrink-0"
            textClassName="text-sm"
          />
        ) : null}
        <div
          className={cn(
            'app-message-surface relative min-w-0 max-w-[min(100%,34rem)] px-3 py-2',
            message.isOwn ? 'ml-auto w-fit' : 'w-fit'
          )}
          onContextMenu={handleContextMenu}
          onPointerDown={handlePointerDown}
          onPointerUp={clearLongPressTimeout}
          onPointerCancel={clearLongPressTimeout}
          onPointerMove={clearLongPressTimeout}
        >
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold text-text">
              {message.senderName}
            </p>
          </div>

          {replyPreview}
          {message.msgtype === 'm.image' ? (
            <div className="mt-2 max-w-[280px]">{imagePreview}</div>
          ) : message.msgtype === 'm.file' ? (
            fileCard
          ) : message.msgtype === 'm.emote' ? (
            <div className="mt-1 flex max-w-full flex-wrap items-end gap-x-2 gap-y-1 text-sm italic leading-6 text-text">
              <p className="min-w-0 max-w-full flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                * {message.senderName} {linkedMessageBody}
              </p>
              <p className="shrink-0 text-[11px] not-italic text-text-subtle">
                {bubbleMeta}
              </p>
            </div>
          ) : (
            <div className="mt-1 flex max-w-full flex-wrap items-end gap-x-2 gap-y-1 text-sm leading-6 text-text">
              <p className="min-w-0 max-w-full flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                {linkedMessageBody}
              </p>
              <p className="shrink-0 text-[11px] text-text-subtle">
                {bubbleMeta}
              </p>
            </div>
          )}
          {message.msgtype === 'm.text' ? (
            <MessageLinkPreview
              messageId={message.id}
              messageBody={message.body}
              isOwn={message.isOwn}
            />
          ) : null}
          {reactionBar}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-text-subtle">
            {receiptAvatars}
            {isFailed && onRetry ? (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="font-medium text-accent underline underline-offset-2"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {expandedImagePreview}
    </>
  );
}

export default MessageBubble;
