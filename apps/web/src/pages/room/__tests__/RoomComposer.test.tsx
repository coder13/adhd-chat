/// <reference types="jest" />

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useRef, useState, type ReactNode } from 'react';
import RoomComposer from '../RoomComposer';
import type { ComposerMode, QueuedImage, RoomMessage } from '../types';

jest.mock('@ionic/react', () => ({
  IonButton: ({
    children,
    onClick,
    disabled,
    className,
    type = 'button',
    ...props
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    type?: 'button' | 'submit';
  }) => (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
  IonIcon: () => <span aria-hidden="true" />,
  IonTextarea: ({
    value,
    placeholder,
    disabled,
    className,
  }: {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
  }) => (
    <textarea
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      readOnly
    />
  ),
}));

jest.mock('../../../components/chat/EmojiSuggestions', () => () => null);
jest.mock('../../../components/chat/ReactionPicker', () => () => null);

function RoomComposerHarness({
  composerMode = null,
  threadContextMessage = null,
}: {
  composerMode?: ComposerMode;
  threadContextMessage?: RoomMessage | null;
}) {
  const [draft, setDraft] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLIonTextareaElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const queuedImage: QueuedImage = null;

  return (
    <RoomComposer
      isPendingRoom={false}
      canInteractWithTimeline
      uploadingAttachment={false}
      draft={draft}
      queuedImage={queuedImage}
      composerMode={composerMode}
      threadContextMessage={threadContextMessage}
      mentionSuggestions={[]}
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
      onSend={() => undefined}
      onCancelComposerContext={() => undefined}
      onRemoveQueuedImage={() => undefined}
      onInsertEmoji={() => undefined}
      onHighlightEmoji={() => undefined}
      onOpenQueuedImagePreview={() => undefined}
      setDraft={setDraft}
    />
  );
}

const sampleMessage: RoomMessage = {
  id: '$message',
  senderId: '@kyln:example.com',
  senderName: 'Kyln',
  body: 'Thread starter',
  timestamp: Date.UTC(2026, 2, 17, 18, 0),
  isOwn: false,
  msgtype: 'm.text',
};

describe('RoomComposer', () => {
  it('does not render the thread context bar while composing in a thread', () => {
    render(<RoomComposerHarness threadContextMessage={sampleMessage} />);

    expect(
      screen.queryByText("Replying in Kyln's thread")
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Message')).toBeInTheDocument();
  });

  it('still renders the reply context bar for direct replies', () => {
    render(
      <RoomComposerHarness
        composerMode={{ type: 'reply', message: sampleMessage }}
      />
    );

    expect(screen.getByText('Replying to Kyln')).toBeInTheDocument();
  });
});
