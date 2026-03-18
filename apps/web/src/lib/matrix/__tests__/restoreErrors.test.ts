/// <reference types="jest" />

import {
  shouldSuppressMissingRoomError,
  shouldSuppressMissingTandemSpaceError,
} from '../restoreErrors';

describe('restoreErrors', () => {
  it('suppresses a temporary missing room error when cached data exists during restore', () => {
    expect(
      shouldSuppressMissingRoomError({
        error: 'Conversation not found',
        hasCachedData: true,
        hasLiveRoom: false,
        isLoading: false,
        isAuthRestoring: true,
      })
    ).toBe(true);
  });

  it('suppresses a missing room error while the room is still loading', () => {
    expect(
      shouldSuppressMissingRoomError({
        error: 'Conversation not found',
        hasCachedData: false,
        hasLiveRoom: false,
        isLoading: true,
        isAuthRestoring: false,
      })
    ).toBe(true);
  });

  it('does not suppress a missing room error for a genuinely missing room without cache', () => {
    expect(
      shouldSuppressMissingRoomError({
        error: 'Conversation not found',
        hasCachedData: false,
        hasLiveRoom: false,
        isLoading: false,
        isAuthRestoring: false,
      })
    ).toBe(false);
  });

  it('keeps existing Tandem space suppression behavior', () => {
    expect(
      shouldSuppressMissingTandemSpaceError({
        error: 'Tandem space not found.',
        hasCachedData: true,
        hasRelationship: false,
        hasLiveSpaceRoom: false,
        isAuthRestoring: true,
      })
    ).toBe(true);
  });
});
