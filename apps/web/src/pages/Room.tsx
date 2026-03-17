import { IonContent, IonFooter, IonPage } from '@ionic/react';
import { MsgType } from 'matrix-js-sdk';
import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthFallbackState, Button } from '../components';
import { MessageBubble } from '../components/chat';
import MessageActionMenu from '../components/chat/MessageActionMenu';
import { getEmojiQuery, getEmojiSuggestions } from '../lib/chat/emojis';
import { createMentionCandidate, getMentionQuery } from '../lib/chat/mentions';
import {
  applyOptimisticReactionChanges,
  mergeTimelineMessages,
  reconcileOptimisticReactionChanges,
  reconcileOptimisticTimeline,
  type OptimisticReactionChange,
  type OptimisticTimelineMessage,
} from '../lib/matrix/optimisticTimeline';
import { isPendingTandemRoomId } from '../lib/matrix/pendingTandemRoom';
import { findLatestOwnReadReceipt } from '../lib/matrix/readReceipts';
import { buildRoomSnapshot, type RoomSnapshot } from '../lib/matrix/roomSnapshot';
import {
  buildTandemSpaceRoomCatalog,
  type TandemSpaceRoomSummary,
} from '../lib/matrix/spaceCatalog';
import { getTandemMembershipPolicy, getTandemSpaceIdForRoom, type TandemRoomMeta } from '../lib/matrix/tandem';
import { formatTypingIndicator, TYPING_SERVER_TIMEOUT_MS } from '../lib/matrix/typingIndicators';
import { useChatPreferences } from '../hooks/useChatPreferences';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useTandem } from '../hooks/useTandem';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';
import RoomComposer from './room/RoomComposer';
import RoomDialogs from './room/RoomDialogs';
import RoomHeader from './room/RoomHeader';
import type { ComposerMode, QueuedImage, RoomMessage } from './room/types';
import { buildPendingRoomMessages, formatTimestamp } from './room/utils';
import { useRoomComposer } from './room/useRoomComposer';
import { useRoomPageActions } from './room/useRoomPageActions';
import { useRoomRealtime } from './room/useRoomRealtime';
import { useRoomScrollState } from './room/useRoomScrollState';

function RoomPage() {
  const { roomId: encodedRoomId } = useParams<{ roomId: string }>();
  const roomId = encodedRoomId ? decodeURIComponent(encodedRoomId) : null;
  const isPendingRoom = Boolean(roomId && isPendingTandemRoomId(roomId));
  const navigate = useNavigate();
  const { client, isReady, state, user, bootstrapUserId } = useMatrixClient();
  const cacheUserId = user?.userId ?? bootstrapUserId;
  const {
    preferences,
    updateRoomNotificationMode,
    resolveRoomNotificationMode,
  } = useChatPreferences(client, cacheUserId);
  const { relationships } = useTandem(client, cacheUserId);

  const cacheKey =
    !isPendingRoom && cacheUserId && roomId
      ? `room:${cacheUserId}:${roomId}`
      : null;
  const {
    data: snapshot,
    error,
    isLoading: loading,
    refresh,
    hasCachedData,
  } = usePersistedResource<RoomSnapshot>({
    cacheKey,
    enabled: Boolean(client && user && roomId && !isPendingRoom),
    initialValue: {
      roomName: 'Conversation',
      roomDescription: null,
      roomIcon: null,
      roomSubtitle: 'Connecting...',
      messages: [],
      isEncrypted: false,
      roomMeta: {},
    },
    load: async () => {
      const room = client?.getRoom(roomId ?? undefined);
      if (!room || !client || !user) {
        throw new Error('Conversation not found');
      }

      return buildRoomSnapshot(client, room, user.userId);
    },
  });

  const [draft, setDraft] = useState('');
  const [queuedImage, setQueuedImage] = useState<QueuedImage>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [enablingEncryption, setEnablingEncryption] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showTopicNotificationModal, setShowTopicNotificationModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQueuedImagePreview, setShowQueuedImagePreview] = useState(false);
  const [selectedEmojiSuggestionIndex, setSelectedEmojiSuggestionIndex] = useState(0);
  const [showDeleteTopicConfirm, setShowDeleteTopicConfirm] = useState(false);
  const [deleteTopicNameInput, setDeleteTopicNameInput] = useState('');
  const [deletingTopic, setDeletingTopic] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTangentModal, setShowTangentModal] = useState(false);
  const [creatingTangent, setCreatingTangent] = useState(false);
  const [tangentError, setTangentError] = useState<string | null>(null);
  const [messageMenu, setMessageMenu] = useState<{
    message: RoomMessage;
    position: { x: number; y: number };
  } | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticTimelineMessage[]>([]);
  const [optimisticReactionChanges, setOptimisticReactionChanges] = useState<OptimisticReactionChange[]>([]);

  const contentRef = useRef<HTMLIonContentElement>(null);
  const composerRef = useRef<HTMLIonTextareaElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const outgoingTypingRef = useRef(false);
  const lastTypingSentAtRef = useRef(0);
  const typingIdleTimeoutRef = useRef<number | null>(null);
  const lastReadReceiptEventIdRef = useRef<string | null>(null);
  const scrollToLatest = useCallback((duration = 250) => {
    window.requestAnimationFrame(() => {
      void contentRef.current?.scrollToBottom(duration);
    });
  }, []);

  const currentRoom = client?.getRoom(roomId ?? undefined) ?? null;
  const mentionCandidates =
    currentRoom && user
      ? currentRoom
          .getMembers()
          .filter((member) => member.membership === 'join' && member.userId !== user.userId)
          .map((member) =>
            createMentionCandidate(member.userId, member.name || member.rawDisplayName || member.userId)
          )
      : [];
  const mentionQuery = getMentionQuery(draft);
  const emojiQuery = getEmojiQuery(draft);
  const emojiSuggestions = getEmojiSuggestions(emojiQuery);
  const roomMembership = currentRoom?.getMyMembership() ?? 'join';
  const membershipPolicy =
    !isPendingRoom && client && currentRoom ? getTandemMembershipPolicy(client, currentRoom) : null;
  const isLiveSession = Boolean(client && user && isReady);
  const canRenderCachedRoom =
    !isPendingRoom &&
    state === 'syncing' &&
    Boolean(cacheUserId) &&
    hasCachedData;
  const canInteractWithTimeline =
    isLiveSession &&
    (isPendingRoom || !membershipPolicy || roomMembership === 'join');
  const canDeleteTopic = membershipPolicy?.roomKind === 'tandem-child-room';
  const tangentSpaceId = isPendingRoom
    ? null
    : client
      ? getTandemSpaceIdForRoom(client, currentRoom)
      : null;
  const tangentRelationship =
    relationships.find((entry) => entry.sharedSpaceId === tangentSpaceId) ?? null;

  const { data: tangentTopics, refresh: refreshTangentTopics } =
    usePersistedResource<TandemSpaceRoomSummary[]>({
      cacheKey:
        cacheUserId && tangentSpaceId
          ? `space-rooms:${cacheUserId}:${tangentSpaceId}`
          : null,
      enabled: Boolean(client && user && isReady && tangentSpaceId),
      initialValue: [],
      load: async () => buildTandemSpaceRoomCatalog(client!, user!.userId, tangentSpaceId!),
    });

  const { pendingRoom, typingMemberNames } = useRoomRealtime({
    client,
    user,
    roomId,
    isReady,
    isPendingRoom,
    currentRoom,
    snapshot,
    refresh,
    refreshTangentTopics,
    canInteractWithTimeline,
    tangentRelationship,
    tangentSpaceId,
    draft,
    contentRef,
    composerRef,
    scrollToLatest,
    outgoingTypingRef,
    lastTypingSentAtRef,
    typingIdleTimeoutRef,
    lastReadReceiptEventIdRef,
    setOptimisticMessages,
    setOptimisticReactionChanges,
    reconcileOptimisticTimeline,
    reconcileOptimisticReactionChanges,
    navigate,
  });

  const clearOwnTypingState = () => {
    if (typingIdleTimeoutRef.current !== null) {
      window.clearTimeout(typingIdleTimeoutRef.current);
      typingIdleTimeoutRef.current = null;
    }

    if (!outgoingTypingRef.current || !client || !roomId) {
      return;
    }

    outgoingTypingRef.current = false;
    lastTypingSentAtRef.current = 0;
    void client.sendTyping(roomId, false, TYPING_SERVER_TIMEOUT_MS).catch((cause: unknown) => {
      console.error('Failed to clear typing state', cause);
    });
  };

  const {
    handleSendMessage,
    handleAttachmentSelection,
    handleComposerKeyDown,
    handleDraftInput,
    handleRetryMessage,
    handleReplyToMessage,
    handleEditMessage,
    handleCancelComposerContext,
    handleRemoveQueuedImage,
    handleInsertEmoji,
    setSelectedEmojiSuggestionIndex: setEmojiHighlight,
  } = useRoomComposer({
    client,
    userId: user?.userId,
    roomId: roomId ?? '',
    isPendingRoom,
    canInteractWithTimeline,
    draft,
    setDraft,
    queuedImage,
    setQueuedImage,
    setShowQueuedImagePreview,
    setUploadingAttachment,
    setActionError,
    composerMode,
    setComposerMode,
    showEmojiPicker,
    setShowEmojiPicker,
    selectedEmojiSuggestionIndex,
    setSelectedEmojiSuggestionIndex,
    emojiQuery,
    emojiSuggestions,
    mentionCandidates,
    optimisticMessages,
    setOptimisticMessages,
    refresh,
    scrollToLatest,
    composerRef,
    emojiPickerRef,
    clearOwnTypingState,
  });

  const pendingSnapshot = pendingRoom
    ? {
        roomName: pendingRoom.roomName,
        roomDescription: pendingRoom.topic ?? null,
        roomIcon: null,
        roomSubtitle:
          pendingRoom.status === 'failed' ? 'Topic setup ran into a problem' : 'Setting up your new topic...',
        messages: buildPendingRoomMessages(pendingRoom),
        isEncrypted: false,
        roomMeta: {} as TandemRoomMeta,
      }
    : null;
  const activeSnapshot = pendingSnapshot ?? snapshot;
  const { roomName, roomDescription, roomIcon, roomSubtitle, messages, isEncrypted, roomMeta } =
    activeSnapshot;
  const visibleMessages = applyOptimisticReactionChanges(
    mergeTimelineMessages(messages, reconcileOptimisticTimeline(messages, optimisticMessages)),
    optimisticReactionChanges
  );
  const { showJumpToLatest } = useRoomScrollState({
    roomId,
    contentRef,
    messageKeys: visibleMessages.map((message) => message.id),
  });
  const visibleError = pendingRoom?.status === 'failed' ? pendingRoom.error ?? actionError : actionError ?? error;
  const typingIndicator = formatTypingIndicator(typingMemberNames);
  const pinnedMessageIds =
    currentRoom?.currentState.getStateEvents('m.room.pinned_events', '')?.getContent<{ pinned?: string[] }>()
      .pinned ?? [];
  const latestOwnReadReceipt = findLatestOwnReadReceipt(visibleMessages);
  const readReceiptMessageId = latestOwnReadReceipt?.messageId ?? null;
  const readReceiptNames = latestOwnReadReceipt?.readerNames ?? [];
  const mentionSuggestions =
    emojiQuery === null && mentionQuery && mentionCandidates.length > 0
      ? mentionCandidates.filter((candidate) =>
          candidate.token.toLowerCase().startsWith(mentionQuery.toLowerCase())
        )
      : [];
  const {
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
  } = useRoomPageActions({
    client,
    userId: user?.userId,
    roomId: roomId ?? '',
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
  });

  if (!roomId) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <div className="flex min-h-screen items-center justify-center text-text">No conversation selected.</div>
        </IonContent>
      </IonPage>
    );
  }

  if (!isLiveSession && !canRenderCachedRoom) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <AuthFallbackState
            state={state}
            signedOutMessage={
              <>
                Please{' '}
                <Link to="/login" className="text-accent">
                  log in
                </Link>{' '}
                to view this chat.
              </>
            }
          />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage className="app-shell">
      <RoomHeader
        roomName={roomName}
        roomDescription={roomDescription}
        roomIcon={roomIcon}
        roomSubtitle={roomSubtitle}
        typingIndicator={typingIndicator}
        isEncrypted={isEncrypted}
        isPendingRoom={isPendingRoom}
        tangentSpaceId={tangentSpaceId}
        onBack={handleBackNavigation}
        onEditTopic={() => {
          if (isLiveSession) {
            setShowIdentityModal(true);
          }
        }}
        onSearch={() => navigate('/search')}
        onCreateTopic={() => {
          if (isLiveSession) {
            setShowTangentModal(true);
          }
        }}
        onOpenMenu={() => {
          if (isLiveSession) {
            setShowMenu(true);
          }
        }}
      />

      <IonContent ref={contentRef} fullscreen className="app-chat-page">
        <div className="px-4 pb-4 pt-6">
          {isPendingRoom ? (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="app-chat-bubble other">
                  <div className="mb-1 text-[11px] font-medium text-text-subtle">{message.senderId}</div>
                  <div>{message.body}</div>
                  <div className="mt-2 text-right text-[11px] text-text-subtle">
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className="py-12 text-center text-sm text-text-muted">Loading messages...</div>
          ) : visibleError && messages.length === 0 ? (
            <div className="py-6 text-center text-sm text-danger">{visibleError}</div>
          ) : membershipPolicy && roomMembership !== 'join' ? (
            <div className="space-y-4">
              <div className="rounded-[28px] border border-line bg-panel/95 px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                {membershipPolicy.supportsJoin ? (
                  <Button onClick={() => void handleJoinCurrentRoom()}>Join topic</Button>
                ) : (
                  <div className="text-sm text-text-muted">Unavailable</div>
                )}
              </div>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-base font-medium text-text">No messages yet</p>
              <p className="mt-2 text-sm text-text-muted">Start the topic below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleError ? <div className="py-2 text-center text-sm text-danger">{visibleError}</div> : null}
              {visibleMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  accessToken={client?.getAccessToken() ?? null}
                  viewMode={preferences.chatViewMode}
                  onRetry={isLiveSession ? handleRetryMessage : undefined}
                  onToggleReaction={
                    isLiveSession
                      ? (targetMessage, reactionKey) => {
                          void handleToggleReaction(targetMessage, reactionKey);
                        }
                      : undefined
                  }
                  onRequestActions={
                    !isLiveSession || message.id.startsWith('local:')
                      ? undefined
                      : (nextMessage, position) => {
                          setMessageMenu({ message: nextMessage, position });
                        }
                  }
                  mentionTargets={mentionCandidates}
                  receiptNames={message.id === readReceiptMessageId ? readReceiptNames : null}
                />
              ))}
            </div>
          )}
        </div>
      </IonContent>

      {showJumpToLatest ? (
        <button
          type="button"
          className="fixed bottom-28 right-4 z-20 rounded-full bg-white px-4 py-2 text-sm font-medium text-text shadow-[0_18px_40px_-24px_rgba(15,23,42,0.38)]"
          onClick={() => scrollToLatest()}
        >
          New messages
        </button>
      ) : null}

      <IonFooter className="app-chat-footer ion-no-border">
        <RoomComposer
          isPendingRoom={isPendingRoom}
          canInteractWithTimeline={canInteractWithTimeline}
          uploadingAttachment={uploadingAttachment}
          draft={draft}
          queuedImage={queuedImage}
          composerMode={composerMode}
          mentionSuggestions={mentionSuggestions}
          emojiSuggestions={emojiSuggestions}
          selectedEmojiSuggestionIndex={selectedEmojiSuggestionIndex}
          showEmojiPicker={showEmojiPicker}
          attachmentInputRef={attachmentInputRef}
          composerRef={composerRef}
          emojiPickerRef={emojiPickerRef}
          onAttachmentSelection={handleAttachmentSelection}
          onToggleEmojiPicker={() => setShowEmojiPicker((current) => !current)}
          onDraftInput={handleDraftInput}
          onComposerKeyDown={handleComposerKeyDown}
          onSend={() => {
            void handleSendMessage();
          }}
          onCancelComposerContext={handleCancelComposerContext}
          onRemoveQueuedImage={handleRemoveQueuedImage}
          onInsertEmoji={handleInsertEmoji}
          onHighlightEmoji={setEmojiHighlight}
          onOpenQueuedImagePreview={() => setShowQueuedImagePreview(true)}
          setDraft={setDraft}
        />
      </IonFooter>

      {showQueuedImagePreview && queuedImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Queued image preview"
        >
          <button
            type="button"
            className="absolute inset-0 bg-text/45"
            onClick={() => setShowQueuedImagePreview(false)}
            aria-label="Close image preview"
          />
          <div className="relative">
            <img
              src={queuedImage.previewUrl}
              alt={queuedImage.file.name}
              className="max-h-[70vh] min-h-[50vh] w-auto max-w-full rounded-[28px] object-contain shadow-[0_28px_80px_-36px_rgba(15,23,42,0.45)]"
            />
          </div>
        </div>
      ) : null}

      {messageMenu ? (
        <MessageActionMenu
          message={messageMenu.message}
          position={messageMenu.position}
          canEdit={
            messageMenu.message.isOwn &&
            !messageMenu.message.isDeleted &&
            (messageMenu.message.msgtype === MsgType.Text || messageMenu.message.msgtype === MsgType.Emote)
          }
          isPinned={pinnedMessageIds.includes(messageMenu.message.id)}
          onClose={() => setMessageMenu(null)}
          onReply={() => handleReplyToMessage(messageMenu.message)}
          onEdit={
            messageMenu.message.isOwn ? () => handleEditMessage(messageMenu.message) : undefined
          }
          onDelete={
            messageMenu.message.isOwn && !messageMenu.message.isDeleted
              ? () => {
                  void handleDeleteMessage(messageMenu.message);
                }
              : undefined
          }
          onPin={() => {
            void handleTogglePinnedMessage(messageMenu.message);
          }}
          onReact={(emoji) => {
            void handleToggleReaction(messageMenu.message, emoji);
          }}
        />
      ) : null}

      <RoomDialogs
        roomId={roomId}
        roomName={roomName}
        roomDescription={roomDescription}
        currentRoom={currentRoom}
        actionError={actionError}
        preferences={preferences}
        resolveRoomNotificationMode={resolveRoomNotificationMode}
        updateRoomNotificationMode={updateRoomNotificationMode}
        tangentTopics={tangentTopics}
        conversationMenuButtons={conversationMenuButtons}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        showIdentityModal={showIdentityModal}
        setShowIdentityModal={setShowIdentityModal}
        showTopicNotificationModal={showTopicNotificationModal}
        setShowTopicNotificationModal={setShowTopicNotificationModal}
        showArchiveConfirm={showArchiveConfirm}
        setShowArchiveConfirm={setShowArchiveConfirm}
        showLeaveConfirm={showLeaveConfirm}
        setShowLeaveConfirm={setShowLeaveConfirm}
        showDeleteTopicConfirm={showDeleteTopicConfirm}
        setShowDeleteTopicConfirm={setShowDeleteTopicConfirm}
        deleteTopicNameInput={deleteTopicNameInput}
        setDeleteTopicNameInput={setDeleteTopicNameInput}
        deletingTopic={deletingTopic}
        showTangentModal={showTangentModal}
        setShowTangentModal={setShowTangentModal}
        creatingTangent={creatingTangent}
        tangentError={tangentError}
        setTangentError={setTangentError}
        savingIdentity={savingIdentity}
        onSaveTopicIdentity={async (values) => {
          await handleSaveTopicIdentity(values);
        }}
        onArchiveTopic={() => {
          setShowArchiveConfirm(false);
          void handleUpdateRoomMeta({ archived: true });
        }}
        onLeaveTopic={() => {
          setShowLeaveConfirm(false);
          void handleLeaveCurrentRoom();
        }}
        onDeleteTopic={() => {
          void handleDeleteTopic();
        }}
        onSelectTopic={(topicId) => {
          void handleSelectTopic(topicId);
        }}
        onCreateTopic={(name) => {
          void handleCreateTangent(name);
        }}
      />
    </IonPage>
  );
}

export default RoomPage;
