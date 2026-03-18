export function isMissingTandemSpaceError(error: string | null) {
  return (
    error === 'Tandem space not found.' || error === 'Tandem hub not found.'
  );
}

export function isMissingRoomError(error: string | null) {
  return error === 'Conversation not found';
}

export function shouldSuppressMissingTandemSpaceError({
  error,
  hasCachedData,
  hasRelationship,
  hasLiveSpaceRoom,
  isAuthRestoring,
}: {
  error: string | null;
  hasCachedData: boolean;
  hasRelationship: boolean;
  hasLiveSpaceRoom: boolean;
  isAuthRestoring: boolean;
}) {
  if (!isMissingTandemSpaceError(error) || hasLiveSpaceRoom) {
    return false;
  }

  return hasCachedData || hasRelationship || isAuthRestoring;
}

export function shouldSuppressMissingRoomError({
  error,
  hasCachedData,
  hasLiveRoom,
  isLoading,
  isAuthRestoring,
}: {
  error: string | null;
  hasCachedData: boolean;
  hasLiveRoom: boolean;
  isLoading: boolean;
  isAuthRestoring: boolean;
}) {
  if (!isMissingRoomError(error) || hasLiveRoom) {
    return false;
  }

  return hasCachedData || isLoading || isAuthRestoring;
}
