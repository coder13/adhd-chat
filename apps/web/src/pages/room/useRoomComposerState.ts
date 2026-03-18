import { useEffect, useMemo, useRef, useState } from 'react';
import { getEmojiQuery, getEmojiSuggestions } from '../../lib/chat/emojis';
import {
  getMentionQuery,
  type MentionCandidate,
} from '../../lib/chat/mentions';
import type { ComposerMode, QueuedImage } from './types';

interface UseRoomComposerStateParams {
  mentionCandidates: MentionCandidate[];
  resetKey?: string | null;
}

export function useRoomComposerState({
  mentionCandidates,
  resetKey,
}: UseRoomComposerStateParams) {
  const [draft, setDraft] = useState('');
  const [queuedImage, setQueuedImage] = useState<QueuedImage>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQueuedImagePreview, setShowQueuedImagePreview] = useState(false);
  const [selectedEmojiSuggestionIndex, setSelectedEmojiSuggestionIndex] =
    useState(0);
  const [composerMode, setComposerMode] = useState<ComposerMode>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLIonTextareaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiQuery = getEmojiQuery(draft);
  const emojiSuggestions = getEmojiSuggestions(emojiQuery);
  const mentionQuery = getMentionQuery(draft);
  const mentionSuggestions = useMemo(() => {
    if (emojiQuery !== null || !mentionQuery || mentionCandidates.length === 0) {
      return [];
    }

    return mentionCandidates.filter((candidate) =>
      candidate.token.toLowerCase().startsWith(mentionQuery.toLowerCase())
    );
  }, [emojiQuery, mentionCandidates, mentionQuery]);

  useEffect(() => {
    if (resetKey === undefined) {
      return;
    }

    setDraft('');
    setUploadingAttachment(false);
    setShowEmojiPicker(false);
    setShowQueuedImagePreview(false);
    setSelectedEmojiSuggestionIndex(0);
    setComposerMode(null);
    setQueuedImage((currentQueuedImage) => {
      if (currentQueuedImage?.previewUrl) {
        URL.revokeObjectURL(currentQueuedImage.previewUrl);
      }

      return null;
    });
  }, [resetKey]);

  return {
    draft,
    setDraft,
    queuedImage,
    setQueuedImage,
    uploadingAttachment,
    setUploadingAttachment,
    showEmojiPicker,
    setShowEmojiPicker,
    showQueuedImagePreview,
    setShowQueuedImagePreview,
    selectedEmojiSuggestionIndex,
    setSelectedEmojiSuggestionIndex,
    composerMode,
    setComposerMode,
    attachmentInputRef,
    composerRef,
    emojiPickerRef,
    emojiQuery,
    emojiSuggestions,
    mentionSuggestions,
  };
}
