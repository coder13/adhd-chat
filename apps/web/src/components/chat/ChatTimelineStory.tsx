import { IonContent, IonFooter, IonPage } from '@ionic/react';
import { useRef, useState } from 'react';
import { createMentionCandidate } from '../../lib/chat/mentions';
import type { TimelineMessage } from '../../lib/matrix/chatCatalog';
import type { ChatViewMode } from '../../lib/matrix/preferences';
import type { MentionCandidate } from '../../lib/chat/mentions';
import type { ComposerMode, QueuedImage } from '../../pages/room/types';
import RoomComposer from '../../pages/room/RoomComposer';
import RoomHeader from '../../pages/room/RoomHeader';
import MessageBubble from './MessageBubble';
import MessageActionMenu from './MessageActionMenu';

interface ChatTimelineStoryProps {
  messages: TimelineMessage[];
  viewMode?: ChatViewMode;
  mentionTargets?: Array<{ userId: string; displayName: string }>;
  title?: string;
  subtitle?: string;
  screenState?: 'messages' | 'empty' | 'loading' | 'error';
  errorMessage?: string | null;
  canInteractWithTimeline?: boolean;
  initialDraft?: string;
  initialComposerMode?: ComposerMode;
  initialActionMenuMessageId?: string | null;
  typingIndicator?: string | null;
  isEncrypted?: boolean;
}

type MessageMenuState = {
  message: TimelineMessage;
  position: { x: number; y: number };
} | null;

function toggleReactionState(
  message: TimelineMessage,
  reactionKey: string
): TimelineMessage {
  const existingReactions = message.reactions ?? [];
  const reactionIndex = existingReactions.findIndex(
    (reaction) => reaction.key === reactionKey
  );

  if (reactionIndex === -1) {
    return {
      ...message,
      reactions: [
        ...existingReactions,
        {
          key: reactionKey,
          count: 1,
          isOwn: true,
          senderNames: ['You'],
        },
      ],
    };
  }

  const currentReaction = existingReactions[reactionIndex];
  const nextReactions = [...existingReactions];

  if (currentReaction.isOwn) {
    if (currentReaction.count <= 1) {
      nextReactions.splice(reactionIndex, 1);
    } else {
      nextReactions[reactionIndex] = {
        ...currentReaction,
        count: currentReaction.count - 1,
        isOwn: false,
        senderNames: currentReaction.senderNames.filter((name) => name !== 'You'),
      };
    }
  } else {
    nextReactions[reactionIndex] = {
      ...currentReaction,
      count: currentReaction.count + 1,
      isOwn: true,
      senderNames: [...currentReaction.senderNames, 'You'],
    };
  }

  return {
    ...message,
    reactions: nextReactions,
  };
}

function ChatTimelineStory({
  messages,
  viewMode = 'timeline',
  mentionTargets = [],
  title = 'Weekend Check-in',
  subtitle = 'Alex is active now',
  screenState = 'messages',
  errorMessage = null,
  canInteractWithTimeline = true,
  initialDraft = '',
  initialComposerMode,
  initialActionMenuMessageId = null,
  typingIndicator = null,
  isEncrypted = false,
}: ChatTimelineStoryProps) {
  const [timelineMessages, setTimelineMessages] = useState(messages);
  const [draft, setDraft] = useState(initialDraft);
  const fallbackComposerMessage = messages[4] ?? messages[0] ?? null;
  const [composerMode, setComposerMode] = useState<ComposerMode>(
    initialComposerMode ??
      (fallbackComposerMessage
        ? {
            type: 'reply',
            message: fallbackComposerMessage,
          }
        : null)
  );
  const [messageMenu, setMessageMenu] = useState<MessageMenuState>(() => {
    if (!initialActionMenuMessageId) {
      return null;
    }

    const targetMessage = messages.find(
      (message) => message.id === initialActionMenuMessageId
    );

    return targetMessage
      ? {
          message: targetMessage,
          position: { x: 96, y: 220 },
        }
      : null;
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLIonTextareaElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const mentionSuggestions: MentionCandidate[] = mentionTargets.map((target) =>
    createMentionCandidate(target.userId, target.displayName)
  );
  const queuedImage: QueuedImage = null;

  return (
    <div className="min-h-screen bg-[var(--ion-background-color)] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] shadow-[0_28px_70px_-40px_rgba(15,23,42,0.45)]">
        <IonPage className="app-shell">
          <RoomHeader
            roomName={title}
            roomDescription={subtitle}
            roomIcon="💬"
            roomSubtitle={viewMode === 'bubbles' ? 'Bubble view' : 'Timeline view'}
            typingIndicator={typingIndicator}
            isEncrypted={isEncrypted}
            isPendingRoom={false}
            tangentSpaceId="storybook-space"
            onBack={() => undefined}
            onEditTopic={() => undefined}
            onSearch={() => undefined}
            onCreateTopic={() => undefined}
            onOpenMenu={() => undefined}
          />

          <IonContent fullscreen className="app-chat-page">
            <div className="px-4 pb-4 pt-6">
              {screenState === 'loading' ? (
                <div className="py-12 text-center text-sm text-text-muted">
                  Loading messages...
                </div>
              ) : screenState === 'error' && timelineMessages.length === 0 ? (
                <div className="py-6 text-center text-sm text-danger">
                  {errorMessage ?? 'Unable to load messages.'}
                </div>
              ) : timelineMessages.length === 0 || screenState === 'empty' ? (
                <div className="py-12 text-center">
                  <p className="text-base font-medium text-text">No messages yet</p>
                  <p className="mt-2 text-sm text-text-muted">
                    Start the topic below.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mb-2 flex justify-center">
                    <span className="rounded-full bg-panel px-3 py-1 text-xs font-medium text-text-subtle">
                      Monday, March 16
                    </span>
                  </div>
                  {screenState === 'error' && errorMessage ? (
                    <div className="py-2 text-center text-sm text-danger">
                      {errorMessage}
                    </div>
                  ) : null}
                  {timelineMessages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      viewMode={viewMode}
                      receiptNames={message.readByNames ?? null}
                      mentionTargets={mentionTargets}
                      onRetry={(messageId) => {
                        setTimelineMessages((currentMessages) =>
                          currentMessages.map((currentMessage) =>
                            currentMessage.id === messageId
                              ? {
                                  ...currentMessage,
                                  deliveryStatus: 'sending',
                                }
                              : currentMessage
                          )
                        );
                      }}
                      onToggleReaction={(targetMessage, reactionKey) => {
                        setTimelineMessages((currentMessages) =>
                          currentMessages.map((currentMessage) =>
                            currentMessage.id === targetMessage.id
                              ? toggleReactionState(currentMessage, reactionKey)
                              : currentMessage
                          )
                        );
                      }}
                      onRequestActions={(targetMessage) => {
                        setMessageMenu({
                          message: targetMessage,
                          position: { x: 96, y: 220 },
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </IonContent>

          <IonFooter className="app-chat-footer ion-no-border">
            <RoomComposer
              isPendingRoom={false}
              canInteractWithTimeline={canInteractWithTimeline}
              uploadingAttachment={false}
              draft={draft}
              queuedImage={queuedImage}
              composerMode={composerMode}
              mentionSuggestions={draft.endsWith('@') ? mentionSuggestions : []}
              emojiSuggestions={[]}
              selectedEmojiSuggestionIndex={0}
              showEmojiPicker={showEmojiPicker}
              attachmentInputRef={attachmentInputRef}
              composerRef={composerRef}
              emojiPickerRef={emojiPickerRef}
              onAttachmentSelection={() => undefined}
              onToggleEmojiPicker={() => setShowEmojiPicker((current) => !current)}
              onDraftInput={setDraft}
              onComposerKeyDown={() => undefined}
              onComposerPaste={() => undefined}
              onSend={() => {
                if (!draft.trim() || !canInteractWithTimeline) {
                  return;
                }

                setTimelineMessages((currentMessages) => [
                  ...currentMessages,
                  {
                    id: `local:${currentMessages.length + 1}`,
                    senderId: '@me:matrix.org',
                    senderName: 'You',
                    body: draft.trim(),
                    timestamp: Date.now(),
                    isOwn: true,
                    msgtype: 'm.text',
                    deliveryStatus: 'sending',
                  },
                ]);
                setDraft('');
                setComposerMode(null);
              }}
              onCancelComposerContext={() => setComposerMode(null)}
              onRemoveQueuedImage={() => undefined}
              onInsertEmoji={(emoji) => setDraft((current) => `${current}${emoji}`)}
              onHighlightEmoji={() => undefined}
              onOpenQueuedImagePreview={() => undefined}
              setDraft={setDraft}
            />
          </IonFooter>

          {messageMenu ? (
            <MessageActionMenu
              message={messageMenu.message}
              position={messageMenu.position}
              canEdit={
                messageMenu.message.isOwn &&
                !messageMenu.message.isDeleted &&
                (messageMenu.message.msgtype === 'm.text' ||
                  messageMenu.message.msgtype === 'm.emote')
              }
              isPinned={false}
              onClose={() => setMessageMenu(null)}
              onReply={() => {
                setComposerMode({
                  type: 'reply',
                  message: messageMenu.message,
                });
              }}
              onEdit={
                messageMenu.message.isOwn
                  ? () => {
                      setComposerMode({
                        type: 'edit',
                        message: messageMenu.message,
                      });
                      setDraft(messageMenu.message.body);
                    }
                  : undefined
              }
              onDelete={
                messageMenu.message.isOwn
                  ? () => {
                      setTimelineMessages((currentMessages) =>
                        currentMessages.map((currentMessage) =>
                          currentMessage.id === messageMenu.message.id
                            ? {
                                ...currentMessage,
                                body: 'Message deleted',
                                isDeleted: true,
                              }
                            : currentMessage
                        )
                      );
                    }
                  : undefined
              }
              onPin={() => undefined}
              onReact={(emoji) => {
                setTimelineMessages((currentMessages) =>
                  currentMessages.map((currentMessage) =>
                    currentMessage.id === messageMenu.message.id
                      ? toggleReactionState(currentMessage, emoji)
                      : currentMessage
                  )
                );
              }}
            />
          ) : null}
        </IonPage>
      </div>
    </div>
  );
}

export default ChatTimelineStory;
