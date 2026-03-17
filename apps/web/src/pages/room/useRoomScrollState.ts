import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

const NEAR_BOTTOM_THRESHOLD_PX = 96;

interface UseRoomScrollStateParams {
  roomId: string | null;
  contentRef: RefObject<HTMLIonContentElement | null>;
  messageKeys: string[];
}

function getDistanceFromBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

export function useRoomScrollState({
  roomId,
  contentRef,
  messageKeys,
}: UseRoomScrollStateParams) {
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const nearBottomRef = useRef(true);
  const hasInitialScrollRef = useRef(false);
  const scrollHostRef = useRef<HTMLElement | null>(null);
  const previousMessageKeysRef = useRef<string[] | null>(null);
  const lastScrollTopRef = useRef(0);
  const messageSignature = useMemo(() => messageKeys.join('|'), [messageKeys]);

  const scrollToLatest = useCallback(
    (duration = 250) => {
      window.requestAnimationFrame(() => {
        void contentRef.current?.scrollToBottom(duration);
      });
    },
    [contentRef]
  );

  useEffect(() => {
    previousMessageKeysRef.current = null;
    hasInitialScrollRef.current = false;
    nearBottomRef.current = true;
    scrollHostRef.current = null;
    lastScrollTopRef.current = 0;
    setShowJumpToLatest(false);
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const attachScrollListener = async () => {
      const scrollHost = await contentRef.current?.getScrollElement();
      if (!scrollHost || cancelled) {
        return;
      }

      scrollHostRef.current = scrollHost;

      const updateScrollState = () => {
        const nearBottom =
          getDistanceFromBottom(scrollHost) <= NEAR_BOTTOM_THRESHOLD_PX;
        lastScrollTopRef.current = scrollHost.scrollTop;
        nearBottomRef.current = nearBottom;
        if (nearBottom) {
          setShowJumpToLatest(false);
        }
      };

      updateScrollState();
      scrollHost.addEventListener('scroll', updateScrollState, { passive: true });
      cleanup = () => {
        scrollHost.removeEventListener('scroll', updateScrollState);
      };
    };

    void attachScrollListener();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [contentRef, roomId]);

  useLayoutEffect(() => {
    const previousMessageKeys = previousMessageKeysRef.current;
    previousMessageKeysRef.current = messageKeys;

    if (!roomId) {
      return;
    }

    if (!hasInitialScrollRef.current) {
      hasInitialScrollRef.current = true;
      scrollToLatest(0);
      return;
    }

    const previousMessageCount = previousMessageKeys?.length ?? 0;
    const nextMessageCount = messageKeys.length;
    const scrollHost = scrollHostRef.current;

    if (
      nextMessageCount > previousMessageCount &&
      !nearBottomRef.current
    ) {
      setShowJumpToLatest(true);
      if (scrollHost) {
        scrollHost.scrollTop = lastScrollTopRef.current;
      }
      return;
    }

    if (
      nextMessageCount > previousMessageCount &&
      nearBottomRef.current
    ) {
      scrollToLatest();
      return;
    }

    if (!nearBottomRef.current && scrollHost) {
      scrollHost.scrollTop = lastScrollTopRef.current;
    }
  }, [messageKeys, messageSignature, roomId, scrollToLatest]);

  return {
    showJumpToLatest,
  };
}
