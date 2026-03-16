import { lockClosedOutline, trashOutline } from 'ionicons/icons';
import { RelationType, type MatrixClient, type Room } from 'matrix-js-sdk';
import type { Dispatch, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { updateRoomIdentity } from '../../lib/matrix/identity';
import {
  deleteTandemRoom,
  joinTandemRoom,
  leaveTandemRoom,
  updateTandemRoomMeta,
  type TandemRelationshipRecord,
  type TandemRoomMeta,
} from '../../lib/matrix/tandem';
import { startPendingTandemRoomCreation } from '../../lib/matrix/pendingTandemRoom';
import type { OptimisticReactionChange } from '../../lib/matrix/optimisticTimeline';
import type { TandemSpaceRoomSummary } from '../../lib/matrix/spaceCatalog';
import type { RoomMessage } from './types';

interface UseRoomPageActionsParams {
  client: MatrixClient | null;
  userId: string | null | undefined;
  roomId: string;
  currentRoom: Room | null;
  isPendingRoom: boolean;
  isEncrypted: boolean;
  enablingEncryption: boolean;
  setEnablingEncryption: (value: boolean) => void;
  setActionError: (value: string | null) => void;
  setShowIdentityModal: (value: boolean) => void;
  setShowTopicNotificationModal: (value: boolean) => void;
  setShowLeaveConfirm: (value: boolean) => void;
  setShowArchiveConfirm: (value: boolean) => void;
  setShowDeleteTopicConfirm: (value: boolean) => void;
  setDeleteTopicNameInput: (value: string) => void;
  setDeletingTopic: (value: boolean) => void;
  setSavingIdentity: (value: boolean) => void;
  setCreatingTangent: (value: boolean) => void;
  setShowTangentModal: (value: boolean) => void;
  setTangentError: (value: string | null) => void;
  setMessageMenu: (value: { message: RoomMessage; position: { x: number; y: number } } | null) => void;
  setOptimisticReactionChanges: Dispatch<SetStateAction<OptimisticReactionChange[]>>;
  canDeleteTopic: boolean;
  roomMembership: string;
  membershipPolicy: { supportsLeave: boolean } | null;
  roomMeta: TandemRoomMeta;
  pinnedMessageIds: string[];
  tangentSpaceId: string | null;
  tangentRelationship: TandemRelationshipRecord | null;
  tangentTopics: TandemSpaceRoomSummary[];
  refresh: () => Promise<unknown>;
  refreshTangentTopics: () => Promise<unknown>;
  navigate: NavigateFunction;
}

export function useRoomPageActions({
  client,
  userId,
  roomId,
  currentRoom,
  isPendingRoom,
  isEncrypted,
  enablingEncryption,
  setEnablingEncryption,
  setActionError,
  setShowIdentityModal,
  setShowTopicNotificationModal,
  setShowLeaveConfirm,
  setShowArchiveConfirm,
  setShowDeleteTopicConfirm,
  setDeleteTopicNameInput,
  setDeletingTopic,
  setSavingIdentity,
  setCreatingTangent,
  setShowTangentModal,
  setTangentError,
  setMessageMenu,
  setOptimisticReactionChanges,
  canDeleteTopic,
  roomMembership,
  membershipPolicy,
  roomMeta,
  pinnedMessageIds,
  tangentSpaceId,
  tangentRelationship,
  tangentTopics,
  refresh,
  refreshTangentTopics,
  navigate,
}: UseRoomPageActionsParams) {
  const handleEnableEncryption = async () => {
    if (!client) {
      return;
    }

    setEnablingEncryption(true);
    setActionError(null);
    try {
      await (
        client.sendStateEvent as (
          nextRoomId: string,
          eventType: string,
          content: Record<string, unknown>,
          stateKey: string
        ) => Promise<unknown>
      )(roomId, 'm.room.encryption', { algorithm: 'm.megolm.v1.aes-sha2' }, '');
      await refresh();
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setEnablingEncryption(false);
    }
  };

  const handleDeleteMessage = async (message: RoomMessage) => {
    if (!client) {
      return;
    }

    setMessageMenu(null);
    try {
      await client.redactEvent(roomId, message.id);
      await refresh();
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleToggleReaction = async (message: RoomMessage, reactionKey: string) => {
    if (!client) {
      return;
    }

    setMessageMenu(null);
    const existingReaction = message.reactions?.find(
      (reaction) => reaction.key === reactionKey && reaction.isOwn
    );
    const nextReactionChange: OptimisticReactionChange = {
      targetMessageId: message.id,
      key: reactionKey,
      senderName: message.senderName,
      mode: existingReaction ? 'remove' : 'add',
    };
    setOptimisticReactionChanges((currentChanges) => {
      const withoutDuplicate = currentChanges.filter(
        (change) => !(change.targetMessageId === message.id && change.key === reactionKey)
      );
      return [...withoutDuplicate, nextReactionChange];
    });

    try {
      if (existingReaction?.ownEventId) {
        await client.redactEvent(roomId, existingReaction.ownEventId);
      } else {
        await (
          client.sendEvent as (
            nextRoomId: string,
            eventType: string,
            content: Record<string, unknown>,
            txnId?: string
          ) => Promise<unknown>
        )(roomId, 'm.reaction', {
          'm.relates_to': {
            event_id: message.id,
            key: reactionKey,
            rel_type: RelationType.Annotation,
          },
        });
      }
      await refresh();
    } catch (cause) {
      console.error(cause);
      setOptimisticReactionChanges((currentChanges) =>
        currentChanges.filter(
          (change) => !(change.targetMessageId === message.id && change.key === reactionKey)
        )
      );
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleTogglePinnedMessage = async (message: RoomMessage) => {
    if (!client) {
      return;
    }

    setMessageMenu(null);
    const nextPinned = pinnedMessageIds.includes(message.id)
      ? pinnedMessageIds.filter((id) => id !== message.id)
      : [...pinnedMessageIds, message.id];

    try {
      await (
        client.sendStateEvent as (
          nextRoomId: string,
          eventType: string,
          content: Record<string, unknown>,
          stateKey: string
        ) => Promise<unknown>
      )(roomId, 'm.room.pinned_events', { pinned: nextPinned }, '');
      await refresh();
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleUpdateRoomMeta = async (metaUpdate: Partial<TandemRoomMeta>) => {
    if (!client) {
      return;
    }

    try {
      await updateTandemRoomMeta(client, roomId, metaUpdate);
      await refresh();
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleDeleteTopic = async () => {
    if (!client || !currentRoom || !canDeleteTopic) {
      return;
    }

    setDeletingTopic(true);
    setActionError(null);
    try {
      await deleteTandemRoom(client, currentRoom);
      await refreshTangentTopics();
      navigate(tangentSpaceId ? `/tandem/space/${encodeURIComponent(tangentSpaceId)}` : '/other', {
        replace: true,
      });
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDeletingTopic(false);
      setShowDeleteTopicConfirm(false);
      setDeleteTopicNameInput('');
    }
  };

  const handleSaveTopicIdentity = async (values: {
    name: string;
    description: string;
    icon: string | null;
  }) => {
    if (!client || !currentRoom) {
      return;
    }

    setSavingIdentity(true);
    setActionError(null);
    try {
      await updateRoomIdentity(client, currentRoom, {
        name: values.name,
        topic: values.description,
        icon: values.icon,
      });
      setShowIdentityModal(false);
      await refresh();
      await refreshTangentTopics();
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleCreateTangent = async (name: string) => {
    if (!client || !userId || !tangentRelationship) {
      setTangentError('This topic is not inside a shared hub.');
      return;
    }

    setTangentError(null);
    setCreatingTangent(true);
    const nextPendingRoom = startPendingTandemRoomCreation({
      client,
      relationship: tangentRelationship,
      creatorUserId: userId,
      name,
    });
    setShowTangentModal(false);
    setCreatingTangent(false);
    navigate(`/room/${encodeURIComponent(nextPendingRoom.pendingRoomId)}`);
  };

  const handleSelectTopic = async (topicId: string) => {
    const topic = tangentTopics.find((entry) => entry.id === topicId);
    if (!client || !topic) {
      return;
    }

    setTangentError(null);
    setShowTangentModal(false);
    if (topic.membership !== 'join') {
      try {
        await joinTandemRoom(client, client.getRoom(topic.id));
        await refreshTangentTopics();
      } catch (cause) {
        console.error(cause);
        setTangentError(cause instanceof Error ? cause.message : String(cause));
        setShowTangentModal(true);
        return;
      }
    }

    navigate(`/room/${encodeURIComponent(topic.id)}`);
  };

  const handleBackNavigation = () => {
    if (tangentSpaceId) {
      navigate(`/tandem/space/${encodeURIComponent(tangentSpaceId)}`);
      return;
    }
    navigate(-1);
  };

  const handleJoinCurrentRoom = async () => {
    if (!client || !currentRoom) {
      return;
    }

    setActionError(null);
    try {
      await joinTandemRoom(client, currentRoom);
      await refresh();
      await refreshTangentTopics();
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleLeaveCurrentRoom = async () => {
    if (!client || !currentRoom) {
      return;
    }

    setActionError(null);
    try {
      await leaveTandemRoom(client, currentRoom);
      await refreshTangentTopics();
      navigate(tangentSpaceId ? `/tandem/space/${encodeURIComponent(tangentSpaceId)}` : '/other', {
        replace: true,
      });
    } catch (cause) {
      console.error(cause);
      setActionError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const conversationMenuButtons = [
    ...(!isEncrypted
      ? [
          {
            text: enablingEncryption ? 'Enabling encryption...' : 'Enable encryption',
            icon: lockClosedOutline,
            cssClass: 'app-action-primary',
            handler: () => {
              void handleEnableEncryption();
            },
          },
        ]
      : []),
    ...(!isPendingRoom
      ? [
          { text: 'Edit topic details', handler: () => setShowIdentityModal(true) },
          { text: 'Topic notifications', handler: () => setShowTopicNotificationModal(true) },
        ]
      : []),
    ...(membershipPolicy?.supportsLeave && roomMembership === 'join'
      ? [
          {
            text: 'Leave topic',
            cssClass: 'app-action-danger',
            handler: () => setShowLeaveConfirm(true),
          },
        ]
      : []),
    ...(canDeleteTopic
      ? [
          {
            text: 'Delete topic',
            icon: trashOutline,
            cssClass: 'app-action-danger',
            handler: () => {
              setDeleteTopicNameInput('');
              setShowDeleteTopicConfirm(true);
            },
          },
        ]
      : []),
    {
      text: roomMeta.archived ? 'Unarchive topic' : 'Archive topic',
      cssClass: 'app-action-danger',
      handler: () => {
        if (roomMeta.archived) {
          void handleUpdateRoomMeta({ archived: false });
          return;
        }
        setShowArchiveConfirm(true);
      },
    },
    { text: 'Cancel', role: 'cancel' as const },
  ];

  return {
    handleDeleteMessage,
    handleToggleReaction,
    handleTogglePinnedMessage,
    handleUpdateRoomMeta,
    handleDeleteTopic,
    handleSaveTopicIdentity,
    handleCreateTangent,
    handleSelectTopic,
    handleBackNavigation,
    handleJoinCurrentRoom,
    handleLeaveCurrentRoom,
    conversationMenuButtons,
  };
}
