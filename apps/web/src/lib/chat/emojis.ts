import * as emojiMartData from '@emoji-mart/data';

export type EmojiSuggestion = {
  shortcode: string;
  emoji: string;
  name: string;
  keywords: string[];
  score: number;
};

type EmojiMartEntry = {
  id?: string;
  name?: string;
  keywords?: string[];
  skins?: Array<{ native?: string }>;
};

const DEFAULT_SHORTCODES = [
  'heart',
  'green_heart',
  'blue_heart',
  'purple_heart',
  'fire',
  'sob',
  'pleading_face',
  'sparkling_heart',
];

const SHORTCODE_PATTERN = /:([a-z0-9_+-]+):/gi;
const TRAILING_QUERY_PATTERN = /(^|\s|\():(?<query>[a-z0-9_+-]*)$/i;

const data = ('default' in emojiMartData
  ? emojiMartData.default
  : emojiMartData) as { emojis: Record<string, EmojiMartEntry> };

const emojiEntries = Object.entries(data.emojis)
  .map(([shortcode, value]) => {
    const emoji = value.skins?.[0]?.native;

    if (!emoji) {
      return null;
    }

    return {
      shortcode,
      emoji,
      name: value.name ?? shortcode,
      keywords: value.keywords ?? [],
      searchTerms: [shortcode, value.name ?? '', ...(value.keywords ?? [])].map((term) =>
        term.toLowerCase()
      ),
    };
  })
  .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

const emojiByShortcode = new Map(
  emojiEntries.map((entry) => [entry.shortcode.toLowerCase(), entry.emoji])
);

function scoreEmojiEntry(entry: (typeof emojiEntries)[number], query: string) {
  if (!query) {
    const defaultIndex = DEFAULT_SHORTCODES.indexOf(entry.shortcode);
    return defaultIndex === -1 ? Number.POSITIVE_INFINITY : defaultIndex;
  }

  const normalizedQuery = query.toLowerCase();

  if (entry.shortcode === normalizedQuery) {
    return 0;
  }

  if (entry.shortcode.startsWith(normalizedQuery)) {
    return 1;
  }

  if (entry.name.toLowerCase().startsWith(normalizedQuery)) {
    return 2;
  }

  if (entry.searchTerms.some((term) => term.startsWith(normalizedQuery))) {
    return 3;
  }

  if (entry.searchTerms.some((term) => term.includes(normalizedQuery))) {
    return 4;
  }

  return Number.POSITIVE_INFINITY;
}

export function getEmojiQuery(draft: string) {
  const match = draft.match(TRAILING_QUERY_PATTERN);
  return match?.groups?.query ?? null;
}

export function getEmojiSuggestions(query: string | null, limit = 8): EmojiSuggestion[] {
  if (query === null) {
    return [];
  }

  return emojiEntries
    .map((entry) => ({
      shortcode: entry.shortcode,
      emoji: entry.emoji,
      name: entry.name,
      keywords: entry.keywords,
      score: scoreEmojiEntry(entry, query),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      return left.shortcode.localeCompare(right.shortcode);
    })
    .slice(0, limit);
}

export function insertEmojiQueryResult(draft: string, emoji: string) {
  if (getEmojiQuery(draft) !== null) {
    return draft.replace(TRAILING_QUERY_PATTERN, (_match, prefix) => `${prefix}${emoji} `);
  }

  if (!draft) {
    return `${emoji} `;
  }

  return /\s$/.test(draft) ? `${draft}${emoji} ` : `${draft} ${emoji} `;
}

export function replaceCompletedEmojiShortcodes(draft: string) {
  return draft.replace(SHORTCODE_PATTERN, (match, shortcode: string) => {
    return emojiByShortcode.get(shortcode.toLowerCase()) ?? match;
  });
}
