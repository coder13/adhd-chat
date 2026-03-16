import { type MatrixClient, type Room } from 'matrix-js-sdk';

export {
  getInviteLinkPayloadFromSearchParams,
  isValidMatrixUserId,
  parseInviteResponseContent,
  parseInviteToDeviceContent,
  type TandemInviteLinkPayload,
  type TandemInviteResponseContent,
  type TandemInviteToDeviceContent,
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

export interface SpaceLinkParams {
  client: MatrixClient;
  spaceId: string;
  roomIds: string[];
  userIds: string[];
}

export function nowIso() {
  return new Date().toISOString();
}

function getHomeserverFromMatrixId(userId: string) {
  const separatorIndex = userId.lastIndexOf(':');
  if (separatorIndex === -1) {
    return null;
  }

  return userId.slice(separatorIndex + 1) || null;
}

export function buildViaServers(userIds: string[]) {
  return Array.from(
    new Set(
      userIds
        .map((userId) => getHomeserverFromMatrixId(userId))
        .filter((server): server is string => Boolean(server))
    )
  );
}

export function hasRequiredViaServers(content: unknown, viaServers: string[]) {
  if (!content || typeof content !== 'object') {
    return false;
  }

  const existingVia = (content as { via?: unknown }).via;
  if (!Array.isArray(existingVia)) {
    return false;
  }

  return viaServers.every((server) => existingVia.includes(server));
}

export async function withTimeout<T>(
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

export function normalizeRelationshipsContent(
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

export function dedupeInvites(invites: TandemInviteRecord[]) {
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

export function dedupeRelationships(relationships: TandemRelationshipRecord[]) {
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

export function getOtherMemberUserId(room: Room, currentUserId: string) {
  return (
    room
      .getMembers()
      .find(
        (member) =>
          member.userId !== currentUserId && member.membership !== 'leave'
      )?.userId ?? null
  );
}
