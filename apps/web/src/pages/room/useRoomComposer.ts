import { type MatrixClient } from 'matrix-js-sdk';
import { useEffect } from 'react';
import type {
  ChangeEvent,
  ClipboardEvent,
  Dispatch,
  KeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react';
import { shouldSubmitComposerOnEnter } from '../../lib/chat/composerBehavior';
import {
  insertEmojiQueryResult,
  replaceCompletedEmojiShortcodes,
} from '../../lib/chat/emojis';
import {
  collectMentionedUserIds,
  type MentionCandidate,
} from '../../lib/chat/mentions';
import { createId } from '../../lib/id';
import { buildMatrixMediaPayload } from '../../lib/matrix/media';
import {
  acknowledgeOptimisticMessage,
  createOptimisticAttachmentMessage,
  createOptimisticTextMessage,
  resolveOwnSenderName,
  type OptimisticTimelineMessage,
} from '../../lib/matrix/optimisticTimeline';
import { getPastedImageFile } from './mediaInput';
import { buildTextMessageRequest } from './composerSend';
import type { ComposerMode, QueuedImage, RoomMessage } from './types';

interface UseRoomComposerParams {
  client: MatrixClient | null;
  userId: string | null | undefined;
  roomId: string;
  isPendingRoom: boolean;
  canInteractWithTimeline: boolean;
  uploadingAttachment: boolean;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  queuedImage: QueuedImage;
  setQueuedImage: Dispatch<SetStateAction<QueuedImage>>;
  threadContextMessage: RoomMessage | null;
  setShowQueuedImagePreview: (value: boolean) => void;
  setUploadingAttachment: (value: boolean) => void;
  setActionError: (value: string | null) => void;
  composerMode: ComposerMode;
  setComposerMode: (value: ComposerMode) => void;
  showEmojiPicker: boolean;
  setShowEmojiPicker: Dispatch<SetStateAction<boolean>>;
  selectedEmojiSuggestionIndex: number;
  setSelectedEmojiSuggestionIndex: Dispatch<SetStateAction<number>>;
  emojiQuery: string | null;
  emojiSuggestions: Array<{ emoji: string }>;
  mentionCandidates: MentionCandidate[];
  optimisticMessages: OptimisticTimelineMessage[];
  setOptimisticMessages: Dispatch<SetStateAction<OptimisticTimelineMessage[]>>;
  scrollToLatest: (duration?: number) => void;
  composerRef: RefObject<HTMLIonTextareaElement | null>;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  clearOwnTypingState: () => void;
}

type SendMessageResponse = { event_id?: string } | string | undefined;
type SendThreadedMessage = (
  nextRoomId: string,
  threadId: string | null,
  content: Record<string, unknown>,
  txnId?: string
) => Promise<SendMessageResponse>;

function sendMatrixMessage(
  client: MatrixClient,
  roomId: string,
  threadRootId: string | null,
  content: Record<string, unknown>,
  transactionId: string
) {
  return (client.sendMessage.bind(client) as unknown as SendThreadedMessage)(
    roomId,
    threadRootId,
    content,
    transactionId
  );
}

function getRemoteEventId(response: SendMessageResponse) {
  if (typeof response === 'string') {
    return response;
  }

  if (response && typeof response === 'object' && 'event_id' in response) {
    return response.event_id ?? null;
  }

  return null;
}

export function useRoomComposer({
  client,
  userId,
  roomId,
  isPendingRoom,
  canInteractWithTimeline,
  uploadingAttachment,
  draft,
  setDraft,
  queuedImage,
  setQueuedImage,
  threadContextMessage,
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
  scrollToLatest,
  composerRef,
  emojiPickerRef,
  clearOwnTypingState,
}: UseRoomComposerParams) {
  useEffect(() => {
    return () => {
      if (queuedImage?.previewUrl) {
        URL.revokeObjectURL(queuedImage.previewUrl);
      }
    };
  }, [queuedImage]);

  useEffect(() => {
    if (!showEmojiPicker) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (emojiPickerRef.current?.contains(event.target as Node)) {
        return;
      }

      setShowEmojiPicker(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [emojiPickerRef, setShowEmojiPicker, showEmojiPicker]);

  useEffect(() => {
    setSelectedEmojiSuggestionIndex(0);
  }, [emojiQuery, setSelectedEmojiSuggestionIndex]);

  const queueImageFile = (file: File) => {
    setShowEmojiPicker(false);
    if (composerMode?.type === 'edit') {
      setComposerMode(null);
      setDraft('');
    }
    if (queuedImage?.previewUrl) {
      URL.revokeObjectURL(queuedImage.previewUrl);
    }
    setQueuedImage({ file, previewUrl: URL.createObjectURL(file) });
    setActionError(null);
  };

  const sendFileAttachment = async (file: File) => {
    if (!client || !userId || isPendingRoom) {
      return;
    }

    const transactionId = createId('txn');
    const senderName = resolveOwnSenderName(client, roomId, userId);
    const threadRootId = threadContextMessage?.id ?? null;
    const optimisticAttachmentMessage = createOptimisticAttachmentMessage({
      file,
      senderId: userId,
      senderName,
      transactionId,
      threadRootId,
    });

    setOptimisticMessages((currentMessages) => [
      ...currentMessages,
      optimisticAttachmentMessage,
    ]);
    setUploadingAttachment(true);
    setActionError(null);

    try {
      const content = await buildMatrixMediaPayload(client, file);
      const response = await sendMatrixMessage(
        client,
        roomId,
        threadRootId,
        content,
        transactionId
      );
      const remoteEventId = getRemoteEventId(response);
      setOptimisticMessages((currentMessages) =>
        acknowledgeOptimisticMessage(
          currentMessages,
          transactionId,
          remoteEventId
        )
      );
      scrollToLatest();
    } catch (cause) {
      console.error(cause);
      const errorText = cause instanceof Error ? cause.message : String(cause);
      setActionError(errorText);
      setOptimisticMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.transactionId === transactionId
            ? { ...message, deliveryStatus: 'failed', errorText }
            : message
        )
      );
    } finally {
      setUploadingAttachment(false);
    }
  };

  const sendTextMessage = async ({
    body,
    optimisticMessageId,
    replyToMessage,
    editMessage,
    threadRootIdOverride,
  }: {
    body: string;
    optimisticMessageId?: string;
    replyToMessage?: RoomMessage | null;
    editMessage?: RoomMessage | null;
    threadRootIdOverride?: string | null;
  }) => {
    if (isPendingRoom || !canInteractWithTimeline || !body || !client || !userId) {
      return false;
    }

    const transactionId = createId('txn');
    const senderName = resolveOwnSenderName(client, roomId, userId);
    const mentionedUserIds = collectMentionedUserIds(body, mentionCandidates);
    const threadRootId = threadRootIdOverride ?? threadContextMessage?.id ?? null;
    const nextOptimisticMessage =
      editMessage || optimisticMessageId !== undefined
        ? null
        : createOptimisticTextMessage({
            body,
            senderId: userId,
            senderName,
            transactionId,
            threadRootId,
          });

    if (editMessage) {
      setActionError(null);
    } else if (nextOptimisticMessage) {
      setOptimisticMessages((currentMessages) => [
        ...currentMessages,
        {
          ...nextOptimisticMessage,
          replyTo: replyToMessage?.id
            ? {
                messageId: replyToMessage.id,
                senderName: replyToMessage.senderName,
                body: replyToMessage.body,
                isDeleted: Boolean(replyToMessage.isDeleted),
              }
            : null,
          mentionedUserIds,
        },
      ]);
    } else {
      setOptimisticMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === optimisticMessageId
            ? { ...message, deliveryStatus: 'sending', errorText: null, transactionId }
            : message
        )
      );
    }

    try {
      const { content: messageContent, threadRootId: sendThreadRootId } =
        buildTextMessageRequest({
          body,
          mentionedUserIds,
          replyToMessage,
          editMessage,
          threadRootId,
        });

      const response = await sendMatrixMessage(
        client,
        roomId,
        sendThreadRootId,
        messageContent,
        transactionId
      );
      const remoteEventId = getRemoteEventId(response);

      setOptimisticMessages((currentMessages) =>
        acknowledgeOptimisticMessage(
          currentMessages,
          transactionId,
          remoteEventId
        )
      );
      scrollToLatest();
      if (editMessage) {
        setComposerMode(null);
      }
      return true;
    } catch (cause) {
      console.error(cause);
      const errorText = cause instanceof Error ? cause.message : String(cause);
      if (editMessage) {
        setActionError(errorText);
      } else {
        setOptimisticMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.transactionId === transactionId
              ? { ...message, deliveryStatus: 'failed', errorText }
              : message
          )
        );
      }
      return false;
    }
  };

  const handleSendMessage = async () => {
    const body = draft.trim();
    if (!body && !queuedImage) {
      return;
    }

    setShowEmojiPicker(false);
    clearOwnTypingState();
    let didSend = false;

    if (queuedImage && client && userId && !isPendingRoom) {
      const transactionId = createId('txn');
      const senderName = resolveOwnSenderName(client, roomId, userId);
      const threadRootId = threadContextMessage?.id ?? null;
      const optimisticAttachmentMessage = createOptimisticAttachmentMessage({
        file: queuedImage.file,
        senderId: userId,
        senderName,
        transactionId,
        caption: body,
        threadRootId,
      });

      setOptimisticMessages((currentMessages) => [
        ...currentMessages,
        optimisticAttachmentMessage,
      ]);
      setUploadingAttachment(true);
      setActionError(null);
      setDraft('');
      URL.revokeObjectURL(queuedImage.previewUrl);
      setQueuedImage(null);

      try {
        const content = await buildMatrixMediaPayload(client, queuedImage.file, {
          caption: body,
        });
        const response = await sendMatrixMessage(
          client,
          roomId,
          threadRootId,
          content,
          transactionId
        );
        const remoteEventId = getRemoteEventId(response);
        setOptimisticMessages((currentMessages) =>
          acknowledgeOptimisticMessage(
            currentMessages,
            transactionId,
            remoteEventId
          )
        );
        scrollToLatest();
        didSend = true;
      } catch (cause) {
        console.error(cause);
        const errorText = cause instanceof Error ? cause.message : String(cause);
        setActionError(errorText);
        setOptimisticMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.transactionId === transactionId
              ? { ...message, deliveryStatus: 'failed', errorText }
              : message
          )
        );
      } finally {
        setUploadingAttachment(false);
      }
    } else {
      if (composerMode?.type !== 'edit') {
        setDraft('');
      }
      didSend = await sendTextMessage({
        body,
        replyToMessage: composerMode?.type === 'reply' ? composerMode.message : null,
        editMessage: composerMode?.type === 'edit' ? composerMode.message : null,
      });
    }

    if (composerMode?.type === 'edit' && didSend) {
      setDraft('');
    }
    if (composerMode?.type === 'reply' && didSend) {
      setComposerMode(null);
    }
  };

  const handleAttachmentSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !client || !userId || isPendingRoom) {
      return;
    }

    setShowEmojiPicker(false);
    if (file.type.startsWith('image/')) {
      queueImageFile(file);
      return;
    }

    await sendFileAttachment(file);
  };

  const handleComposerPaste = (event: ClipboardEvent<HTMLIonTextareaElement>) => {
    if (!canInteractWithTimeline || uploadingAttachment || isPendingRoom) {
      return;
    }

    const imageFile = getPastedImageFile(event);
    if (!imageFile) {
      return;
    }

    event.preventDefault();
    queueImageFile(imageFile);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLIonTextareaElement>) => {
    if (event.key === 'Escape' && composerMode) {
      event.preventDefault();
      handleCancelComposerContext();
      return;
    }

    if (emojiSuggestions.length > 0) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedEmojiSuggestionIndex((currentIndex) => (currentIndex + 1) % emojiSuggestions.length);
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedEmojiSuggestionIndex(
          (currentIndex) => (currentIndex - 1 + emojiSuggestions.length) % emojiSuggestions.length
        );
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        handleInsertEmoji(
          emojiSuggestions[selectedEmojiSuggestionIndex]?.emoji ?? emojiSuggestions[0].emoji
        );
        return;
      }
    }

    if (
      !shouldSubmitComposerOnEnter({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
      })
    ) {
      return;
    }

    event.preventDefault();
    if (!draft.trim() && !queuedImage) {
      return;
    }

    void handleSendMessage();
  };

  const handleDraftInput = (nextDraft: string) => {
    setDraft(replaceCompletedEmojiShortcodes(nextDraft));
  };

  const handleRetryMessage = (messageId: string) => {
    if (!client) {
      return;
    }

    const failedMessage = optimisticMessages.find(
      (message) => message.id === messageId && message.deliveryStatus === 'failed'
    );
    if (!failedMessage) {
      return;
    }

    if (failedMessage.retryFile) {
      const transactionId = createId('txn');
      const retryFile = failedMessage.retryFile;
      setOptimisticMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === messageId
            ? { ...message, deliveryStatus: 'sending', errorText: null, transactionId }
            : message
        )
      );
      setUploadingAttachment(true);
      setActionError(null);
      void (async () => {
        try {
          const response = await sendMatrixMessage(
            client,
            roomId,
            failedMessage.threadRootId ?? null,
            await buildMatrixMediaPayload(client, retryFile, {
              caption: failedMessage.attachmentCaption ?? failedMessage.body,
            }),
            transactionId
          );
          const remoteEventId = getRemoteEventId(response);
          setOptimisticMessages((currentMessages) =>
            acknowledgeOptimisticMessage(
              currentMessages.map((message) =>
                message.id === messageId
                  ? { ...message, transactionId }
                  : message
              ),
              transactionId,
              remoteEventId
            )
          );
        } catch (cause) {
          console.error(cause);
          const errorText = cause instanceof Error ? cause.message : String(cause);
          setActionError(errorText);
          setOptimisticMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === messageId
                ? { ...message, transactionId, deliveryStatus: 'failed', errorText }
                : message
            )
          );
        } finally {
          setUploadingAttachment(false);
        }
      })();
      return;
    }

    void sendTextMessage({
      body: failedMessage.body,
      optimisticMessageId: failedMessage.id,
      threadRootIdOverride: failedMessage.threadRootId ?? null,
    });
  };

  const handleReplyToMessage = (message: RoomMessage) => {
    setComposerMode({ type: 'reply', message });
    setDraft('');
    requestAnimationFrame(() => {
      void composerRef.current?.setFocus();
    });
  };

  const handleEditMessage = (message: RoomMessage) => {
    if (queuedImage?.previewUrl) {
      URL.revokeObjectURL(queuedImage.previewUrl);
    }
    setQueuedImage(null);
    setShowEmojiPicker(false);
    setComposerMode({ type: 'edit', message });
    setDraft(message.body);
    requestAnimationFrame(() => {
      void composerRef.current?.setFocus();
    });
  };

  const handleCancelComposerContext = () => {
    setComposerMode(null);
    setDraft('');
  };

  const handleRemoveQueuedImage = () => {
    if (queuedImage?.previewUrl) {
      URL.revokeObjectURL(queuedImage.previewUrl);
    }
    setShowQueuedImagePreview(false);
    setQueuedImage(null);
  };

  const handleInsertEmoji = (emoji: string) => {
    setDraft((currentDraft) => insertEmojiQueryResult(currentDraft, emoji));
    setShowEmojiPicker(false);
    requestAnimationFrame(() => {
      void composerRef.current?.setFocus();
    });
  };

  return {
    handleSendMessage,
    handleAttachmentSelection,
    handleComposerKeyDown,
    handleComposerPaste,
    handleDraftInput,
    handleRetryMessage,
    handleReplyToMessage,
    handleEditMessage,
    handleCancelComposerContext,
    handleRemoveQueuedImage,
    handleInsertEmoji,
    setSelectedEmojiSuggestionIndex,
  };
}
