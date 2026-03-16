import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/cn';
import { extractFirstLinkPreview } from './linkPreview';

const DISMISSED_LINK_PREVIEWS_KEY = 'tandem.dismissed-link-previews';

function readDismissedPreviewIds() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(DISMISSED_LINK_PREVIEWS_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeDismissedPreviewIds(ids: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    DISMISSED_LINK_PREVIEWS_KEY,
    JSON.stringify(ids.slice(-200))
  );
}

interface MessageLinkPreviewProps {
  messageId: string;
  messageBody: string;
  isOwn: boolean;
  compact?: boolean;
}

function MessageLinkPreview({
  messageId,
  messageBody,
  isOwn,
  compact = false,
}: MessageLinkPreviewProps) {
  const preview = useMemo(() => extractFirstLinkPreview(messageBody), [messageBody]);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsDismissed(readDismissedPreviewIds().includes(messageId));
  }, [messageId]);

  if (!preview || isDismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        'mt-2 rounded-2xl border border-line bg-panel/85',
        compact ? 'max-w-[280px]' : 'max-w-full'
      )}
    >
      <div className="flex items-start justify-between gap-3 px-3 py-3">
        <a
          href={preview.url}
          target="_blank"
          rel="noreferrer noopener"
          className="min-w-0 flex-1"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
            {preview.host}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-text">
            {preview.title}
          </div>
          {preview.subtitle ? (
            <div className="mt-1 truncate text-xs text-text-muted">
              {preview.subtitle}
            </div>
          ) : null}
        </a>
        {isOwn ? (
          <button
            type="button"
            aria-label="Hide link preview"
            className="rounded-full px-2 py-0.5 text-xs font-medium text-text-muted transition-colors hover:bg-elevated hover:text-text"
            onClick={() => {
              const nextIds = [...new Set([...readDismissedPreviewIds(), messageId])];
              writeDismissedPreviewIds(nextIds);
              setIsDismissed(true);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default MessageLinkPreview;
