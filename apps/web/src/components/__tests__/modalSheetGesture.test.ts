/// <reference types="jest" />

import {
  clampSheetOffset,
  MODAL_SHEET_DISMISS_THRESHOLD,
  shouldDismissSheet,
} from '../modalSheetGesture';

describe('modal sheet gesture helpers', () => {
  it('never allows a negative drag offset', () => {
    expect(clampSheetOffset(-40)).toBe(0);
    expect(clampSheetOffset(28)).toBe(28);
  });

  it('dismisses only after the threshold is reached', () => {
    expect(shouldDismissSheet(MODAL_SHEET_DISMISS_THRESHOLD - 1)).toBe(false);
    expect(shouldDismissSheet(MODAL_SHEET_DISMISS_THRESHOLD)).toBe(true);
  });
});
