import { useEffect, useState } from 'react';
import { AppAvatar, Modal } from '..';
import type { TimelineMessage } from '../../lib/matrix/chatCatalog';
import type { ChatViewMode } from '../../lib/matrix/preferences';
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
}

function MessageBubble({
  message,
  accessToken = null,
  viewMode = 'timeline',
  onRetry,
}: MessageBubbleProps) {
  const fileSize = formatFileSize(message.fileSize);
  const isNotice = message.msgtype === 'm.notice';
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

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
  }, [accessToken, message.mediaUrl]);

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
        className="max-h-[360px] w-auto max-w-full object-contain"
      />
    </button>
  ) : (
    <div className="flex h-40 w-full items-center justify-center rounded-2xl border border-line bg-elevated text-sm text-text-muted">
      {mediaError ? 'Unable to load image' : 'Loading image...'}
    </div>
  );

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
          ) : message.msgtype === 'm.file' && resolvedMediaUrl ? (
            <a
              href={resolvedMediaUrl}
              target="_blank"
              rel="noreferrer"
              download={message.body || 'attachment'}
              className="mt-1 flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/40 px-3 py-3 text-text transition-colors hover:bg-white/60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{message.body}</p>
                <p className="mt-1 text-xs text-text-subtle">
                  {[message.mimeType, fileSize].filter(Boolean).join(' • ') ||
                    'File'}
                </p>
              </div>
              <span className="text-xs font-medium text-accent">Open</span>
            </a>
          ) : message.msgtype === 'm.emote' ? (
            <p className="whitespace-pre-wrap text-sm italic leading-6">
              * {message.senderName} {linkedMessageBody}
            </p>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-6">
              {linkedMessageBody}
            </p>
          )}

          <p className="mt-2 text-right text-[11px] text-text-subtle">
            {formatMessageTimestamp(message.timestamp)}
            {(isSending || isFailed) && (
              <span>
                {' · '}
                {isSending ? 'Sending…' : 'Failed to send'}
              </span>
            )}
          </p>
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
          <div className="flex justify-center">
            {resolvedMediaUrl ? (
              <img
                src={resolvedMediaUrl}
                alt={imageAltText}
                className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain"
              />
            ) : null}
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
        <div className="app-message-surface min-w-0 flex-1 px-3 py-2">
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
          ) : message.msgtype === 'm.file' && resolvedMediaUrl ? (
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
                  {[message.mimeType, fileSize].filter(Boolean).join(' • ') ||
                    'File'}
                </p>
              </div>
              <span className="text-xs font-medium text-accent">Open</span>
            </a>
          ) : message.msgtype === 'm.emote' ? (
            <p className="mt-1 whitespace-pre-wrap text-sm italic leading-6 text-text">
              * {message.senderName} {linkedMessageBody}
            </p>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">
              {linkedMessageBody}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-text-subtle">
            <span>{formatMessageTimestamp(message.timestamp)}</span>
            {(isSending || isFailed) && (
              <span>{isSending ? 'Sending…' : 'Failed to send'}</span>
            )}
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
        <div className="flex justify-center">
          {resolvedMediaUrl ? (
            <img
              src={resolvedMediaUrl}
              alt={imageAltText}
              className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain"
            />
          ) : null}
        </div>
      </Modal>
    </>
  );
}

export default MessageBubble;
