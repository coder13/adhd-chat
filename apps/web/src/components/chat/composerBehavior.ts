export function prefersDesktopComposerShortcuts() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }

  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function shouldSubmitComposerOnEnter(options: {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
}) {
  if (options.key !== 'Enter' || options.shiftKey || options.isComposing) {
    return false;
  }

  return prefersDesktopComposerShortcuts();
}
