export type MentionCandidate = {
  userId: string;
  displayName: string;
  token: string;
};

const NON_WORD_PATTERN = /[^a-zA-Z0-9._-]+/g;

function getFallbackHandle(userId: string) {
  const localpart = userId.startsWith('@') ? userId.slice(1) : userId;
  return localpart.split(':')[0] || 'user';
}

export function createMentionToken(displayName: string, userId: string) {
  const normalized = displayName.replace(NON_WORD_PATTERN, '');
  const handle = normalized || getFallbackHandle(userId).replace(NON_WORD_PATTERN, '');

  return `@${handle || 'user'}`;
}

export function createMentionCandidate(userId: string, displayName: string): MentionCandidate {
  return {
    userId,
    displayName,
    token: createMentionToken(displayName, userId),
  };
}

export function getMentionQuery(draft: string) {
  const match = draft.match(/(?:^|\s)(@\S*)$/);
  return match ? match[1] : null;
}

export function insertMentionToken(draft: string, token: string) {
  return draft.replace(/(?:^|\s)(@\S*)$/, (match) => {
    const prefix = match.startsWith(' ') ? ' ' : '';
    return `${prefix}${token} `;
  });
}

export function collectMentionedUserIds(
  body: string,
  candidates: MentionCandidate[]
) {
  if (!body) {
    return [];
  }

  return candidates
    .filter((candidate) => body.includes(candidate.token))
    .map((candidate) => candidate.userId);
}
