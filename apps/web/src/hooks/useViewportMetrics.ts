import { useEffect } from 'react';

function getViewportHeight() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.visualViewport?.height ?? window.innerHeight;
}

export function useViewportMetrics() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const root = document.documentElement;

    const updateViewportMetrics = () => {
      const viewportHeight = getViewportHeight();
      if (viewportHeight === null) {
        return;
      }

      root.style.setProperty('--app-viewport-height', `${viewportHeight}px`);
    };

    updateViewportMetrics();

    window.addEventListener('resize', updateViewportMetrics);
    window.visualViewport?.addEventListener('resize', updateViewportMetrics);
    window.visualViewport?.addEventListener('scroll', updateViewportMetrics);

    return () => {
      window.removeEventListener('resize', updateViewportMetrics);
      window.visualViewport?.removeEventListener(
        'resize',
        updateViewportMetrics
      );
      window.visualViewport?.removeEventListener(
        'scroll',
        updateViewportMetrics
      );
    };
  }, []);
}
