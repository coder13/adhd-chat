import type { TimelineMessage } from '../../lib/matrix/chatCatalog';

export interface TimelineDaySection {
  dayStart: number;
  label: string;
  messages: TimelineMessage[];
}

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function formatTimelineDayLabel(
  dayStart: number,
  nowTimestamp = Date.now()
) {
  const todayStart = startOfLocalDay(nowTimestamp);
  if (dayStart === todayStart) {
    return 'Today';
  }

  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayStart === yesterday.getTime()) {
    return 'Yesterday';
  }

  const dayDate = new Date(dayStart);
  const nowDate = new Date(nowTimestamp);
  const shouldIncludeYear =
    dayDate.getFullYear() !== nowDate.getFullYear();

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(shouldIncludeYear ? { year: 'numeric' as const } : {}),
  }).format(dayDate);
}

export function buildTimelineDaySections(
  messages: TimelineMessage[],
  nowTimestamp = Date.now()
) {
  const sections: TimelineDaySection[] = [];
  let previousDayStart: number | null = null;

  messages.forEach((message) => {
    const dayStart = startOfLocalDay(message.timestamp);
    if (dayStart !== previousDayStart) {
      sections.push({
        dayStart,
        label: formatTimelineDayLabel(dayStart, nowTimestamp),
        messages: [message],
      });
      previousDayStart = dayStart;
      return;
    }

    sections.at(-1)?.messages.push(message);
  });

  return sections;
}
