import { useEffect } from 'react';
import {
  DESKTOP_SHORTCUT_DEFINITIONS,
  hasBlockingDialogOpen,
  isEditableShortcutTarget,
  matchesShortcut,
  type DesktopShortcutContext,
} from './keyboardShortcuts';

interface UseDesktopRoomShortcutsOptions {
  context: DesktopShortcutContext;
}

export function useDesktopRoomShortcuts({
  context,
}: UseDesktopRoomShortcutsOptions) {
  useEffect(() => {
    if (!context.isDesktopActive) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const nextContext = {
        ...context,
        showShortcutOverlay: context.showShortcutOverlay,
      };

      if (
        hasBlockingDialogOpen(document) &&
        !nextContext.showShortcutOverlay
      ) {
        return;
      }

      const isEditableTarget = isEditableShortcutTarget(event.target);

      for (const definition of DESKTOP_SHORTCUT_DEFINITIONS) {
        if (!matchesShortcut(event, definition)) {
          continue;
        }

        if (definition.key !== 'Escape' && isEditableTarget) {
          return;
        }

        if (!definition.when(nextContext)) {
          return;
        }

        event.preventDefault();
        definition.run(nextContext);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [context]);
}
