export interface PrependScrollAnchor {
  scrollHeight: number;
  scrollTop: number;
}

export function restorePrependScrollPosition(
  scrollHost: HTMLElement,
  anchor: PrependScrollAnchor
) {
  const scrollDelta = scrollHost.scrollHeight - anchor.scrollHeight;
  scrollHost.scrollTop = anchor.scrollTop + scrollDelta;
  return scrollHost.scrollTop;
}
