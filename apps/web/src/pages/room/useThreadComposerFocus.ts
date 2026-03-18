import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { RoomMessage } from './types';

interface UseThreadComposerFocusParams {
  composerRef: RefObject<HTMLIonTextareaElement | null>;
  threadContextMessage: RoomMessage | null;
  canInteractWithTimeline: boolean;
}

export function useThreadComposerFocus({
  composerRef,
  threadContextMessage,
  canInteractWithTimeline,
}: UseThreadComposerFocusParams) {
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [fulfilledFocusRequestId, setFulfilledFocusRequestId] = useState(0);

  const requestThreadComposerFocus = useCallback(() => {
    setFocusRequestId((currentId) => currentId + 1);
  }, []);

  useEffect(() => {
    if (
      focusRequestId === 0 ||
      focusRequestId === fulfilledFocusRequestId ||
      !threadContextMessage ||
      !canInteractWithTimeline
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setFulfilledFocusRequestId(focusRequestId);
      void composerRef.current?.setFocus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    canInteractWithTimeline,
    composerRef,
    focusRequestId,
    fulfilledFocusRequestId,
    threadContextMessage,
  ]);

  return requestThreadComposerFocus;
}
