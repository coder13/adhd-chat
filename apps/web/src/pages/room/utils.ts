import { MsgType } from 'matrix-js-sdk';
import type { PendingTandemRoomRecord } from '../../lib/matrix/pendingTandemRoom';

export function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

export function buildPendingRoomMessages(pendingRoom: PendingTandemRoomRecord) {
  const messages = [
    {
      id: `${pendingRoom.pendingRoomId}:start`,
      senderId: 'Tandem',
      senderName: 'Tandem',
      body: `Creating "${pendingRoom.roomName}" in your Tandem hub.`,
      timestamp: pendingRoom.createdAt,
      isOwn: false,
      msgtype: MsgType.Notice,
    },
    {
      id: `${pendingRoom.pendingRoomId}:invite`,
      senderId: 'Tandem',
      senderName: 'Tandem',
      body: `Inviting ${pendingRoom.partnerUserId} and linking the topic to the hub.`,
      timestamp: pendingRoom.createdAt + 1,
      isOwn: false,
      msgtype: MsgType.Notice,
    },
  ];

  if (pendingRoom.status === 'failed' && pendingRoom.error) {
    messages.push({
      id: `${pendingRoom.pendingRoomId}:error`,
      senderId: 'Tandem',
      senderName: 'Tandem',
      body: pendingRoom.error,
      timestamp: pendingRoom.createdAt + 2,
      isOwn: false,
      msgtype: MsgType.Notice,
    });
  }

  if (pendingRoom.status === 'ready') {
    messages.push({
      id: `${pendingRoom.pendingRoomId}:ready`,
      senderId: 'Tandem',
      senderName: 'Tandem',
      body: 'Topic created. Opening it now.',
      timestamp: pendingRoom.createdAt + 2,
      isOwn: false,
      msgtype: MsgType.Notice,
    });
  }

  return messages;
}
