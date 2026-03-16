export const MODAL_SHEET_DISMISS_THRESHOLD = 120;

export function clampSheetOffset(offset: number) {
  return Math.max(0, offset);
}

export function shouldDismissSheet(offset: number) {
  return clampSheetOffset(offset) >= MODAL_SHEET_DISMISS_THRESHOLD;
}
