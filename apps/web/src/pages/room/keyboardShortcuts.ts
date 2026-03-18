import type { DesktopRoomPanelView } from './DesktopRoomPanel';
import type { DesktopRailView } from './useDesktopRoomShell';
import type { DesktopSettingsSection } from './DesktopSettingsPanel';

export interface DesktopShortcutContext {
  isDesktopActive: boolean;
  showShortcutOverlay: boolean;
  showDesktopRailMenu: boolean;
  desktopRailView: DesktopRailView;
  desktopSettingsSection: DesktopSettingsSection;
  desktopRoomPanelView: DesktopRoomPanelView | null;
  openShortcutOverlay: () => void;
  closeShortcutOverlay: () => void;
  openDesktopSettingsRoot: () => void;
  closeDesktopRailMenu: () => void;
  stepBackDesktopRail: () => boolean;
  stepBackOrCloseDesktopRoomPanel: () => boolean;
}

export interface ShortcutDefinition {
  id: string;
  label: string;
  shortcutDisplay: string;
  category: string;
  desktopOnly: boolean;
  key: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  when: (context: DesktopShortcutContext) => boolean;
  run: (context: DesktopShortcutContext) => void;
}

export const DESKTOP_SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: 'open-settings',
    label: 'Open settings',
    shortcutDisplay: 'Ctrl/Cmd + ,',
    category: 'Desktop shell',
    desktopOnly: true,
    key: ',',
    mod: true,
    when: (context) => context.isDesktopActive,
    run: (context) => {
      context.openDesktopSettingsRoot();
    },
  },
  {
    id: 'show-shortcuts',
    label: 'Show keyboard shortcuts',
    shortcutDisplay: '?',
    category: 'Desktop shell',
    desktopOnly: true,
    key: '?',
    when: (context) => context.isDesktopActive,
    run: (context) => {
      context.openShortcutOverlay();
    },
  },
  {
    id: 'escape',
    label: 'Close or go back',
    shortcutDisplay: 'Esc',
    category: 'Desktop shell',
    desktopOnly: true,
    key: 'Escape',
    when: (context) => context.isDesktopActive,
    run: (context) => {
      handleDesktopEscape(context);
    },
  },
];

export function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]')
  );
}

export function matchesShortcut(
  event: KeyboardEvent,
  definition: ShortcutDefinition
) {
  const matchesMod = Boolean(definition.mod) === Boolean(event.metaKey || event.ctrlKey);
  const matchesShift = Boolean(definition.shift) === Boolean(event.shiftKey);
  const matchesAlt = Boolean(definition.alt) === Boolean(event.altKey);

  return (
    event.key === definition.key &&
    matchesMod &&
    matchesShift &&
    matchesAlt
  );
}

export function hasBlockingDialogOpen(documentRef: Document) {
  return Boolean(
    documentRef.querySelector(
      '[data-blocking-dialog="true"]:not([data-shortcuts-overlay="true"])'
    )
  );
}

export function handleDesktopEscape(context: DesktopShortcutContext) {
  if (context.showDesktopRailMenu) {
    context.closeDesktopRailMenu();
    return true;
  }

  if (context.showShortcutOverlay) {
    context.closeShortcutOverlay();
    return true;
  }

  if (context.stepBackOrCloseDesktopRoomPanel()) {
    return true;
  }

  if (context.stepBackDesktopRail()) {
    return true;
  }

  return false;
}
