import { Preset, Visibility, type MatrixClient, type Room } from 'matrix-js-sdk';
import {
  TANDEM_ROOM_EVENT_TYPE,
  TANDEM_ROOM_META_EVENT_TYPE,
  TANDEM_SPACE_EVENT_TYPE,
  buildViaServers,
  hasRequiredViaServers,
  nowIso,
  type SpaceLinkParams,
  type TandemMembershipPolicy,
  type TandemRelationshipRecord,
  type TandemRoomMeta,
} from './tandemShared';
import { getResolvedTandemRelationships } from './tandemRelationships';

type SendStateEvent = (
  roomId: string,
  eventType: string,
  content: Record<string, unknown>,
  stateKey?: string
) => Promise<unknown>;

function sendStateEvent(client: MatrixClient): SendStateEvent {
  return (roomId, eventType, content, stateKey) =>
    (client.sendStateEvent as SendStateEvent)(
      roomId,
      eventType,
      content,
      stateKey
    );
}

export function getTandemRoomMeta(
  room: Room | null | undefined
): TandemRoomMeta {
  if (!room) {
    return {};
  }

  const content = room.getAccountData(TANDEM_ROOM_META_EVENT_TYPE)?.getContent();
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

  const parentEvents = room.currentState.getStateEvents('m.space.parent');
  const parentList = Array.isArray(parentEvents)
    ? parentEvents
    : parentEvents
      ? [parentEvents]
      : [];

  const canonicalParent = parentList.find((event) => {
    const stateKey = event.getStateKey();
    if (!stateKey) {
      return false;
    }

    const content = event.getContent<{ canonical?: boolean }>();
    if (!content?.canonical) {
      return false;
    }

    return Boolean(
      client.getRoom(stateKey)?.currentState.getStateEvents(TANDEM_SPACE_EVENT_TYPE, '')
    );
  });

  if (canonicalParent) {
    return canonicalParent.getStateKey() ?? null;
  }

  const relationship = getResolvedTandemRelationships(client).relationships.find(
    (entry) => entry.mainRoomId === room.roomId
  );

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

  await client.setRoomAccountData(roomId, TANDEM_ROOM_META_EVENT_TYPE, nextMeta);
}

export async function deleteTandemRoom(
  client: MatrixClient,
  room: Room | null | undefined
) {
  if (!room) {
    throw new Error('Room not found.');
  }

  const policy = getTandemMembershipPolicy(client, room);
  if (policy.roomKind !== 'tandem-child-room') {
    throw new Error('Only extra topics can be deleted.');
  }

  const currentUserId = client.getUserId();
  if (!currentUserId) {
    throw new Error('You must be signed in to delete a topic.');
  }

  const spaceId = getTandemSpaceIdForRoom(client, room);
  const sendEvent = sendStateEvent(client);

  if (spaceId) {
    await sendEvent(spaceId, 'm.space.child', {}, room.roomId);
    await sendEvent(room.roomId, 'm.space.parent', {}, spaceId);
  }

  await updateTandemRoomMeta(client, room.roomId, {
    hidden: true,
    archived: false,
    pinned: false,
    updatedAt: nowIso(),
  });

  const otherMembers = room.getMembers().filter(
    (member) =>
      member.userId !== currentUserId &&
      (member.membership === 'join' || member.membership === 'invite')
  );

  await Promise.allSettled(
    otherMembers.map((member) =>
      client.kick(room.roomId, member.userId, 'Topic deleted')
    )
  );

  await client.leave(room.roomId);
  await client.forget(room.roomId, true);
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
  const sendEvent = sendStateEvent(client);

  await Promise.all(
    uniqueRoomIds.map(async (roomId) => {
      const spaceChildEvent = client
        .getRoom(spaceId)
        ?.currentState.getStateEvents('m.space.child', roomId);

      if (!hasRequiredViaServers(spaceChildEvent?.getContent(), via)) {
        await sendEvent(spaceId, 'm.space.child', { via }, roomId);
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
        await sendEvent(roomId, 'm.space.parent', { via, canonical: true }, spaceId);
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
