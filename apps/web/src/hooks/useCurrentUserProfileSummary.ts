import { useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { loadPersistedValue, savePersistedValue } from '../lib/persistence';

const CURRENT_USER_PROFILE_KEY = 'current-user-profile';
const CURRENT_USER_PROFILE_EVENT = 'adhd-chat:current-user-profile-updated';

interface CurrentUserProfileOverride {
  userId: string;
  displayName: string | null;
  avatarMxcUrl: string | null;
}

interface CurrentUserProfileSummary {
  name: string;
  userId: string | null;
  avatarUrl: string | null;
  avatarMxcUrl: string | null;
}

function getOverrideKey(userId: string) {
  return `${CURRENT_USER_PROFILE_KEY}:${userId}`;
}

function readProfileOverride(userId: string | null): CurrentUserProfileOverride | null {
  if (!userId) {
    return null;
  }

  return loadPersistedValue<CurrentUserProfileOverride>(getOverrideKey(userId));
}

function buildProfileSummary(
  client: MatrixClient | null | undefined,
  userId: string | null | undefined
): CurrentUserProfileSummary {
  if (!userId) {
    return {
      name: 'User',
      userId: null,
      avatarUrl: null,
      avatarMxcUrl: null,
    };
  }

  const profile = client?.getUser(userId) ?? null;
  const override = readProfileOverride(userId);
  const displayName = override?.displayName ?? profile?.displayName ?? userId;
  const avatarMxcUrl = override?.avatarMxcUrl ?? profile?.avatarUrl ?? null;

  return {
    name: displayName,
    userId,
    avatarMxcUrl,
    avatarUrl: avatarMxcUrl
      ? (client?.mxcUrlToHttp(avatarMxcUrl, 96, 96, 'crop') ?? null)
      : null,
  };
}

export function saveCurrentUserProfileOverride(
  userId: string,
  override: Omit<CurrentUserProfileOverride, 'userId'>
) {
  savePersistedValue<CurrentUserProfileOverride>(getOverrideKey(userId), {
    userId,
    ...override,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CURRENT_USER_PROFILE_EVENT, {
        detail: { userId },
      })
    );
  }
}

export function useCurrentUserProfileSummary(
  client: MatrixClient | null | undefined,
  userId: string | null | undefined,
  avatarSize = 96
) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !userId) {
      return;
    }

    const handleProfileUpdate = (event: Event) => {
      const detail =
        event instanceof CustomEvent ? (event.detail as { userId?: string }) : null;
      if (detail?.userId && detail.userId !== userId) {
        return;
      }

      setVersion((current) => current + 1);
    };

    window.addEventListener(CURRENT_USER_PROFILE_EVENT, handleProfileUpdate);
    return () => {
      window.removeEventListener(CURRENT_USER_PROFILE_EVENT, handleProfileUpdate);
    };
  }, [userId]);

  void version;

  const summary = buildProfileSummary(client, userId);
  return {
    ...summary,
    avatarUrl: summary.avatarMxcUrl
      ? (client?.mxcUrlToHttp(summary.avatarMxcUrl, avatarSize, avatarSize, 'crop') ??
        null)
      : null,
  };
}
