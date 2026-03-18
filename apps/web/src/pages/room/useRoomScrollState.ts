import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { restorePrependScrollPosition } from './scrollAnchor';

const NEAR_BOTTOM_THRESHOLD_PX = 96;
const LOAD_OLDER_THRESHOLD_PX = 160;

interface UseRoomScrollStateParams {
  roomId: string | null;
  contentRef: RefObject<HTMLIonContentElement | null>;
  scrollElementRef?: RefObject<HTMLElement | null>;
  messageKeys: string[];
  scrollToLatest: (duration?: number) => void;
  canLoadOlderMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  onLoadOlderMessages?: () => Promise<void>;
}

function getDistanceFromBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

export function useRoomScrollState({
  roomId,
  contentRef,
  scrollElementRef,
  messageKeys,
  scrollToLatest,
  canLoadOlderMessages = false,
  isLoadingOlderMessages = false,
  onLoadOlderMessages,
}: UseRoomScrollStateParams) {
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const nearBottomRef = useRef(true);
  const hasInitialScrollRef = useRef(false);
  const scrollHostRef = useRef<HTMLElement | null>(null);
  const previousMessageKeysRef = useRef<string[] | null>(null);
  const lastScrollTopRef = useRef(0);
  const isPaginatingBackwardsRef = useRef(false);
  const pendingPrependAnchorRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const messageSignature = useMemo(() => messageKeys.join('|'), [messageKeys]);

  useEffect(() => {
    previousMessageKeysRef.current = null;
    hasInitialScrollRef.current = false;
    nearBottomRef.current = true;
    scrollHostRef.current = null;
    lastScrollTopRef.current = 0;
    isPaginatingBackwardsRef.current = false;
    pendingPrependAnchorRef.current = null;
    setShowJumpToLatest(false);
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const attachScrollListener = async () => {
      const directScrollHost = scrollElementRef?.current;
      const scrollHost = directScrollHost ?? await contentRef.current?.getScrollElement();
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

      const loadOlderMessages = async () => {
        if (
          !canLoadOlderMessages ||
          !onLoadOlderMessages ||
          isPaginatingBackwardsRef.current ||
          scrollHost.scrollTop > LOAD_OLDER_THRESHOLD_PX
        ) {
          return;
        }

        isPaginatingBackwardsRef.current = true;
        pendingPrependAnchorRef.current = {
          scrollHeight: scrollHost.scrollHeight,
          scrollTop: scrollHost.scrollTop,
        };

        try {
          await onLoadOlderMessages();
        } catch {
          isPaginatingBackwardsRef.current = false;
          pendingPrependAnchorRef.current = null;
        }
      };

      const handleScroll = () => {
        updateScrollState();
        void loadOlderMessages();
      };

      updateScrollState();
      scrollHost.addEventListener('scroll', handleScroll, { passive: true });
      cleanup = () => {
        scrollHost.removeEventListener('scroll', handleScroll);
      };
    };

    void attachScrollListener();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [
    canLoadOlderMessages,
    contentRef,
    onLoadOlderMessages,
    roomId,
    scrollElementRef,
  ]);

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

    if (isPaginatingBackwardsRef.current) {
      if (isLoadingOlderMessages) {
        return;
      }

      const pendingPrependAnchor = pendingPrependAnchorRef.current;
      if (pendingPrependAnchor && scrollHost) {
        restorePrependScrollPosition(scrollHost, pendingPrependAnchor);
        lastScrollTopRef.current = scrollHost.scrollTop;
      }

      isPaginatingBackwardsRef.current = false;
      pendingPrependAnchorRef.current = null;
      return;
    }

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
  }, [
    isLoadingOlderMessages,
    messageKeys,
    messageSignature,
    roomId,
    scrollToLatest,
  ]);

  return {
    showJumpToLatest,
  };
}
