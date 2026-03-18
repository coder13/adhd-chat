import { IonButton, IonIcon, IonTextarea } from '@ionic/react';
import { attachOutline, closeOutline, happyOutline, send } from 'ionicons/icons';
import type {
  ChangeEvent,
  ClipboardEvent,
  Dispatch,
  KeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react';
import ComposerContextBar from '../../components/chat/ComposerContextBar';
import EmojiSuggestions from '../../components/chat/EmojiSuggestions';
import ReactionPicker from '../../components/chat/ReactionPicker';
import { insertMentionToken, type MentionCandidate } from '../../lib/chat/mentions';
import type { ComposerMode, QueuedImage, RoomMessage } from './types';

interface RoomComposerProps {
  isPendingRoom: boolean;
  canInteractWithTimeline: boolean;
  uploadingAttachment: boolean;
  draft: string;
  queuedImage: QueuedImage;
  composerMode: ComposerMode;
  threadContextMessage?: RoomMessage | null;
  mentionSuggestions: MentionCandidate[];
  emojiSuggestions: Array<{ shortcode: string; emoji: string; name: string; keywords: string[]; score: number }>;
  selectedEmojiSuggestionIndex: number;
  showEmojiPicker: boolean;
  attachmentInputRef: RefObject<HTMLInputElement | null>;
  composerRef: RefObject<HTMLIonTextareaElement | null>;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  onAttachmentSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleEmojiPicker: () => void;
  onDraftInput: (value: string) => void;
  onComposerKeyDown: (event: KeyboardEvent<HTMLIonTextareaElement>) => void;
  onComposerPaste: (event: ClipboardEvent<HTMLIonTextareaElement>) => void;
  onSend: () => void;
  onCancelComposerContext: () => void;
  onRemoveQueuedImage: () => void;
  onInsertEmoji: (emoji: string) => void;
  onHighlightEmoji: (index: number) => void;
  onOpenQueuedImagePreview: () => void;
  setDraft: Dispatch<SetStateAction<string>>;
}

function RoomComposer({
  isPendingRoom,
  canInteractWithTimeline,
  uploadingAttachment,
  draft,
  queuedImage,
  composerMode,
  threadContextMessage = null,
  mentionSuggestions,
  emojiSuggestions,
  selectedEmojiSuggestionIndex,
  showEmojiPicker,
  attachmentInputRef,
  composerRef,
  emojiPickerRef,
  onAttachmentSelection,
  onToggleEmojiPicker,
  onDraftInput,
  onComposerKeyDown,
  onComposerPaste,
  onSend,
  onCancelComposerContext,
  onRemoveQueuedImage,
  onInsertEmoji,
  onHighlightEmoji,
  onOpenQueuedImagePreview,
  setDraft,
}: RoomComposerProps) {
  return (
    <div className="app-composer gap-2 px-3 pt-2 sm:gap-3 sm:px-4">
      <div className="relative min-w-0 flex-1">
        {composerMode ? (
          <ComposerContextBar
            mode={composerMode.type}
            message={composerMode.message}
            onCancel={onCancelComposerContext}
          />
        ) : null}
        {queuedImage ? (
          <div className="mb-2 flex items-start gap-3 rounded-[22px] border border-line bg-panel/95 px-3 py-3">
            <button
              type="button"
              className="shrink-0 overflow-hidden rounded-2xl"
              onClick={onOpenQueuedImagePreview}
              aria-label="Preview queued image"
            >
              <img
                src={queuedImage.previewUrl}
                alt={queuedImage.file.name}
                className="h-16 w-16 object-cover transition-transform hover:scale-[1.02]"
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text">
                {queuedImage.file.name}
              </div>
              <div className="mt-1 text-xs text-text-muted">
                Add an optional message, or send the image on its own.
              </div>
            </div>
            <IonButton
              fill="clear"
              color="medium"
              onClick={onRemoveQueuedImage}
              className="h-9 w-9 shrink-0 rounded-full bg-elevated"
              aria-label="Remove image"
            >
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </div>
        ) : null}
        {emojiSuggestions.length > 0 || mentionSuggestions.length > 0 ? (
          <div className="pointer-events-none absolute bottom-full left-0 right-0 z-20 mb-2">
            <div className="pointer-events-auto">
              {emojiSuggestions.length > 0 ? (
                <EmojiSuggestions
                  suggestions={emojiSuggestions}
                  selectedIndex={Math.min(
                    selectedEmojiSuggestionIndex,
                    emojiSuggestions.length - 1
                  )}
                  onSelect={onInsertEmoji}
                  onHighlight={onHighlightEmoji}
                />
              ) : mentionSuggestions.length > 0 ? (
                <div className="app-menu-surface flex flex-wrap gap-2 rounded-2xl px-3 py-2">
                  {mentionSuggestions.map((candidate) => (
                    <button
                      key={candidate.userId}
                      type="button"
                      className="app-interactive-menu-item rounded-full bg-elevated px-3 py-1 text-xs font-medium text-text"
                      onClick={() => {
                        setDraft((currentDraft) =>
                          insertMentionToken(currentDraft, candidate.token)
                        );
                      }}
                    >
                      {candidate.displayName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex gap-2 sm:gap-3">
          {!isPendingRoom ? (
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt,.zip,.csv,.json,.md"
              className="hidden"
              onChange={onAttachmentSelection}
            />
          ) : null}
          <div className="app-compose-surface min-w-0 flex-1">
            {!isPendingRoom ? (
              <div ref={emojiPickerRef} className="relative shrink-0 self-center">
                <IonButton
                  shape="round"
                  fill="clear"
                  color="medium"
                  onClick={onToggleEmojiPicker}
                  className="h-10 w-10 shrink-0 rounded-full text-text"
                  disabled={!canInteractWithTimeline}
                  aria-label="Add emoji"
                >
                  <IonIcon slot="icon-only" icon={happyOutline} />
                </IonButton>
                {showEmojiPicker ? (
                  <ReactionPicker
                    onSelect={onInsertEmoji}
                    align="left"
                    className="bottom-full top-auto mb-2 mt-0"
                  />
                ) : null}
              </div>
            ) : null}
            <IonTextarea
              ref={composerRef}
              value={draft}
              onIonInput={(event) => onDraftInput(event.detail.value ?? '')}
              onKeyDown={onComposerKeyDown}
              onPaste={onComposerPaste}
              autoGrow
              rows={1}
              placeholder={
                isPendingRoom
                  ? 'Start typing while the topic finishes setting up'
                  : composerMode?.type === 'edit'
                    ? 'Edit message'
                    : threadContextMessage
                      ? 'Message'
                    : queuedImage
                      ? 'Add a message (optional)'
                    : canInteractWithTimeline
                      ? 'Message'
                      : 'Join this topic to send messages'
              }
              className="app-compose-field min-h-[48px] text-[15px] leading-6"
              disabled={!canInteractWithTimeline}
            />
            {!isPendingRoom ? (
              <IonButton
                shape="round"
                fill="clear"
                color="medium"
                onClick={() => attachmentInputRef.current?.click()}
                className="h-10 w-10 shrink-0 self-center rounded-full text-text"
                disabled={!canInteractWithTimeline || uploadingAttachment}
                aria-label="Add attachment"
              >
                <IonIcon slot="icon-only" icon={attachOutline} />
              </IonButton>
            ) : null}
          </div>
          <IonButton
            shape="round"
            color="primary"
            onClick={onSend}
            className="h-12 w-12 shrink-0 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.45)]"
            disabled={
              !canInteractWithTimeline ||
              isPendingRoom ||
              uploadingAttachment ||
              (!draft.trim() && !queuedImage)
            }
          >
            <IonIcon slot="icon-only" icon={send} />
          </IonButton>
        </div>
      </div>
    </div>
  );
}

export default RoomComposer;
