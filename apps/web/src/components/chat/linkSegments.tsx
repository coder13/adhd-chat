import type { ReactNode } from 'react';

type LinkSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string };

const URL_PATTERN = /\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)]?)/gi;

function normalizeUrl(rawValue: string) {
  return rawValue.startsWith('www.') ? `https://${rawValue}` : rawValue;
}

export function splitMessageTextIntoSegments(message: string): LinkSegment[] {
  if (!message) {
    return [{ type: 'text', value: '' }];
  }

  const segments: LinkSegment[] = [];
  let lastIndex = 0;

  message.replace(URL_PATTERN, (match, _group, offset: number) => {
    if (offset > lastIndex) {
      segments.push({
        type: 'text',
        value: message.slice(lastIndex, offset),
      });
    }

    segments.push({
      type: 'link',
      value: match,
      href: normalizeUrl(match),
    });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < message.length) {
    segments.push({
      type: 'text',
      value: message.slice(lastIndex),
    });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: message }];
}

export function renderLinkedMessageText(message: string): ReactNode[] {
  return splitMessageTextIntoSegments(message).map((segment, index) => {
    if (segment.type === 'text') {
      return (
        <span key={`text:${index}`}>
          {segment.value}
        </span>
      );
    }

    return (
      <a
        key={`link:${index}:${segment.href}`}
        href={segment.href}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-accent underline decoration-accent/40 underline-offset-2 break-all"
      >
        {segment.value}
      </a>
    );
  });
}
