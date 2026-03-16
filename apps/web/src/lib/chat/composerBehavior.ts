export function prefersDesktopComposerShortcuts() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }

  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function shouldSubmitComposerOnEnter({
  key,
  shiftKey,
  isComposing,
}: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}) {
  if (key !== 'Enter' || shiftKey || isComposing) {
    return false;
  }

  return prefersDesktopComposerShortcuts();
}
