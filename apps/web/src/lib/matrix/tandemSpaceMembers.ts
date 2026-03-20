import type { MatrixClient, Room, RoomMember } from 'matrix-js-sdk';

export interface TandemSpaceMemberSummary {
  userId: string;
  displayName: string;
  membership: string;
}

export function buildTandemSpaceMemberSummaries(room: Room) {
  return room
    .getMembers()
    .filter(
      (member) => member.membership !== 'leave' && member.membership !== 'ban'
    )
    .map((member: RoomMember) => ({
      userId: member.userId,
      displayName: member.name || member.userId,
      membership: member.membership || 'join',
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function loadTandemSpaceMemberSummaries(
  spaceId: string,
  client: MatrixClient
) {
  const room = client.getRoom(spaceId);
  if (!room) {
    throw new Error('Tandem hub not found.');
  }

  await room.loadMembersIfNeeded();

  return buildTandemSpaceMemberSummaries(room);
}
