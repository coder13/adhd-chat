import type { ReactNode } from 'react';
import { createMentionToken } from './mentions';

type LinkSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string }
  | { type: 'mention'; value: string };

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

function splitTextSegmentForMentions(
  value: string,
  mentionLabels: string[]
): LinkSegment[] {
  if (!mentionLabels.length || !value) {
    return [{ type: 'text', value }];
  }

  const mentionPattern = new RegExp(
    `(${mentionLabels
      .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})`,
    'g'
  );
  const parts = value.split(mentionPattern).filter(Boolean);

  return parts.map((part) =>
    mentionLabels.includes(part)
      ? { type: 'mention', value: part }
      : { type: 'text', value: part }
  );
}

export function renderLinkedMessageText(
  message: string,
  mentionTargets: Array<{ userId: string; displayName: string }> = []
): ReactNode[] {
  const mentionLabels = mentionTargets.map((target) =>
    createMentionToken(target.displayName, target.userId)
  );

  return splitMessageTextIntoSegments(message)
    .flatMap((segment) =>
      segment.type === 'text'
        ? splitTextSegmentForMentions(segment.value, mentionLabels)
        : [segment]
    )
    .map((segment, index) => {
    if (segment.type === 'text') {
      return (
        <span key={`text:${index}`}>
          {segment.value}
        </span>
      );
    }

    if (segment.type === 'link') {
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
    }

    return (
      <span
        key={`mention:${index}:${segment.value}`}
        className="rounded-full bg-accent/12 px-1.5 py-0.5 font-medium text-accent"
      >
        {segment.value}
      </span>
    );
  });
}
