export const TYPING_IDLE_TIMEOUT_MS = 4000;
export const TYPING_SERVER_TIMEOUT_MS = 12000;
export const TYPING_RENEWAL_INTERVAL_MS = 8000;

interface TypingMemberLike {
  userId: string;
  name?: string | null;
  typing?: boolean;
  membership?: string | null;
}

export function getTypingMemberNames<T extends TypingMemberLike>(
  members: T[],
  currentUserId: string
) {
  return members
    .filter(
      (member) =>
        member.userId !== currentUserId &&
        member.typing &&
        member.membership === 'join'
    )
    .map((member) => member.name?.trim() || member.userId)
    .sort((left, right) => left.localeCompare(right));
}

export function formatTypingIndicator(names: string[]) {
  if (names.length === 0) {
    return null;
  }

  if (names.length === 1) {
    return `${names[0]} is typing...`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing...`;
  }

  return `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing...`;
}
