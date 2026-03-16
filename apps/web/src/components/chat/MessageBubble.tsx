import { useEffect, useState } from 'react';
import { AppAvatar, Modal } from '..';
import type { TimelineMessage } from '../../lib/matrix/chatCatalog';
import type { ChatViewMode } from '../../lib/matrix/preferences';
import { cn } from '../../lib/cn';
import { renderLinkedMessageText } from './linkSegments';

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
  receiptNames?: string[] | null;
}

function MessageBubble({
  message,
  accessToken = null,
  viewMode = 'timeline',
  onRetry,
  receiptNames = null,
}: MessageBubbleProps) {
  const fileSize = formatFileSize(message.fileSize);
  const isNotice = message.msgtype === 'm.notice';
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [mediaRetryToken, setMediaRetryToken] = useState(0);

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
  const linkedMessageBody = renderLinkedMessageText(message.body);
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
  const retryMediaLoadButton = mediaError ? (
    <button
      type="button"
      onClick={() => setMediaRetryToken((value) => value + 1)}
      className="text-xs font-medium text-accent underline underline-offset-2"
    >
      Retry load
    </button>
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
          className={`app-chat-bubble ${message.isOwn ? 'own' : 'other'}`}
        >
          {!message.isOwn && (
            <p className="mb-1 text-xs font-medium text-text-subtle">
              {message.senderName}
            </p>
          )}

          {message.msgtype === 'm.image' ? (
            <div className="max-w-[280px]">{imagePreview}</div>
          ) : message.msgtype === 'm.file' ? (
            <div className="max-w-[280px]">
              {fileCard}
            </div>
          ) : message.msgtype === 'm.emote' ? (
            <div className="flex flex-wrap items-end justify-end gap-x-2 gap-y-1 text-sm italic leading-6">
              <p className="whitespace-pre-wrap">
                * {message.senderName} {linkedMessageBody}
              </p>
              <p className="shrink-0 text-[11px] not-italic text-text-subtle">
                {formatMessageTimestamp(message.timestamp)}
                {statusLabel ? (
                  <span>
                    {' · '}
                    {statusLabel}
                  </span>
                ) : null}
              </p>
              {receiptAvatars}
            </div>
          ) : (
            <div className="flex flex-wrap items-end justify-end gap-x-2 gap-y-1 text-sm leading-6">
              <p className="whitespace-pre-wrap">
                {linkedMessageBody}
              </p>
              <p className="shrink-0 text-[11px] text-text-subtle">
                {formatMessageTimestamp(message.timestamp)}
                {statusLabel ? (
                  <span>
                    {' · '}
                    {statusLabel}
                  </span>
                ) : null}
              </p>
              {receiptAvatars}
            </div>
          )}
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

        <Modal
          isOpen={isImageExpanded}
          onClose={() => setIsImageExpanded(false)}
          title="Image preview"
          size="lg"
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-elevated px-4 py-3">
              <p className="truncate text-sm font-semibold text-text">
                {message.body || 'Image'}
              </p>
              <p className="mt-1 text-xs text-text-subtle">
                {mediaMeta ||
                  [message.imageWidth, message.imageHeight]
                    .filter(Boolean)
                    .join(' × ') ||
                  'Image'}
              </p>
            </div>
            <div className="flex justify-center rounded-[28px] border border-line bg-panel/70 p-2 sm:p-4">
              {resolvedMediaUrl ? (
                <img
                  src={resolvedMediaUrl}
                  alt={imageAltText}
                  className="max-h-[75vh] w-full max-w-full rounded-2xl object-contain"
                />
              ) : (
                <div className="flex min-h-48 w-full items-center justify-center text-sm text-text-muted">
                  {mediaError ? 'Unable to load image' : 'Loading image…'}
                </div>
              )}
            </div>
            {resolvedMediaUrl ? (
              <div className="flex justify-end">
                <a
                  href={resolvedMediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={message.body || 'image'}
                  className="text-sm font-medium text-accent underline underline-offset-2"
                >
                  Open full size
                </a>
              </div>
            ) : (
              <div className="flex justify-end">{retryMediaLoadButton}</div>
            )}
          </div>
        </Modal>
      </>
    );
  }

  return (
    <>
      <div className="flex gap-3 py-2">
        <AppAvatar
          name={message.senderName}
          className="h-9 w-9 shrink-0"
          textClassName="text-sm"
        />
        <div
          className={cn(
            'app-message-surface min-w-0 max-w-[min(100%,34rem)] px-3 py-2',
            message.isOwn ? 'ml-auto w-fit' : 'w-fit'
          )}
        >
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold text-text">
              {message.senderName}
            </p>
            <p className="text-[11px] text-text-subtle">
              {formatMessageTimestamp(message.timestamp)}
            </p>
          </div>

          {message.msgtype === 'm.image' ? (
            <div className="mt-2 max-w-[280px]">{imagePreview}</div>
          ) : message.msgtype === 'm.file' ? (
            fileCard
          ) : message.msgtype === 'm.emote' ? (
            <div className="mt-1 flex flex-wrap items-end gap-x-2 gap-y-1 text-sm italic leading-6 text-text">
              <p className="whitespace-pre-wrap">
                * {message.senderName} {linkedMessageBody}
              </p>
              <p className="shrink-0 text-[11px] not-italic text-text-subtle">
                {formatMessageTimestamp(message.timestamp)}
              </p>
            </div>
          ) : (
            <div className="mt-1 flex flex-wrap items-end gap-x-2 gap-y-1 text-sm leading-6 text-text">
              <p className="whitespace-pre-wrap">
                {linkedMessageBody}
              </p>
              <p className="shrink-0 text-[11px] text-text-subtle">
                {formatMessageTimestamp(message.timestamp)}
              </p>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-text-subtle">
            {statusLabel ? <span>{statusLabel}</span> : null}
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

      <Modal
        isOpen={isImageExpanded}
        onClose={() => setIsImageExpanded(false)}
        title="Image preview"
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-elevated px-4 py-3">
            <p className="truncate text-sm font-semibold text-text">
              {message.body || 'Image'}
            </p>
            <p className="mt-1 text-xs text-text-subtle">
              {mediaMeta ||
                [message.imageWidth, message.imageHeight]
                  .filter(Boolean)
                  .join(' × ') ||
                'Image'}
            </p>
          </div>
          <div className="flex justify-center rounded-[28px] border border-line bg-panel/70 p-2 sm:p-4">
            {resolvedMediaUrl ? (
              <img
                src={resolvedMediaUrl}
                alt={imageAltText}
                className="max-h-[75vh] w-full max-w-full rounded-2xl object-contain"
              />
            ) : (
              <div className="flex min-h-48 w-full items-center justify-center text-sm text-text-muted">
                {mediaError ? 'Unable to load image' : 'Loading image…'}
              </div>
            )}
          </div>
          {resolvedMediaUrl ? (
            <div className="flex justify-end">
              <a
                href={resolvedMediaUrl}
                target="_blank"
                rel="noreferrer"
                download={message.body || 'image'}
                className="text-sm font-medium text-accent underline underline-offset-2"
              >
                Open full size
              </a>
            </div>
          ) : (
            <div className="flex justify-end">{retryMediaLoadButton}</div>
          )}
        </div>
      </Modal>
    </>
  );
}

export default MessageBubble;
