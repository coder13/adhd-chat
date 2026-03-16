import { ClientEvent, type MatrixClient, type MatrixEvent, type Room } from 'matrix-js-sdk';
import {
  TANDEM_RELATIONSHIPS_EVENT_TYPE,
  TANDEM_ROOM_EVENT_TYPE,
  TANDEM_SPACE_EVENT_TYPE,
  dedupeInvites,
  dedupeRelationships,
  getOtherMemberUserId,
  normalizeRelationshipsContent,
  nowIso,
  type TandemInviteRecord,
  type TandemRelationshipRecord,
  type TandemRelationshipRoomsRecoveryResult,
  type TandemRelationshipsAccountData,
} from './tandemShared';

export function getTandemRelationships(
  client: MatrixClient
): TandemRelationshipsAccountData {
  return normalizeRelationshipsContent(
    client.getAccountData(TANDEM_RELATIONSHIPS_EVENT_TYPE)?.getContent()
  );
}

function inferRelationshipsFromRooms(
  client: MatrixClient
): TandemRelationshipRecord[] {
  const currentUserId = client.getUserId();
  if (!currentUserId) {
    return [];
  }

  return client
    .getRooms()
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

      const childEvents = spaceRoom.currentState.getStateEvents('m.space.child');
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
  status: TandemInviteRecord['status']
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
