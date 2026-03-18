import { MsgType, RelationType } from 'matrix-js-sdk';
import type { RoomMessage } from './types';

export function buildTextMessageRequest({
  body,
  mentionedUserIds,
  replyToMessage,
  editMessage,
  threadRootId,
}: {
  body: string;
  mentionedUserIds: string[];
  replyToMessage?: RoomMessage | null;
  editMessage?: RoomMessage | null;
  threadRootId?: string | null;
}) {
  if (editMessage) {
    return {
      threadRootId: null,
      content: {
        msgtype: MsgType.Text,
        body: `* ${body}`,
        'm.new_content': {
          msgtype: MsgType.Text,
          body,
          ...(mentionedUserIds.length
            ? { 'm.mentions': { user_ids: mentionedUserIds } }
            : {}),
        },
        'm.relates_to': {
          event_id: editMessage.id,
          rel_type: RelationType.Replace,
        },
      } satisfies Record<string, unknown>,
    };
  }

  return {
    threadRootId: threadRootId ?? null,
    content: {
      msgtype: MsgType.Text,
      body,
      ...(!threadRootId && replyToMessage?.id
        ? { 'm.relates_to': { 'm.in_reply_to': { event_id: replyToMessage.id } } }
        : {}),
      ...(mentionedUserIds.length
        ? { 'm.mentions': { user_ids: mentionedUserIds } }
        : {}),
    } satisfies Record<string, unknown>,
  };
}
