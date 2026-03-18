import { IonContent, IonFooter, IonPage } from '@ionic/react';
import { MsgType } from 'matrix-js-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthFallbackState, Button } from '../components';
import MessageActionMenu from '../components/chat/MessageActionMenu';
import { createMentionCandidate } from '../lib/chat/mentions';
import { cn } from '../lib/cn';
import { shouldSuppressMissingRoomError } from '../lib/matrix/restoreErrors';
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
import {
  hasMoreRoomHistoryBack,
  paginateRoomHistoryBack,
} from '../lib/matrix/roomHistory';
import { sendTypingState } from '../lib/matrix/typingState';
import {
  buildRoomSnapshot,
  type RoomSnapshot,
} from '../lib/matrix/roomSnapshot';
import {
  buildTandemSpaceRoomCatalog,
  type TandemSpaceRoomSummary,
} from '../lib/matrix/spaceCatalog';
import {
  getTandemMembershipPolicy,
  getTandemSpaceIdForRoom,
  type TandemRoomMeta,
} from '../lib/matrix/tandem';
import {
  formatTypingIndicator,
  TYPING_SERVER_TIMEOUT_MS,
} from '../lib/matrix/typingIndicators';
import { useChatPreferences } from '../hooks/useChatPreferences';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useTandem } from '../hooks/useTandem';
import { useCurrentUserProfileSummary } from '../hooks/useCurrentUserProfileSummary';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';
import { loadDesktopLastSelection } from '../lib/desktopShell';
import DesktopRailHeader from './room/DesktopRailHeader';
import DesktopRoomPanel from './room/DesktopRoomPanel';
import KeyboardShortcutsOverlay from './room/KeyboardShortcutsOverlay';
import RoomComposer from './room/RoomComposer';
import DesktopTopicSidebar from './room/DesktopTopicSidebar';
import RoomDialogs from './room/RoomDialogs';
import RoomHeader from './room/RoomHeader';
import ThreadTimeline from './room/ThreadTimeline';
import TimelineMessageList from './room/TimelineMessageList';
import type { RoomMessage } from './room/types';
import { buildPendingRoomMessages, formatTimestamp } from './room/utils';
import { useDesktopRoomShell } from './room/useDesktopRoomShell';
import { useDesktopRoomShortcuts } from './room/useDesktopRoomShortcuts';
import { useRoomComposer } from './room/useRoomComposer';
import { useRoomComposerState } from './room/useRoomComposerState';
import { useRoomPageActions } from './room/useRoomPageActions';
import { useRoomRealtime } from './room/useRoomRealtime';
import { useRoomScrollState } from './room/useRoomScrollState';
import { useThreadComposerFocus } from './room/useThreadComposerFocus';

function RoomPage() {
  const { roomId: encodedRoomId, threadRootId: encodedThreadRootId } =
    useParams<{ roomId: string; threadRootId?: string }>();
  const roomId = encodedRoomId ? decodeURIComponent(encodedRoomId) : null;
  const threadRootId = encodedThreadRootId
    ? decodeURIComponent(encodedThreadRootId)
    : null;
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
  const isDesktopLayout = useMediaQuery('(min-width: 1280px)');

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
      roomAvatarUrl: null,
      roomSubtitle: 'Connecting...',
      messages: [],
      threads: [],
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

  const [enablingEncryption, setEnablingEncryption] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showTopicNotificationModal, setShowTopicNotificationModal] =
    useState(false);
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
    scope: 'room' | 'thread';
  } | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<
    OptimisticTimelineMessage[]
  >([]);
  const [optimisticReactionChanges, setOptimisticReactionChanges] = useState<
    OptimisticReactionChange[]
  >([]);
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const threadTimelineScrollRef = useRef<HTMLDivElement>(null);
  const outgoingTypingRef = useRef(false);
  const lastTypingSentAtRef = useRef(0);
  const typingRateLimitUntilRef = useRef(0);
  const typingIdleTimeoutRef = useRef<number | null>(null);
  const lastReadReceiptEventIdRef = useRef<string | null>(null);

  const currentRoom = client?.getRoom(roomId ?? undefined) ?? null;
  const mentionCandidates =
    currentRoom && user
      ? currentRoom
          .getMembers()
          .filter(
            (member) =>
              member.membership === 'join' && member.userId !== user.userId
          )
          .map((member) =>
            createMentionCandidate(
              member.userId,
              member.name || member.rawDisplayName || member.userId
            )
          )
      : [];
  const roomMembership = currentRoom?.getMyMembership() ?? 'join';
  const membershipPolicy =
    !isPendingRoom && client && currentRoom
      ? getTandemMembershipPolicy(client, currentRoom)
      : null;
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
  const liveTangentSpaceId = isPendingRoom
    ? null
    : client
      ? getTandemSpaceIdForRoom(client, currentRoom)
      : null;
  const persistedDesktopSelection = loadDesktopLastSelection(
    user?.userId ?? bootstrapUserId
  );
  const tangentSpaceId =
    liveTangentSpaceId ??
    (persistedDesktopSelection.lastRoomId === roomId
      ? persistedDesktopSelection.lastHubId
      : null);
  const tangentRelationship =
    relationships.find((entry) => entry.sharedSpaceId === tangentSpaceId) ??
    null;
  const currentUserProfile = useCurrentUserProfileSummary(
    client,
    user?.userId ?? bootstrapUserId,
    64
  );
  const currentUserName = currentUserProfile.name;
  const currentUserAvatarUrl = currentUserProfile.avatarUrl;

  const { data: tangentTopics, refresh: refreshTangentTopics } =
    usePersistedResource<TandemSpaceRoomSummary[]>({
      cacheKey:
        cacheUserId && tangentSpaceId
          ? `space-rooms:${cacheUserId}:${tangentSpaceId}`
          : null,
      enabled: Boolean(client && user && isReady && tangentSpaceId),
      initialValue: [],
      load: async () =>
        buildTandemSpaceRoomCatalog(client!, user!.userId, tangentSpaceId!),
    });
  const showDesktopSidebar =
    isDesktopLayout &&
    Boolean(tangentSpaceId) &&
    !isPendingRoom;
  const {
    desktopRailView,
    setDesktopRailView,
    desktopSettingsSection,
    navigateDesktopSettingsSection,
    desktopRailSearchQuery,
    setDesktopRailSearchQuery,
    showDesktopRailMenu,
    setShowDesktopRailMenu,
    desktopRoomPanelView,
    desktopThreadRootId,
    setDesktopRoomPanelView,
    desktopRailWidth,
    desktopRoomPanelWidth,
    isResizingDesktopRail,
    isResizingDesktopRoomPanel,
    setIsResizingDesktopRail,
    setIsResizingDesktopRoomPanel,
    openDesktopContacts,
    openDesktopAddContact,
    openDesktopHubs,
    openDesktopOtherRooms,
    openDesktopSettings,
    closeDesktopRailMenu,
    handleDesktopRailBack,
    stepBackDesktopRail,
    openDesktopEditPanel,
    openDesktopPinsPanel,
    openDesktopSearchPanel,
    openDesktopDetailsPanel,
    openDesktopThreadPanel,
    closeDesktopRoomPanel,
    backToDesktopRoomDetails,
    stepBackOrCloseDesktopRoomPanel,
  } = useDesktopRoomShell({
    isDesktopLayout,
    showDesktopSidebar,
    roomId,
    tangentSpaceId,
    userId: user?.userId,
    bootstrapUserId,
  });
  const showDesktopRailBody =
    isDesktopLayout &&
    !isPendingRoom &&
    (Boolean(tangentSpaceId) || desktopRailView !== 'topics');
  const showDesktopRoomPanel =
    isDesktopLayout && desktopRoomPanelView !== null;
  const useDesktopSplitLayout = showDesktopRailBody || showDesktopRoomPanel;
  const mobileThreadRootId = isDesktopLayout ? null : threadRootId;
  const panelThreadRootId =
    isDesktopLayout && desktopRoomPanelView === 'thread'
      ? desktopThreadRootId
      : null;
  const activeThreadRootId = panelThreadRootId ?? mobileThreadRootId;
  const isThreadRouteActive = mobileThreadRootId !== null;
  const isDesktopThreadPanelOpen = panelThreadRootId !== null;
  const desktopHeaderWidth = showDesktopRailBody
    ? desktopRailWidth
    : isDesktopLayout
      ? 72
      : 0;
  const openPinnedMessagesPath = `/room/${encodeURIComponent(roomId ?? '')}/pinned`;
  const openSearchPath = `/room/${encodeURIComponent(roomId ?? '')}/search`;
  const openRoomPath = `/room/${encodeURIComponent(roomId ?? '')}`;

  useDesktopRoomShortcuts({
    context: {
      isDesktopActive: isDesktopLayout && !isPendingRoom,
      showShortcutOverlay,
      showDesktopRailMenu,
      desktopRailView,
      desktopSettingsSection,
      desktopRoomPanelView,
      openShortcutOverlay: () => setShowShortcutOverlay(true),
      closeShortcutOverlay: () => setShowShortcutOverlay(false),
      openDesktopSettingsRoot: openDesktopSettings,
      closeDesktopRailMenu,
      stepBackDesktopRail,
      stepBackOrCloseDesktopRoomPanel,
    },
  });

  const scrollToLatest = useCallback((duration = 250) => {
    window.requestAnimationFrame(() => {
      const timelineScrollHost = timelineScrollRef.current;
      if (useDesktopSplitLayout && timelineScrollHost) {
        timelineScrollHost.scrollTo({
          top: timelineScrollHost.scrollHeight,
          behavior: duration === 0 ? 'auto' : 'smooth',
        });
        return;
      }

      void contentRef.current?.scrollToBottom(duration);
    });
  }, [useDesktopSplitLayout]);
  const scrollThreadPanelToLatest = useCallback((duration = 250) => {
    window.requestAnimationFrame(() => {
      const threadTimelineScrollHost = threadTimelineScrollRef.current;
      if (!threadTimelineScrollHost) {
        return;
      }

      threadTimelineScrollHost.scrollTo({
        top: threadTimelineScrollHost.scrollHeight,
        behavior: duration === 0 ? 'auto' : 'smooth',
      });
    });
  }, []);
  const mainComposerState = useRoomComposerState({
    mentionCandidates,
  });
  const threadComposerState = useRoomComposerState({
    mentionCandidates,
    resetKey: activeThreadRootId,
  });
  const activeTypingDraft =
    mainComposerState.draft || threadComposerState.draft;
  const activeFooterComposerRef = isThreadRouteActive
    ? threadComposerState.composerRef
    : mainComposerState.composerRef;

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
    draft: activeTypingDraft,
    contentRef,
    composerRef: activeFooterComposerRef,
    scrollToLatest,
    outgoingTypingRef,
    lastTypingSentAtRef,
    typingRateLimitUntilRef,
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
    void sendTypingState({
      client,
      roomId,
      isTyping: false,
      timeoutMs: TYPING_SERVER_TIMEOUT_MS,
      typingRateLimitUntilRef,
      onError: (cause: unknown) => {
        console.error('Failed to clear typing state', cause);
      },
    });
  };

  const pendingSnapshot = pendingRoom
    ? {
        roomName: pendingRoom.roomName,
        roomDescription: pendingRoom.topic ?? null,
        roomIcon: null,
        roomAvatarUrl: null,
        roomSubtitle:
          pendingRoom.status === 'failed'
            ? 'Topic setup ran into a problem'
            : 'Setting up your new topic...',
        messages: buildPendingRoomMessages(pendingRoom),
        threads: [],
        isEncrypted: false,
        roomMeta: {} as TandemRoomMeta,
      }
    : null;
  const activeSnapshot = pendingSnapshot ?? snapshot;
  const roomName = activeSnapshot.roomName;
  const roomDescription = activeSnapshot.roomDescription;
  const roomIcon = activeSnapshot.roomIcon;
  const roomAvatarUrl = activeSnapshot.roomAvatarUrl;
  const roomSubtitle = activeSnapshot.roomSubtitle;
  const messages = activeSnapshot.messages ?? [];
  const threads = activeSnapshot.threads ?? [];
  const isEncrypted = activeSnapshot.isEncrypted;
  const roomMeta = activeSnapshot.roomMeta ?? ({} as TandemRoomMeta);
  const visibleMainMessages = applyOptimisticReactionChanges(
    mergeTimelineMessages(
      messages,
      reconcileOptimisticTimeline(
        messages,
        optimisticMessages.filter((message) => !message.threadRootId)
      )
    ),
    optimisticReactionChanges
  );
  const activeThreadSnapshot = activeThreadRootId
    ? threads.find((thread) => thread.rootMessageId === activeThreadRootId) ??
      (() => {
        const rootMessage =
          messages.find((message) => message.id === activeThreadRootId) ?? null;

        if (!rootMessage) {
          return null;
        }

        return {
          rootMessageId: activeThreadRootId,
          rootMessage,
          replies: [],
          replyCount: 0,
          latestReply: null,
          hasCurrentUserParticipated: false,
        };
      })()
    : null;
  const visibleThreadMessages = activeThreadSnapshot
    ? applyOptimisticReactionChanges(
        [
          ...(activeThreadSnapshot.rootMessage
            ? [activeThreadSnapshot.rootMessage]
            : []),
          ...mergeTimelineMessages(
            activeThreadSnapshot.replies,
            reconcileOptimisticTimeline(
              activeThreadSnapshot.replies,
              optimisticMessages.filter(
                (message) =>
                  message.threadRootId === activeThreadSnapshot.rootMessageId
              )
            )
          ),
        ],
        optimisticReactionChanges
      )
    : [];
  const activeThreadRootMessage =
    activeThreadSnapshot?.rootMessage
      ? (visibleThreadMessages[0] ?? activeThreadSnapshot.rootMessage)
      : null;
  const activeThreadReplies = activeThreadRootMessage
    ? visibleThreadMessages.slice(1)
    : visibleThreadMessages;
  const activeThreadMessages =
    activeThreadRootId && activeThreadSnapshot
      ? [
          ...(activeThreadRootMessage ? [activeThreadRootMessage] : []),
          ...activeThreadReplies,
        ]
      : [];
  const visibleMessages =
    isThreadRouteActive
      ? activeThreadMessages
      : visibleMainMessages;
  const canLoadOlderMainTimeline =
    !isThreadRouteActive &&
    currentRoom !== null &&
    hasMoreRoomHistoryBack(currentRoom);
  const loadOlderMainTimeline = useCallback(async () => {
    if (!client || !currentRoom || isThreadRouteActive) {
      return;
    }

    setActionError(null);
    setLoadingOlderMessages(true);

    try {
      const { didPaginate } = await paginateRoomHistoryBack(client, currentRoom);

      if (didPaginate) {
        await refresh();
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [client, currentRoom, isThreadRouteActive, refresh]);
  const threadSummariesByRootId = new Map(
    threads
      .filter((thread) => thread.replyCount > 0)
      .map((thread) => [
        thread.rootMessageId,
        {
          replyCount: thread.replyCount,
          latestReply: thread.latestReply,
        },
      ] as const)
  );
  const { showJumpToLatest } = useRoomScrollState({
    roomId,
    contentRef,
    scrollElementRef: useDesktopSplitLayout
      ? timelineScrollRef
      : undefined,
    messageKeys: visibleMessages.map((message) => message.id),
    scrollToLatest,
    canLoadOlderMessages: canLoadOlderMainTimeline,
    isLoadingOlderMessages: loadingOlderMessages,
    onLoadOlderMessages: loadOlderMainTimeline,
  });
  const visibleError =
    pendingRoom?.status === 'failed'
      ? (pendingRoom.error ?? actionError)
      : (actionError ?? error);
  const suppressMissingRoomError = shouldSuppressMissingRoomError({
    error: visibleError,
    hasCachedData,
    hasLiveRoom: Boolean(currentRoom),
    isLoading: loading,
    isAuthRestoring: state === 'syncing',
  });
  const displayError = suppressMissingRoomError ? null : visibleError;
  const typingIndicator = formatTypingIndicator(typingMemberNames);
  const pinnedMessageIds =
    currentRoom?.currentState
      .getStateEvents('m.room.pinned_events', '')
      ?.getContent<{ pinned?: string[] }>().pinned ?? [];
  const latestOwnMainReadReceipt = findLatestOwnReadReceipt(visibleMainMessages);
  const mainReadReceiptMessageId = latestOwnMainReadReceipt?.messageId ?? null;
  const mainReadReceiptNames = latestOwnMainReadReceipt?.readerNames ?? [];
  const latestOwnThreadReadReceipt = activeThreadMessages.length
    ? findLatestOwnReadReceipt(activeThreadMessages)
    : null;
  const threadReadReceiptMessageId =
    latestOwnThreadReadReceipt?.messageId ?? null;
  const threadReadReceiptNames = latestOwnThreadReadReceipt?.readerNames ?? [];
  const activeThreadContextMessage = activeThreadRootMessage;
  const requestThreadComposerFocus = useThreadComposerFocus({
    composerRef: threadComposerState.composerRef,
    threadContextMessage: activeThreadContextMessage,
    canInteractWithTimeline,
  });
  const openThread = useCallback(
    (rootMessageId: string) => {
      requestThreadComposerFocus();
      if (isDesktopLayout) {
        openDesktopThreadPanel(rootMessageId);
        return;
      }

      navigate(
        `/room/${encodeURIComponent(roomId ?? '')}/thread/${encodeURIComponent(
          rootMessageId
        )}`
      );
    },
    [
      isDesktopLayout,
      navigate,
      openDesktopThreadPanel,
      requestThreadComposerFocus,
      roomId,
    ]
  );

  useEffect(() => {
    if (!isDesktopLayout || !threadRootId) {
      return;
    }

    requestThreadComposerFocus();
    openDesktopThreadPanel(threadRootId);
    navigate(openRoomPath, { replace: true });
  }, [
    isDesktopLayout,
    navigate,
    openDesktopThreadPanel,
    openRoomPath,
    requestThreadComposerFocus,
    threadRootId,
  ]);
  const mainComposer = useRoomComposer({
    client,
    userId: user?.userId,
    roomId: roomId ?? '',
    isPendingRoom,
    canInteractWithTimeline,
    uploadingAttachment: mainComposerState.uploadingAttachment,
    draft: mainComposerState.draft,
    setDraft: mainComposerState.setDraft,
    queuedImage: mainComposerState.queuedImage,
    setQueuedImage: mainComposerState.setQueuedImage,
    threadContextMessage: null,
    setShowQueuedImagePreview: mainComposerState.setShowQueuedImagePreview,
    setUploadingAttachment: mainComposerState.setUploadingAttachment,
    setActionError,
    composerMode: mainComposerState.composerMode,
    setComposerMode: mainComposerState.setComposerMode,
    showEmojiPicker: mainComposerState.showEmojiPicker,
    setShowEmojiPicker: mainComposerState.setShowEmojiPicker,
    selectedEmojiSuggestionIndex:
      mainComposerState.selectedEmojiSuggestionIndex,
    setSelectedEmojiSuggestionIndex:
      mainComposerState.setSelectedEmojiSuggestionIndex,
    emojiQuery: mainComposerState.emojiQuery,
    emojiSuggestions: mainComposerState.emojiSuggestions,
    mentionCandidates,
    optimisticMessages,
    setOptimisticMessages,
    refresh,
    scrollToLatest,
    composerRef: mainComposerState.composerRef,
    emojiPickerRef: mainComposerState.emojiPickerRef,
    clearOwnTypingState,
  });
  const threadComposer = useRoomComposer({
    client,
    userId: user?.userId,
    roomId: roomId ?? '',
    isPendingRoom,
    canInteractWithTimeline,
    uploadingAttachment: threadComposerState.uploadingAttachment,
    draft: threadComposerState.draft,
    setDraft: threadComposerState.setDraft,
    queuedImage: threadComposerState.queuedImage,
    setQueuedImage: threadComposerState.setQueuedImage,
    threadContextMessage: activeThreadContextMessage,
    setShowQueuedImagePreview: threadComposerState.setShowQueuedImagePreview,
    setUploadingAttachment: threadComposerState.setUploadingAttachment,
    setActionError,
    composerMode: threadComposerState.composerMode,
    setComposerMode: threadComposerState.setComposerMode,
    showEmojiPicker: threadComposerState.showEmojiPicker,
    setShowEmojiPicker: threadComposerState.setShowEmojiPicker,
    selectedEmojiSuggestionIndex:
      threadComposerState.selectedEmojiSuggestionIndex,
    setSelectedEmojiSuggestionIndex:
      threadComposerState.setSelectedEmojiSuggestionIndex,
    emojiQuery: threadComposerState.emojiQuery,
    emojiSuggestions: threadComposerState.emojiSuggestions,
    mentionCandidates,
    optimisticMessages,
    setOptimisticMessages,
    refresh,
    scrollToLatest: isDesktopThreadPanelOpen
      ? scrollThreadPanelToLatest
      : scrollToLatest,
    composerRef: threadComposerState.composerRef,
    emojiPickerRef: threadComposerState.emojiPickerRef,
    clearOwnTypingState,
  });
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
    setMessageMenu: (value) => {
      if (!value) {
        setMessageMenu(null);
        return;
      }

      setMessageMenu({
        ...value,
        scope: 'room',
      });
    },
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
  const previewedQueuedImage = mainComposerState.showQueuedImagePreview
    ? mainComposerState.queuedImage
    : threadComposerState.showQueuedImagePreview
      ? threadComposerState.queuedImage
      : null;
  const footerComposerState = isThreadRouteActive
    ? threadComposerState
    : mainComposerState;
  const footerComposerHandlers = isThreadRouteActive
    ? threadComposer
    : mainComposer;
  const footerThreadContextMessage = isThreadRouteActive
    ? activeThreadContextMessage
    : null;
  const closeQueuedImagePreview = () => {
    mainComposerState.setShowQueuedImagePreview(false);
    threadComposerState.setShowQueuedImagePreview(false);
  };

  if (!roomId) {
    return (
      <IonPage className="app-shell">
        <IonContent className="app-list-page">
          <div className="flex items-center justify-center min-h-screen text-text">
            No conversation selected.
          </div>
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
        roomAvatarUrl={roomAvatarUrl}
        roomSubtitle={roomSubtitle}
        typingIndicator={typingIndicator}
        isEncrypted={isEncrypted}
        isPendingRoom={isPendingRoom}
        tangentSpaceId={tangentSpaceId}
        desktopRailWidth={desktopHeaderWidth}
        desktopRailHeader={
          isDesktopLayout ? (
            <DesktopRailHeader
              view={desktopRailView}
              settingsSection={desktopSettingsSection}
              searchQuery={desktopRailSearchQuery}
              showMenu={showDesktopRailMenu}
              showSearch={showDesktopSidebar}
              currentUserName={currentUserName}
              currentUserAvatarUrl={currentUserAvatarUrl}
              currentUserId={user?.userId ?? bootstrapUserId ?? null}
              onToggleMenu={() => setShowDesktopRailMenu((current) => !current)}
              onCloseMenu={() => setShowDesktopRailMenu(false)}
              onSearchQueryChange={setDesktopRailSearchQuery}
              onOpenHubs={() => {
                openDesktopHubs();
              }}
              onOpenContacts={() => {
                if (showDesktopSidebar) {
                  openDesktopContacts();
                  return;
                }

                navigate('/contacts');
              }}
              onOpenOtherRooms={() => {
                if (showDesktopSidebar) {
                  openDesktopOtherRooms();
                  return;
                }

                navigate('/other');
              }}
              onOpenSettings={() => {
                if (showDesktopSidebar) {
                  openDesktopSettings();
                  return;
                }

                navigate('/menu');
              }}
              onBack={handleDesktopRailBack}
            />
          ) : null
        }
        onBack={
          isThreadRouteActive
            ? () => {
                navigate(openRoomPath);
              }
            : handleBackNavigation
        }
        onEditTopic={() => {
          if (isDesktopLayout) {
            openDesktopEditPanel();
            return;
          }

          if (isLiveSession) {
            setShowIdentityModal(true);
          }
        }}
        onOpenPinnedMessages={() => {
          if (isDesktopLayout) {
            openDesktopPinsPanel();
            return;
          }

          navigate(openPinnedMessagesPath);
        }}
        onSearch={() => {
          if (isDesktopLayout) {
            openDesktopSearchPanel();
            return;
          }

          navigate(openSearchPath);
        }}
        onCreateTopic={() => {
          if (isLiveSession) {
            setShowTangentModal(true);
          }
        }}
        onOpenMenu={() => {
          if (isDesktopLayout) {
            openDesktopDetailsPanel();
            return;
          }

          if (isLiveSession) {
            setShowMenu(true);
          }
        }}
      />

      <IonContent
        ref={contentRef}
        fullscreen
        className="app-chat-page"
        scrollY={!useDesktopSplitLayout}
      >
        <div
          className={
            useDesktopSplitLayout
              ? 'h-full xl:flex xl:min-h-0 xl:overflow-hidden'
              : ''
          }
        >
          {showDesktopRailBody ? (
            <>
              <DesktopTopicSidebar
                width={desktopRailWidth}
                view={desktopRailView}
                settingsSection={desktopSettingsSection}
                searchQuery={desktopRailSearchQuery}
                currentRoomId={roomId ?? ''}
                topics={tangentTopics}
                onSelectTopic={(topicId) => {
                  void handleSelectTopic(topicId);
                }}
                onSelectHub={(space) => {
                  setDesktopRailSearchQuery('');
                  setDesktopRailView('topics');
                  if (space.mainRoomId !== roomId) {
                    navigate(`/room/${encodeURIComponent(space.mainRoomId)}`);
                  }
                }}
                onOpenAddContact={openDesktopAddContact}
                onSelectSettingsSection={navigateDesktopSettingsSection}
                onOpenRoute={(path) => navigate(path)}
              />
              <div
                className={cn(
                  'relative -ml-2 hidden w-4 shrink-0 xl:block',
                  isResizingDesktopRail ? 'z-10' : ''
                )}
              >
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize left panel"
                  className={cn(
                    'absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 cursor-col-resize rounded-full transition-colors',
                    isResizingDesktopRail ? 'bg-accent/30' : 'bg-transparent hover:bg-line'
                  )}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setIsResizingDesktopRail(true);
                  }}
                />
              </div>
            </>
          ) : null}
          <div
            className={
              useDesktopSplitLayout
                ? 'flex min-h-0 min-w-0 flex-1 flex-col'
                : 'flex-1 min-w-0'
            }
          >
            <div
              ref={timelineScrollRef}
              className={
                useDesktopSplitLayout ? 'min-h-0 flex-1 overflow-y-auto' : ''
              }
            >
              <div className="px-4 pb-4 pt-6 xl:px-8">
                {isPendingRoom ? (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div key={message.id} className="app-chat-bubble other">
                        <div className="mb-1 text-[11px] font-medium text-text-subtle">
                          {message.senderId}
                        </div>
                        <div>{message.body}</div>
                        <div className="mt-2 text-right text-[11px] text-text-subtle">
                          {formatTimestamp(message.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : loading ? (
                  <div className="py-12 text-sm text-center text-text-muted">
                    Loading messages...
                  </div>
                ) : displayError && messages.length === 0 ? (
                  <div className="py-6 text-sm text-center text-danger">
                    {displayError}
                  </div>
                ) : membershipPolicy && roomMembership !== 'join' ? (
                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-line bg-panel/95 px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                      {membershipPolicy.supportsJoin ? (
                        <Button onClick={() => void handleJoinCurrentRoom()}>
                          Join topic
                        </Button>
                      ) : (
                        <div className="text-sm text-text-muted">Unavailable</div>
                      )}
                    </div>
                  </div>
                ) : visibleMessages.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-base font-medium text-text">
                      {isThreadRouteActive ? 'No replies yet' : 'No messages yet'}
                    </p>
                    <p className="mt-2 text-sm text-text-muted">
                      {isThreadRouteActive
                        ? 'Reply below to start this thread.'
                        : 'Start the topic below.'}
                    </p>
                  </div>
                ) : isThreadRouteActive ? (
                  <ThreadTimeline
                    rootMessage={activeThreadRootMessage}
                    replies={activeThreadReplies}
                    accessToken={client?.getAccessToken() ?? null}
                    viewMode={preferences.chatViewMode}
                    mentionTargets={mentionCandidates}
                    readReceiptMessageId={threadReadReceiptMessageId}
                    readReceiptNames={threadReadReceiptNames}
                    onRetry={
                      isLiveSession ? threadComposer.handleRetryMessage : undefined
                    }
                    onToggleReaction={
                      isLiveSession
                        ? (targetMessage, reactionKey) => {
                            void handleToggleReaction(targetMessage, reactionKey);
                          }
                        : undefined
                    }
                    onRequestActions={
                      !isLiveSession
                        ? undefined
                        : (nextMessage, position) => {
                            if (nextMessage.id.startsWith('local:')) {
                              return;
                            }

                            setMessageMenu({
                              message: nextMessage,
                              position,
                              scope: 'thread',
                            });
                          }
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {loadingOlderMessages ? (
                      <div className="py-1 text-center text-xs text-text-muted">
                        Loading older messages...
                      </div>
                    ) : null}
                    {displayError ? (
                      <div className="py-2 text-sm text-center text-danger">
                        {displayError}
                      </div>
                    ) : null}
                    <TimelineMessageList
                      messages={visibleMessages}
                      accessToken={client?.getAccessToken() ?? null}
                      viewMode={preferences.chatViewMode}
                      mentionTargets={mentionCandidates}
                      readReceiptMessageId={mainReadReceiptMessageId}
                      readReceiptNames={mainReadReceiptNames}
                      onRetry={
                        isLiveSession ? mainComposer.handleRetryMessage : undefined
                      }
                      onToggleReaction={
                        isLiveSession
                          ? (targetMessage, reactionKey) => {
                              void handleToggleReaction(
                                targetMessage,
                                reactionKey
                              );
                            }
                          : undefined
                      }
                      onRequestActions={
                        !isLiveSession
                          ? undefined
                          : (nextMessage, position) => {
                              if (nextMessage.id.startsWith('local:')) {
                                return;
                              }

                              setMessageMenu({
                                message: nextMessage,
                                position,
                                scope: 'room',
                              });
                            }
                      }
                      onOpenThread={openThread}
                      getThreadSummary={(message) =>
                        threadSummariesByRootId.get(message.id) ?? null
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          {showDesktopRoomPanel ? (
            <>
              <div
                className={cn(
                  'relative -mr-2 hidden w-4 shrink-0 xl:block',
                  isResizingDesktopRoomPanel ? 'z-10' : ''
                )}
              >
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize right panel"
                  className={cn(
                    'absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 cursor-col-resize rounded-full transition-colors',
                    isResizingDesktopRoomPanel
                      ? 'bg-accent/30'
                      : 'bg-transparent hover:bg-line'
                  )}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setIsResizingDesktopRoomPanel(true);
                  }}
                />
              </div>
              <DesktopRoomPanel
                view={desktopRoomPanelView}
                width={desktopRoomPanelWidth}
                roomName={roomName}
                roomDescription={roomDescription}
                roomIcon={roomIcon}
                pinnedMessageIds={pinnedMessageIds}
                messages={visibleMainMessages}
                savingIdentity={savingIdentity}
                actionError={actionError}
                threadTimelineScrollRef={threadTimelineScrollRef}
                threadPanelState={
                  isDesktopThreadPanelOpen
                    ? {
                        rootMessage: activeThreadRootMessage,
                        replies: activeThreadReplies,
                        accessToken: client?.getAccessToken() ?? null,
                        viewMode: preferences.chatViewMode,
                        mentionTargets: mentionCandidates,
                        readReceiptMessageId: threadReadReceiptMessageId,
                        readReceiptNames: threadReadReceiptNames,
                        onRetry: isLiveSession
                          ? threadComposer.handleRetryMessage
                          : undefined,
                        onToggleReaction: isLiveSession
                          ? (targetMessage, reactionKey) => {
                              void handleToggleReaction(targetMessage, reactionKey);
                            }
                          : undefined,
                        onRequestActions: !isLiveSession
                          ? undefined
                          : (nextMessage, position) => {
                              if (nextMessage.id.startsWith('local:')) {
                                return;
                              }

                              setMessageMenu({
                                message: nextMessage,
                                position,
                                scope: 'thread',
                              });
                            },
                      }
                    : null
                }
                onClose={closeDesktopRoomPanel}
                onBackToDetails={backToDesktopRoomDetails}
                onOpenView={setDesktopRoomPanelView}
                onSaveTopicIdentity={handleSaveTopicIdentity}
              />
            </>
          ) : null}
        </div>
      </IonContent>

      {showJumpToLatest ? (
        <button
          type="button"
          className="app-menu-surface fixed bottom-28 right-4 z-20 rounded-full px-4 py-2 text-sm font-medium text-text"
          onClick={() => scrollToLatest()}
        >
          {isThreadRouteActive ? 'New replies' : 'New messages'}
        </button>
      ) : null}

      <IonFooter className="app-chat-footer ion-no-border">
        <div className={useDesktopSplitLayout ? 'xl:flex xl:min-h-full' : ''}>
          {showDesktopRailBody ? (
            <div
              className="app-glass-panel app-surface-divider-right hidden xl:block xl:shrink-0"
              style={{ width: desktopRailWidth }}
            />
          ) : null}
          <div className={useDesktopSplitLayout ? 'min-w-0 flex-1' : ''}>
            <RoomComposer
              isPendingRoom={isPendingRoom}
              canInteractWithTimeline={canInteractWithTimeline}
              uploadingAttachment={footerComposerState.uploadingAttachment}
              draft={footerComposerState.draft}
              queuedImage={footerComposerState.queuedImage}
              composerMode={footerComposerState.composerMode}
              threadContextMessage={footerThreadContextMessage}
              mentionSuggestions={footerComposerState.mentionSuggestions}
              emojiSuggestions={footerComposerState.emojiSuggestions}
              selectedEmojiSuggestionIndex={
                footerComposerState.selectedEmojiSuggestionIndex
              }
              showEmojiPicker={footerComposerState.showEmojiPicker}
              attachmentInputRef={footerComposerState.attachmentInputRef}
              composerRef={footerComposerState.composerRef}
              emojiPickerRef={footerComposerState.emojiPickerRef}
              onAttachmentSelection={footerComposerHandlers.handleAttachmentSelection}
              onToggleEmojiPicker={() =>
                footerComposerState.setShowEmojiPicker((current) => !current)
              }
              onDraftInput={footerComposerHandlers.handleDraftInput}
              onComposerKeyDown={footerComposerHandlers.handleComposerKeyDown}
              onComposerPaste={footerComposerHandlers.handleComposerPaste}
              onSend={() => {
                void footerComposerHandlers.handleSendMessage();
              }}
              onCancelComposerContext={() => {
                if (footerComposerState.composerMode) {
                  footerComposerHandlers.handleCancelComposerContext();
                  return;
                }

                if (isDesktopThreadPanelOpen) {
                  closeDesktopRoomPanel();
                  return;
                }

                if (isThreadRouteActive) {
                  navigate(openRoomPath);
                }
              }}
              onRemoveQueuedImage={footerComposerHandlers.handleRemoveQueuedImage}
              onInsertEmoji={footerComposerHandlers.handleInsertEmoji}
              onHighlightEmoji={footerComposerHandlers.setSelectedEmojiSuggestionIndex}
              onOpenQueuedImagePreview={() =>
                footerComposerState.setShowQueuedImagePreview(true)
              }
              setDraft={footerComposerState.setDraft}
            />
          </div>
          {isDesktopThreadPanelOpen ? (
            <div
              className="app-glass-panel app-surface-divider-left hidden xl:block xl:shrink-0"
              style={{ width: desktopRoomPanelWidth }}
            >
              <RoomComposer
                isPendingRoom={isPendingRoom}
                canInteractWithTimeline={canInteractWithTimeline}
                uploadingAttachment={threadComposerState.uploadingAttachment}
                draft={threadComposerState.draft}
                queuedImage={threadComposerState.queuedImage}
                composerMode={threadComposerState.composerMode}
                threadContextMessage={activeThreadContextMessage}
                mentionSuggestions={threadComposerState.mentionSuggestions}
                emojiSuggestions={threadComposerState.emojiSuggestions}
                selectedEmojiSuggestionIndex={
                  threadComposerState.selectedEmojiSuggestionIndex
                }
                showEmojiPicker={threadComposerState.showEmojiPicker}
                attachmentInputRef={threadComposerState.attachmentInputRef}
                composerRef={threadComposerState.composerRef}
                emojiPickerRef={threadComposerState.emojiPickerRef}
                onAttachmentSelection={threadComposer.handleAttachmentSelection}
                onToggleEmojiPicker={() =>
                  threadComposerState.setShowEmojiPicker((current) => !current)
                }
                onDraftInput={threadComposer.handleDraftInput}
                onComposerKeyDown={threadComposer.handleComposerKeyDown}
                onComposerPaste={threadComposer.handleComposerPaste}
                onSend={() => {
                  void threadComposer.handleSendMessage();
                }}
                onCancelComposerContext={threadComposer.handleCancelComposerContext}
                onRemoveQueuedImage={threadComposer.handleRemoveQueuedImage}
                onInsertEmoji={threadComposer.handleInsertEmoji}
                onHighlightEmoji={
                  threadComposer.setSelectedEmojiSuggestionIndex
                }
                onOpenQueuedImagePreview={() =>
                  threadComposerState.setShowQueuedImagePreview(true)
                }
                setDraft={threadComposerState.setDraft}
              />
            </div>
          ) : showDesktopRoomPanel ? (
            <div
              className="app-glass-panel app-surface-divider-left hidden xl:block xl:shrink-0"
              style={{ width: desktopRoomPanelWidth }}
            />
          ) : null}
        </div>
      </IonFooter>

      {previewedQueuedImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Queued image preview"
        >
          <button
            type="button"
            className="absolute inset-0 bg-text/45"
            onClick={closeQueuedImagePreview}
            aria-label="Close image preview"
          />
          <div className="relative">
            <img
              src={previewedQueuedImage.previewUrl}
              alt={previewedQueuedImage.file.name}
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
            (messageMenu.message.msgtype === MsgType.Text ||
              messageMenu.message.msgtype === MsgType.Emote)
          }
          isPinned={pinnedMessageIds.includes(messageMenu.message.id)}
          onClose={() => setMessageMenu(null)}
          onReply={
            messageMenu.scope === 'thread' || isThreadRouteActive
              ? undefined
              : () => mainComposer.handleReplyToMessage(messageMenu.message)
          }
          onReplyInThread={
            messageMenu.scope === 'thread' || isThreadRouteActive
              ? undefined
              : () => {
                  openThread(messageMenu.message.id);
                }
          }
          onEdit={
            messageMenu.message.isOwn
              ? () =>
                  (messageMenu.scope === 'thread' || isThreadRouteActive
                    ? threadComposer.handleEditMessage
                    : mainComposer.handleEditMessage)(messageMenu.message)
              : undefined
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
      <KeyboardShortcutsOverlay
        isOpen={showShortcutOverlay}
        onClose={() => setShowShortcutOverlay(false)}
      />
    </IonPage>
  );
}

export default RoomPage;
