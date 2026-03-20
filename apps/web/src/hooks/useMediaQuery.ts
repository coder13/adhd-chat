import { useEffect, useRef, useState } from 'react';
import { recordLayoutDebugEvent } from '../lib/layoutDebug';

function getMatch(query: string) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => getMatch(query));
  const previousStateRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const updateMatch = () => {
      setMatches(mediaQuery.matches);
    };

    updateMatch();
    mediaQuery.addEventListener('change', updateMatch);

    return () => {
      mediaQuery.removeEventListener('change', updateMatch);
    };
  }, [query]);

  useEffect(() => {
    const width =
      typeof window !== 'undefined' ? window.innerWidth : null;
    const mode =
      query === '(min-width: 1280px)'
        ? matches
          ? 'desktop'
          : 'mobile'
        : null;
    const nextState = JSON.stringify({
      matches,
      mode,
      query,
      width,
    });

    if (previousStateRef.current === nextState) {
      return;
    }

    previousStateRef.current = nextState;
    recordLayoutDebugEvent('useMediaQuery.state', {
      matches,
      mode,
      query,
      width,
    });
  }, [matches, query]);

  return matches;
}
