import {
  ClientEvent,
  Preset,
  Visibility,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import {
  isValidMatrixUserId,
  parseInviteResponseContent,
  parseInviteToDeviceContent,
  type TandemInviteLinkPayload,
  type TandemInviteResponseContent,
  type TandemInviteToDeviceContent,
} from './tandemData';
import { createId } from '../id';

export {
  getInviteLinkPayloadFromSearchParams,
  isValidMatrixUserId,
  type TandemInviteLinkPayload,
} from './tandemData';

export const TANDEM_RELATIONSHIPS_EVENT_TYPE = 'com.tandem.relationships';
export const TANDEM_ROOM_META_EVENT_TYPE = 'com.tandem.room_meta';
export const TANDEM_SPACE_EVENT_TYPE = 'com.tandem.space';
export const TANDEM_ROOM_EVENT_TYPE = 'com.tandem.room';
export const TANDEM_INVITE_TO_DEVICE_EVENT_TYPE = 'com.tandem.invite';
export const TANDEM_INVITE_RESPONSE_TO_DEVICE_EVENT_TYPE =
  'com.tandem.invite_response';

export type TandemInviteStatus = 'pending' | 'accepted' | 'declined';

export interface TandemInviteRecord {
  inviteId: string;
  inviterMatrixId: string;
  inviteeMatrixId: string;
  status: TandemInviteStatus;
  createdAt: string;
  updatedAt: string;
  spaceId: string;
  mainRoomId: string;
  inviteUrl: string;
  message?: string;
}

export interface TandemRelationshipRecord {
  inviteId: string;
  partnerUserId: string;
  sharedSpaceId: string;
  mainRoomId: string;
  createdAt: string;
  status: 'active';
}

export interface TandemRelationshipRoomsRecoveryResult {
  recoveredRoomIds: string[];
  failedRoomIds: string[];
}

export type TandemMembershipRoomKind =
  | 'tandem-space'
  | 'tandem-main-room'
  | 'tandem-child-room'
  | 'other-room';

export interface TandemMembershipPolicy {
  roomKind: TandemMembershipRoomKind;
  supportsJoin: boolean;
  supportsLeave: boolean;
  summary: string;
}

export interface TandemRelationshipsAccountData {
  incomingInvites: TandemInviteRecord[];
  outgoingInvites: TandemInviteRecord[];
  relationships: TandemRelationshipRecord[];
}

export interface TandemRoomMeta {
  hidden?: boolean;
  archived?: boolean;
  pinned?: boolean;
  updatedAt?: string;
}

export interface TandemDiscoveredUser {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface SpaceLinkParams {
  client: MatrixClient;
  spaceId: string;
  roomIds: string[];
  userIds: string[];
}

function nowIso() {
  return new Date().toISOString();
}

function getHomeserverFromMatrixId(userId: string) {
  const separatorIndex = userId.lastIndexOf(':');
  if (separatorIndex === -1) {
    return null;
  }

  return userId.slice(separatorIndex + 1) || null;
}

function buildViaServers(userIds: string[]) {
  return Array.from(
    new Set(
      userIds
        .map((userId) => getHomeserverFromMatrixId(userId))
        .filter((server): server is string => Boolean(server))
    )
  );
}

function hasRequiredViaServers(content: unknown, viaServers: string[]) {
  if (!content || typeof content !== 'object') {
    return false;
  }

  const existingVia = (content as { via?: unknown }).via;
  if (!Array.isArray(existingVia)) {
    return false;
  }

  return viaServers.every((server) => existingVia.includes(server));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
) {
  return await Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function normalizeRelationshipsContent(
  content: unknown
): TandemRelationshipsAccountData {
  if (!content || typeof content !== 'object') {
    return {
      incomingInvites: [],
      outgoingInvites: [],
      relationships: [],
    };
  }

  const next = content as Partial<TandemRelationshipsAccountData>;

  return {
    incomingInvites: Array.isArray(next.incomingInvites)
      ? next.incomingInvites
      : [],
    outgoingInvites: Array.isArray(next.outgoingInvites)
      ? next.outgoingInvites
      : [],
    relationships: Array.isArray(next.relationships) ? next.relationships : [],
  };
}

function dedupeInvites(invites: TandemInviteRecord[]) {
  const byId = new Map<string, TandemInviteRecord>();
  invites.forEach((invite) => {
    const existing = byId.get(invite.inviteId);
    if (!existing || existing.updatedAt < invite.updatedAt) {
      byId.set(invite.inviteId, invite);
    }
  });

  return [...byId.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

function dedupeRelationships(relationships: TandemRelationshipRecord[]) {
  const bySpaceId = new Map<string, TandemRelationshipRecord>();
  relationships.forEach((relationship) => {
    const existing = bySpaceId.get(relationship.sharedSpaceId);
    if (!existing || existing.createdAt < relationship.createdAt) {
      bySpaceId.set(relationship.sharedSpaceId, relationship);
    }
  });

  return [...bySpaceId.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export function getTandemRelationships(
  client: MatrixClient
): TandemRelationshipsAccountData {
  return normalizeRelationshipsContent(
    client.getAccountData(TANDEM_RELATIONSHIPS_EVENT_TYPE)?.getContent()
  );
}

function getOtherMemberUserId(room: Room, currentUserId: string) {
  return (
    room
      .getMembers()
      .find(
        (member) =>
          member.userId !== currentUserId && member.membership !== 'leave'
      )?.userId ?? null
  );
}

function inferRelationshipsFromRooms(
  client: MatrixClient
): TandemRelationshipRecord[] {
  const currentUserId = client.getUserId();
  if (!currentUserId) {
    return [];
  }

  const rooms = client.getRooms();

  return rooms
    .filter((room) =>
      room.currentState.getStateEvents(TANDEM_SPACE_EVENT_TYPE, '')
    )
    .map((spaceRoom) => {
      const spaceContent = spaceRoom.currentState
        .getStateEvents(TANDEM_SPACE_EVENT_TYPE, '')
        ?.getContent<{
          inviteId?: string;
          inviterMatrixId?: string;
          inviteeMatrixId?: string;
        }>();

      const childEvents =
        spaceRoom.currentState.getStateEvents('m.space.child');
      const childList = Array.isArray(childEvents)
        ? childEvents
        : childEvents
          ? [childEvents]
          : [];

      const childRooms = childList
        .map((event) => client.getRoom(event.getStateKey() ?? undefined))
        .filter((room): room is Room => room !== null);

      const mainRoom =
        childRooms.find((room) => {
          const tandemRoomContent = room.currentState
            .getStateEvents(TANDEM_ROOM_EVENT_TYPE, '')
            ?.getContent<{ kind?: string }>();
          return tandemRoomContent?.kind === 'tandem-main-room';
        }) ??
        childRooms[0] ??
        null;

      if (!mainRoom) {
        return null;
      }

      const inferredPartnerUserId =
        getOtherMemberUserId(spaceRoom, currentUserId) ??
        getOtherMemberUserId(mainRoom, currentUserId) ??
        (spaceContent?.inviterMatrixId === currentUserId
          ? spaceContent.inviteeMatrixId
          : spaceContent?.inviterMatrixId) ??
        null;

      if (!inferredPartnerUserId) {
        return null;
      }

      return {
        inviteId: spaceContent?.inviteId ?? `derived-${spaceRoom.roomId}`,
        partnerUserId: inferredPartnerUserId,
        sharedSpaceId: spaceRoom.roomId,
        mainRoomId: mainRoom.roomId,
        createdAt: nowIso(),
        status: 'active' as const,
      };
    })
    .filter(
      (relationship): relationship is TandemRelationshipRecord =>
        relationship !== null
    );
}

export function getResolvedTandemRelationships(
  client: MatrixClient
): TandemRelationshipsAccountData {
  const accountData = getTandemRelationships(client);
  const inferredRelationships = inferRelationshipsFromRooms(client);

  return {
    ...accountData,
    relationships: dedupeRelationships([
      ...accountData.relationships,
      ...inferredRelationships,
    ]),
  };
}

export function getTandemRoomMeta(
  room: Room | null | undefined
): TandemRoomMeta {
  if (!room) {
    return {};
  }

  const content = room
    .getAccountData(TANDEM_ROOM_META_EVENT_TYPE)
    ?.getContent();
  if (!content || typeof content !== 'object') {
    return {};
  }

  return content as TandemRoomMeta;
}

export function getTandemSpaceIdForRoom(
  client: MatrixClient,
  room: Room | null | undefined
) {
  if (!room) {
    return null;
  }

  const tandemRoomContent = room.currentState
    .getStateEvents(TANDEM_ROOM_EVENT_TYPE, '')
    ?.getContent<{ spaceId?: string }>();

  if (
    typeof tandemRoomContent?.spaceId === 'string' &&
    tandemRoomContent.spaceId
  ) {
    return tandemRoomContent.spaceId;
  }

  const relationship = getResolvedTandemRelationships(
    client
  ).relationships.find((entry) => entry.mainRoomId === room.roomId);

  return relationship?.sharedSpaceId ?? null;
}

export function getTandemMembershipPolicy(
  client: MatrixClient,
  room: Room | null | undefined
): TandemMembershipPolicy {
  if (!room) {
    return {
      roomKind: 'other-room',
      supportsJoin: false,
      supportsLeave: false,
      summary: 'Unavailable here.',
    };
  }

  if (room.currentState.getStateEvents(TANDEM_SPACE_EVENT_TYPE, '')) {
    return {
      roomKind: 'tandem-space',
      supportsJoin: true,
      supportsLeave: false,
      summary: 'Leave unavailable.',
    };
  }

  const tandemRoomContent = room.currentState
    .getStateEvents(TANDEM_ROOM_EVENT_TYPE, '')
    ?.getContent<{ kind?: string }>();

  if (tandemRoomContent?.kind === 'tandem-main-room') {
    return {
      roomKind: 'tandem-main-room',
      supportsJoin: true,
      supportsLeave: false,
      summary: 'Leave unavailable.',
    };
  }

  if (
    tandemRoomContent?.kind === 'tandem-child-room' ||
    getTandemSpaceIdForRoom(client, room)
  ) {
    return {
      roomKind: 'tandem-child-room',
      supportsJoin: true,
      supportsLeave: true,
      summary: '',
    };
  }

  return {
    roomKind: 'other-room',
    supportsJoin: false,
    supportsLeave: false,
    summary: 'Unavailable here.',
  };
}

export async function joinTandemRoom(
  client: MatrixClient,
  room: Room | null | undefined
) {
  if (!room) {
    throw new Error('Room not found.');
  }

  const policy = getTandemMembershipPolicy(client, room);
  if (!policy.supportsJoin) {
    throw new Error(policy.summary);
  }

  await client.joinRoom(room.roomId);
}

export async function leaveTandemRoom(
  client: MatrixClient,
  room: Room | null | undefined
) {
  if (!room) {
    throw new Error('Room not found.');
  }

  const policy = getTandemMembershipPolicy(client, room);
  if (!policy.supportsLeave) {
    throw new Error(policy.summary);
  }

  await client.leave(room.roomId);
}

export async function saveTandemRelationships(
  client: MatrixClient,
  data: TandemRelationshipsAccountData
) {
  await client.setAccountData(TANDEM_RELATIONSHIPS_EVENT_TYPE, {
    incomingInvites: dedupeInvites(data.incomingInvites),
    outgoingInvites: dedupeInvites(data.outgoingInvites),
    relationships: dedupeRelationships(data.relationships),
  });
}

export async function upsertIncomingInvite(
  client: MatrixClient,
  invite: TandemInviteRecord
) {
  const data = getTandemRelationships(client);

  await saveTandemRelationships(client, {
    ...data,
    incomingInvites: [
      ...data.incomingInvites.filter(
        (entry) => entry.inviteId !== invite.inviteId
      ),
      invite,
    ],
  });
}

export async function upsertOutgoingInvite(
  client: MatrixClient,
  invite: TandemInviteRecord
) {
  const data = getTandemRelationships(client);

  await saveTandemRelationships(client, {
    ...data,
    outgoingInvites: [
      ...data.outgoingInvites.filter(
        (entry) => entry.inviteId !== invite.inviteId
      ),
      invite,
    ],
  });
}

export async function addTandemRelationship(
  client: MatrixClient,
  relationship: TandemRelationshipRecord
) {
  const data = getTandemRelationships(client);

  await saveTandemRelationships(client, {
    ...data,
    relationships: [
      ...data.relationships.filter(
        (entry) => entry.sharedSpaceId !== relationship.sharedSpaceId
      ),
      relationship,
    ],
  });
}

function getRoomIdsNeedingRecovery(
  client: MatrixClient,
  relationship: Pick<TandemRelationshipRecord, 'sharedSpaceId' | 'mainRoomId'>
) {
  return [relationship.sharedSpaceId, relationship.mainRoomId].filter(
    (roomId, index, roomIds) => {
      if (!roomId || roomIds.indexOf(roomId) !== index) {
        return false;
      }

      return client.getRoom(roomId)?.getMyMembership() !== 'join';
    }
  );
}

export async function ensureTandemRelationshipRooms(
  client: MatrixClient,
  relationship: Pick<TandemRelationshipRecord, 'sharedSpaceId' | 'mainRoomId'>
) {
  const recoveredRoomIds: string[] = [];
  const failedRoomIds: string[] = [];

  for (const roomId of getRoomIdsNeedingRecovery(client, relationship)) {
    try {
      await client.joinRoom(roomId);
      recoveredRoomIds.push(roomId);
    } catch (error) {
      console.error(`Failed to recover Tandem room ${roomId}`, error);
      failedRoomIds.push(roomId);
    }
  }

  return {
    recoveredRoomIds,
    failedRoomIds,
  } satisfies TandemRelationshipRoomsRecoveryResult;
}

export async function recoverTandemRelationshipRooms(client: MatrixClient) {
  const relationships = getResolvedTandemRelationships(client).relationships;
  const recoveredRoomIds = new Set<string>();
  const failedRoomIds = new Set<string>();

  for (const relationship of relationships) {
    const result = await ensureTandemRelationshipRooms(client, relationship);
    result.recoveredRoomIds.forEach((roomId) => {
      recoveredRoomIds.add(roomId);
    });
    result.failedRoomIds.forEach((roomId) => {
      failedRoomIds.add(roomId);
    });
  }

  return {
    recoveredRoomIds: [...recoveredRoomIds],
    failedRoomIds: [...failedRoomIds],
  } satisfies TandemRelationshipRoomsRecoveryResult;
}

export async function updateInviteStatus(
  client: MatrixClient,
  inviteId: string,
  direction: 'incoming' | 'outgoing',
  status: TandemInviteStatus
) {
  const data = getTandemRelationships(client);
  const key = direction === 'incoming' ? 'incomingInvites' : 'outgoingInvites';
  const invites = data[key].map((invite) =>
    invite.inviteId === inviteId
      ? {
          ...invite,
          status,
          updatedAt: nowIso(),
        }
      : invite
  );

  await saveTandemRelationships(client, {
    ...data,
    [key]: invites,
  });
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

export async function updateTandemRoomMeta(
  client: MatrixClient,
  roomId: string,
  metaUpdate: Partial<TandemRoomMeta>
) {
  const room = client.getRoom(roomId);
  const currentMeta = getTandemRoomMeta(room);
  const nextMeta: TandemRoomMeta = {
    ...currentMeta,
    ...metaUpdate,
    updatedAt: nowIso(),
  };

  await client.setRoomAccountData(
    roomId,
    TANDEM_ROOM_META_EVENT_TYPE,
    nextMeta
  );
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

export async function ensureTandemSpaceLinks({
  client,
  spaceId,
  roomIds,
  userIds,
}: SpaceLinkParams) {
  const via = buildViaServers(userIds);
  if (via.length === 0) {
    return;
  }

  const uniqueRoomIds = Array.from(new Set(roomIds.filter(Boolean)));

  await Promise.all(
    uniqueRoomIds.map(async (roomId) => {
      const spaceChildEvent = client
        .getRoom(spaceId)
        ?.currentState.getStateEvents('m.space.child', roomId);

      if (!hasRequiredViaServers(spaceChildEvent?.getContent(), via)) {
        await (
          client.sendStateEvent as (
            nextRoomId: string,
            eventType: string,
            content: Record<string, unknown>,
            stateKey?: string
          ) => Promise<unknown>
        )(spaceId, 'm.space.child', { via }, roomId);
      }

      const parentEvent = client
        .getRoom(roomId)
        ?.currentState.getStateEvents('m.space.parent', spaceId);
      const parentContent = parentEvent?.getContent<{
        via?: string[];
        canonical?: boolean;
      }>();
      const hasCanonicalParent =
        Boolean(parentContent?.canonical) &&
        hasRequiredViaServers(parentContent, via);

      if (!hasCanonicalParent) {
        await (
          client.sendStateEvent as (
            nextRoomId: string,
            eventType: string,
            content: Record<string, unknown>,
            stateKey?: string
          ) => Promise<unknown>
        )(roomId, 'm.space.parent', { via, canonical: true }, spaceId);
      }
    })
  );
}

export async function createTandemChildRoom(params: {
  client: MatrixClient;
  relationship: TandemRelationshipRecord;
  creatorUserId: string;
  name?: string;
  topic?: string;
}) {
  const { client, relationship, creatorUserId, name, topic } = params;
  const roomName = name?.trim() || 'Tangent';

  const { room_id: roomId } = await client.createRoom({
    name: roomName,
    topic: topic?.trim() || undefined,
    visibility: Visibility.Private,
    preset: Preset.TrustedPrivateChat,
    invite: [relationship.partnerUserId],
    initial_state: [
      {
        type: TANDEM_ROOM_EVENT_TYPE,
        state_key: '',
        content: {
          kind: 'tandem-child-room',
          version: 1,
          spaceId: relationship.sharedSpaceId,
          createdBy: creatorUserId,
        },
      },
    ],
  });

  await ensureTandemSpaceLinks({
    client,
    spaceId: relationship.sharedSpaceId,
    roomIds: [roomId],
    userIds: [creatorUserId, relationship.partnerUserId],
  });
  return roomId;
}

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

export function attachTandemAccountDataListener(
  client: MatrixClient,
  onChange: () => void
) {
  const handleAccountData = (event: MatrixEvent) => {
    if (event.getType() === TANDEM_RELATIONSHIPS_EVENT_TYPE) {
      onChange();
    }
  };

  client.on(ClientEvent.AccountData, handleAccountData);

  return () => {
    client.off(ClientEvent.AccountData, handleAccountData);
  };
}
