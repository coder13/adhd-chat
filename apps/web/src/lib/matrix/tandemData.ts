export const MATRIX_USER_ID_PATTERN =
  /^@[A-Za-z0-9._=/+-]+:[A-Za-z0-9.-]+(?::\d+)?$/;

export interface TandemInviteLinkPayload {
  inviteId: string;
  inviter: string;
  invitee: string;
  spaceId: string;
  roomId: string;
}

export interface TandemInviteToDeviceContent {
  inviteId: string;
  inviterMatrixId: string;
  inviteeMatrixId: string;
  spaceId: string;
  mainRoomId: string;
  inviteUrl: string;
  createdAt: string;
  message?: string;
}

export interface TandemInviteResponseContent {
  inviteId: string;
  inviterMatrixId: string;
  inviteeMatrixId: string;
  status: 'accepted' | 'declined';
  updatedAt: string;
  spaceId: string;
  mainRoomId: string;
}

export function isValidMatrixUserId(value: string) {
  return MATRIX_USER_ID_PATTERN.test(value.trim());
}

export function getInviteLinkPayloadFromSearchParams(
  searchParams: URLSearchParams
): TandemInviteLinkPayload | null {
  const inviteId = searchParams.get('invite');
  const inviter = searchParams.get('inviter');
  const invitee = searchParams.get('invitee');
  const spaceId = searchParams.get('space');
  const roomId = searchParams.get('room');

  if (!inviteId || !inviter || !invitee || !spaceId || !roomId) {
    return null;
  }

  if (!isValidMatrixUserId(inviter) || !isValidMatrixUserId(invitee)) {
    return null;
  }

  return { inviteId, inviter, invitee, spaceId, roomId };
}

export function parseInviteToDeviceContent(
  content: unknown
): TandemInviteToDeviceContent | null {
  if (!content || typeof content !== 'object') {
    return null;
  }

  const invite = content as Partial<TandemInviteToDeviceContent>;
  if (!invite.inviteId || !invite.inviterMatrixId || !invite.inviteeMatrixId) {
    return null;
  }

  return invite as TandemInviteToDeviceContent;
}

export function parseInviteResponseContent(
  content: unknown
): TandemInviteResponseContent | null {
  if (!content || typeof content !== 'object') {
    return null;
  }

  const response = content as Partial<TandemInviteResponseContent>;
  if (
    !response.inviteId ||
    !response.inviterMatrixId ||
    !response.inviteeMatrixId ||
    !response.status
  ) {
    return null;
  }

  return response as TandemInviteResponseContent;
}
