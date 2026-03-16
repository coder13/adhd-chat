/// <reference types="jest" />

import {
  getInviteLinkPayloadFromSearchParams,
  isValidMatrixUserId,
  parseInviteResponseContent,
  parseInviteToDeviceContent,
} from '../tandemData';

describe('tandemData helpers', () => {
  it('validates matrix user ids', () => {
    expect(isValidMatrixUserId('@klyn:matrix.org')).toBe(true);
    expect(isValidMatrixUserId('@user.name-1:example.com')).toBe(true);
    expect(isValidMatrixUserId('klyn:matrix.org')).toBe(false);
    expect(isValidMatrixUserId('@bad space:matrix.org')).toBe(false);
  });

  it('reads invite link payloads from query params', () => {
    const params = new URLSearchParams({
      invite: 'invite-123',
      inviter: '@alex:matrix.org',
      invitee: '@sam:matrix.org',
      space: '!space:matrix.org',
      room: '!main:matrix.org',
    });

    expect(getInviteLinkPayloadFromSearchParams(params)).toEqual({
      inviteId: 'invite-123',
      inviter: '@alex:matrix.org',
      invitee: '@sam:matrix.org',
      spaceId: '!space:matrix.org',
      roomId: '!main:matrix.org',
    });
  });

  it('returns null for malformed invite link payloads', () => {
    const params = new URLSearchParams({
      invite: 'invite-123',
      inviter: 'alex',
      invitee: '@sam:matrix.org',
    });

    expect(getInviteLinkPayloadFromSearchParams(params)).toBeNull();
  });

  it('parses invite to-device payloads', () => {
    expect(
      parseInviteToDeviceContent({
        inviteId: 'invite-123',
        inviterMatrixId: '@alex:matrix.org',
        inviteeMatrixId: '@sam:matrix.org',
        spaceId: '!space:matrix.org',
        mainRoomId: '!main:matrix.org',
        inviteUrl: 'https://app.example/tandem/invite?invite=invite-123',
        createdAt: '2026-03-15T12:00:00.000Z',
      })
    ).toMatchObject({
      inviteId: 'invite-123',
      inviterMatrixId: '@alex:matrix.org',
      inviteeMatrixId: '@sam:matrix.org',
    });
  });

  it('parses invite response payloads', () => {
    expect(
      parseInviteResponseContent({
        inviteId: 'invite-123',
        inviterMatrixId: '@alex:matrix.org',
        inviteeMatrixId: '@sam:matrix.org',
        status: 'accepted',
        updatedAt: '2026-03-15T12:30:00.000Z',
        spaceId: '!space:matrix.org',
        mainRoomId: '!main:matrix.org',
      })
    ).toEqual({
      inviteId: 'invite-123',
      inviterMatrixId: '@alex:matrix.org',
      inviteeMatrixId: '@sam:matrix.org',
      status: 'accepted',
      updatedAt: '2026-03-15T12:30:00.000Z',
      spaceId: '!space:matrix.org',
      mainRoomId: '!main:matrix.org',
    });
  });
});
