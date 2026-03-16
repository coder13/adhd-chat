import type { MatrixClient } from 'matrix-js-sdk';

export interface TandemPartnerSummary {
  userId: string;
  displayName: string;
  shortLabel: string;
  avatarUrl: string | null;
}

function getUserDisplayName(client: MatrixClient | null, userId: string) {
  const profile = client?.getUser(userId);
  return profile?.displayName?.trim() || userId;
}

export function getTandemPartnerSummary(
  client: MatrixClient | null,
  userId: string
): TandemPartnerSummary {
  const displayName = getUserDisplayName(client, userId);

  return {
    userId,
    displayName,
    shortLabel: displayName === userId ? userId : `${displayName} (${userId})`,
    avatarUrl: client?.getUser(userId)?.avatarUrl ?? null,
  };
}

export function formatTopicCountLabel(count: number) {
  return `${count} ${count === 1 ? 'topic' : 'topics'}`;
}
