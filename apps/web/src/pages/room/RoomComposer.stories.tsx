import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { MentionCandidate } from '../../lib/chat/mentions';
import type { EmojiSuggestion } from '../../lib/chat/emojis';
import type { ComposerMode, QueuedImage } from './types';
import RoomComposer from './RoomComposer';
import {
  cloneStoryMessage,
  sampleReplyMessage,
  storyEmojiSuggestions,
  storyMentionCandidates,
} from '../../components/chat/chatTimelineStoryData';

interface RoomComposerStoryHarnessProps {
  canInteractWithTimeline?: boolean;
  initialDraft?: string;
  composerMode?: ComposerMode;
  mentionSuggestions?: MentionCandidate[];
  emojiSuggestions?: EmojiSuggestion[];
  showEmojiPicker?: boolean;
}

function RoomComposerStoryHarness({
  canInteractWithTimeline = true,
  initialDraft = '',
  composerMode = null,
  mentionSuggestions = [],
  emojiSuggestions = [],
  showEmojiPicker = false,
}: RoomComposerStoryHarnessProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [showPicker, setShowPicker] = useState(showEmojiPicker);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLIonTextareaElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const queuedImage: QueuedImage = null;

  return (
    <div className="min-w-[360px] max-w-[760px] bg-[var(--app-chat-background)] p-6">
      <RoomComposer
        isPendingRoom={false}
        canInteractWithTimeline={canInteractWithTimeline}
        uploadingAttachment={false}
        draft={draft}
        queuedImage={queuedImage}
        composerMode={composerMode}
        mentionSuggestions={mentionSuggestions}
        emojiSuggestions={emojiSuggestions}
        selectedEmojiSuggestionIndex={0}
        showEmojiPicker={showPicker}
        attachmentInputRef={attachmentInputRef}
        composerRef={composerRef}
        emojiPickerRef={emojiPickerRef}
        onAttachmentSelection={() => undefined}
        onToggleEmojiPicker={() => setShowPicker((current) => !current)}
        onDraftInput={setDraft}
        onComposerKeyDown={() => undefined}
        onComposerPaste={() => undefined}
        onSend={() => undefined}
        onCancelComposerContext={() => undefined}
        onRemoveQueuedImage={() => undefined}
        onInsertEmoji={(emoji) => setDraft((current) => `${current}${emoji}`)}
        onHighlightEmoji={() => undefined}
        onOpenQueuedImagePreview={() => undefined}
        setDraft={setDraft}
      />
    </div>
  );
}

const meta = {
  title: 'Chat/RoomComposer',
  component: RoomComposerStoryHarness,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof RoomComposerStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    initialDraft: '',
  },
};

export const ReplyMode: Story = {
  args: {
    composerMode: {
      type: 'reply',
      message: cloneStoryMessage(sampleReplyMessage),
    },
    initialDraft: 'Sounds good.',
  },
};

export const MentionSuggestions: Story = {
  args: {
    initialDraft: '@',
    mentionSuggestions: storyMentionCandidates,
  },
};

export const EmojiSuggestions: Story = {
  args: {
    initialDraft: ':sp',
    emojiSuggestions: storyEmojiSuggestions,
  },
};

export const ReadOnly: Story = {
  args: {
    canInteractWithTimeline: false,
  },
};
