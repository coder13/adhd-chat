import { DESKTOP_SHORTCUT_DEFINITIONS } from './keyboardShortcuts';

interface KeyboardShortcutsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsOverlay({
  isOpen,
  onClose,
}: KeyboardShortcutsOverlayProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      data-shortcuts-overlay="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-text/55"
        aria-label="Close keyboard shortcuts"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-xl rounded-[28px] border border-line bg-[var(--app-shell-background)] p-6 text-text shadow-panel">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="text-lg font-semibold">Keyboard shortcuts</div>
            <div className="mt-1 text-sm text-text-muted">
              Desktop room shell shortcuts
            </div>
          </div>
          <button
            type="button"
            className="rounded-full bg-panel px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-elevated"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="space-y-3">
          {DESKTOP_SHORTCUT_DEFINITIONS.map((shortcut) => (
            <div
              key={shortcut.id}
              className="flex items-center justify-between gap-4 rounded-[22px] border border-line bg-panel px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">
                  {shortcut.label}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  {shortcut.category}
                </div>
              </div>
              <kbd className="rounded-full border border-line/70 bg-panel px-3 py-1 text-xs font-medium text-text">
                {shortcut.shortcutDisplay}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
