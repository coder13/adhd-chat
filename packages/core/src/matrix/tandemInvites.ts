import {
  Preset,
  Visibility,
  type MatrixClient,
  type MatrixEvent,
} from 'matrix-js-sdk';
import { createId } from '../id';
import {
  TANDEM_INVITE_RESPONSE_TO_DEVICE_EVENT_TYPE,
  TANDEM_INVITE_TO_DEVICE_EVENT_TYPE,
  TANDEM_ROOM_EVENT_TYPE,
  TANDEM_SPACE_EVENT_TYPE,
  nowIso,
  type TandemDiscoveredUser,
  type TandemInviteLinkPayload,
  type TandemInviteRecord,
  type TandemInviteResponseContent,
  type TandemInviteToDeviceContent,
} from './tandemShared';
import {
  addTandemRelationship,
  ensureTandemRelationshipRooms,
  updateInviteStatus,
  upsertOutgoingInvite,
} from './tandemRelationships';
import { ensureTandemSpaceLinks, updateTandemRoomMeta } from './tandemRooms';
import {
  parseInviteResponseContent,
  parseInviteToDeviceContent,
  withTimeout,
  isValidMatrixUserId,
} from './tandemShared';

async function sendInviteToDevice(
  client: MatrixClient,
  payload: TandemInviteToDeviceContent
) {
  await client.sendToDevice(
    TANDEM_INVITE_TO_DEVICE_EVENT_TYPE,
    new Map([[payload.inviteeMatrixId, new Map([['*', payload]])]])
  );
}

export async function sendInviteResponseToDevice(
  client: MatrixClient,
  payload: TandemInviteResponseContent
) {
  await client.sendToDevice(
    TANDEM_INVITE_RESPONSE_TO_DEVICE_EVENT_TYPE,
    new Map([[payload.inviterMatrixId, new Map([['*', payload]])]])
  );
}

export async function discoverMatrixUser(
  client: MatrixClient,
  matrixUserId: string
): Promise<TandemDiscoveredUser> {
  const candidate = matrixUserId.trim();
  if (!isValidMatrixUserId(candidate)) {
    throw new Error('Enter a valid Matrix ID such as @klyn:matrix.org.');
  }

  try {
    const directory = await withTimeout(
      client.searchUserDirectory({ term: candidate, limit: 10 }),
      10000,
      'User lookup timed out. Please try again.'
    );
    const exactMatch = directory.results.find(
      (entry) => entry.user_id === candidate
    );

    if (exactMatch) {
      return {
        userId: exactMatch.user_id,
        displayName: exactMatch.display_name ?? null,
        avatarUrl: exactMatch.avatar_url
          ? (client.mxcUrlToHttp(exactMatch.avatar_url, 96, 96, 'crop') ?? null)
          : null,
      };
    }
  } catch (error) {
    console.warn(
      'User directory lookup failed, falling back to profile lookup.',
      error
    );
  }

  try {
    const profile = await withTimeout(
      client.getProfileInfo(candidate),
      10000,
      'Profile lookup timed out. Please try again.'
    );
    return {
      userId: candidate,
      displayName: profile.displayname ?? null,
      avatarUrl: profile.avatar_url
        ? (client.mxcUrlToHttp(profile.avatar_url, 96, 96, 'crop') ?? null)
        : null,
    };
  } catch {
    throw new Error('That Matrix user could not be found.');
  }
}

export async function createTandemInvite(params: {
  client: MatrixClient;
  inviterMatrixId: string;
  inviteeMatrixId: string;
  inviteeDisplayName?: string | null;
  origin: string;
  message?: string;
}) {
  const {
    client,
    inviterMatrixId,
    inviteeMatrixId,
    inviteeDisplayName,
    origin,
    message,
  } = params;
  const createdAt = nowIso();
  const inviteId = createId('invite');
  const pairLabel = inviteeDisplayName?.trim() || inviteeMatrixId;

  const { room_id: spaceId } = await client.createRoom({
    name: `Tandem Home: ${pairLabel}`,
    visibility: Visibility.Private,
    preset: Preset.TrustedPrivateChat,
    invite: [inviteeMatrixId],
    creation_content: {
      type: 'm.space',
    },
    initial_state: [
      {
        type: TANDEM_SPACE_EVENT_TYPE,
        state_key: '',
        content: {
          kind: 'tandem-space',
          version: 1,
          inviterMatrixId,
          inviteeMatrixId,
          inviteId,
        },
      },
    ],
  });

  const { room_id: mainRoomId } = await client.createRoom({
    name: 'Main Chat',
    topic: 'Your Tandem home chat',
    visibility: Visibility.Private,
    preset: Preset.TrustedPrivateChat,
    invite: [inviteeMatrixId],
    is_direct: true,
    initial_state: [
      {
        type: TANDEM_ROOM_EVENT_TYPE,
        state_key: '',
        content: {
          kind: 'tandem-main-room',
          version: 1,
          spaceId,
          inviteId,
        },
      },
    ],
  });

  await ensureTandemSpaceLinks({
    client,
    spaceId,
    roomIds: [mainRoomId],
    userIds: [inviterMatrixId, inviteeMatrixId],
  });
  await updateTandemRoomMeta(client, mainRoomId, {
    pinned: true,
  });

  const directAccountData = client
    .getAccountData('m.direct')
    ?.getContent<Record<string, string[]>>();
  const directRooms = Array.isArray(directAccountData?.[inviteeMatrixId])
    ? directAccountData?.[inviteeMatrixId]
    : [];
  await client.setAccountData('m.direct', {
    ...(directAccountData && typeof directAccountData === 'object'
      ? directAccountData
      : {}),
    [inviteeMatrixId]: Array.from(new Set([...directRooms, mainRoomId])),
  });

  const inviteUrl = new URL('/tandem/invite', origin);
  inviteUrl.searchParams.set('invite', inviteId);
  inviteUrl.searchParams.set('inviter', inviterMatrixId);
  inviteUrl.searchParams.set('invitee', inviteeMatrixId);
  inviteUrl.searchParams.set('space', spaceId);
  inviteUrl.searchParams.set('room', mainRoomId);

  const inviteRecord: TandemInviteRecord = {
    inviteId,
    inviterMatrixId,
    inviteeMatrixId,
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
    spaceId,
    mainRoomId,
    inviteUrl: inviteUrl.toString(),
    message: message?.trim() || undefined,
  };

  await upsertOutgoingInvite(client, inviteRecord);
  await sendInviteToDevice(client, {
    inviteId,
    inviterMatrixId,
    inviteeMatrixId,
    spaceId,
    mainRoomId,
    inviteUrl: inviteRecord.inviteUrl,
    createdAt,
    message: inviteRecord.message,
  });

  return inviteRecord;
}

export async function acceptTandemInvite(
  client: MatrixClient,
  invite: TandemInviteRecord
) {
  await ensureTandemRelationshipRooms(client, {
    sharedSpaceId: invite.spaceId,
    mainRoomId: invite.mainRoomId,
  });
  await updateInviteStatus(client, invite.inviteId, 'incoming', 'accepted');
  await addTandemRelationship(client, {
    inviteId: invite.inviteId,
    partnerUserId: invite.inviterMatrixId,
    sharedSpaceId: invite.spaceId,
    mainRoomId: invite.mainRoomId,
    createdAt: nowIso(),
    status: 'active',
  });
}

export async function declineTandemInvite(
  client: MatrixClient,
  invite: TandemInviteRecord
) {
  await updateInviteStatus(client, invite.inviteId, 'incoming', 'declined');
}

export function inviteFromToDeviceEvent(
  event: MatrixEvent
): TandemInviteRecord | null {
  if (event.getType() !== TANDEM_INVITE_TO_DEVICE_EVENT_TYPE) {
    return null;
  }

  const content = parseInviteToDeviceContent(event.getContent());
  if (!content) {
    return null;
  }

  return {
    inviteId: content.inviteId,
    inviterMatrixId: content.inviterMatrixId,
    inviteeMatrixId: content.inviteeMatrixId,
    status: 'pending',
    createdAt: content.createdAt,
    updatedAt: content.createdAt,
    spaceId: content.spaceId,
    mainRoomId: content.mainRoomId,
    inviteUrl: content.inviteUrl,
    message: content.message,
  };
}

export function inviteResponseFromToDeviceEvent(
  event: MatrixEvent
): TandemInviteResponseContent | null {
  if (event.getType() !== TANDEM_INVITE_RESPONSE_TO_DEVICE_EVENT_TYPE) {
    return null;
  }

  return parseInviteResponseContent(event.getContent());
}

export function toIncomingInviteFromLinkPayload(
  payload: TandemInviteLinkPayload
): TandemInviteRecord {
  const createdAt = nowIso();

  return {
    inviteId: payload.inviteId,
    inviterMatrixId: payload.inviter,
    inviteeMatrixId: payload.invitee,
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
    spaceId: payload.spaceId,
    mainRoomId: payload.roomId,
    inviteUrl: '',
  };
}
