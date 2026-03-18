/// <reference types="jest" />

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  isEditableShortcutTarget,
  matchesShortcut,
} from '../keyboardShortcuts';
import { useDesktopRoomShell } from '../useDesktopRoomShell';
import { useDesktopRoomShortcuts } from '../useDesktopRoomShortcuts';

jest.mock('../../../lib/desktopShell', () => ({
  loadDesktopLastSelection: () => ({
    lastHubId: null,
    lastRoomId: null,
  }),
  saveDesktopLastSelection: jest.fn(),
}));

function expectText(testId: string, value: string) {
  expect(screen.getByTestId(testId).textContent).toBe(value);
}

function ShortcutHarness({
  showBlockingDialog = false,
}: {
  showBlockingDialog?: boolean;
}) {
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false);
  const shell = useDesktopRoomShell({
    isDesktopLayout: true,
    showDesktopSidebar: true,
    roomId: '!room:example.com',
    tangentSpaceId: '!space:example.com',
    userId: '@me:example.com',
    bootstrapUserId: '@me:example.com',
  });

  useDesktopRoomShortcuts({
    context: {
      isDesktopActive: true,
      showShortcutOverlay,
      showDesktopRailMenu: shell.showDesktopRailMenu,
      desktopRailView: shell.desktopRailView,
      desktopSettingsSection: shell.desktopSettingsSection,
      desktopRoomPanelView: shell.desktopRoomPanelView,
      openShortcutOverlay: () => setShowShortcutOverlay(true),
      closeShortcutOverlay: () => setShowShortcutOverlay(false),
      openDesktopSettingsRoot: shell.openDesktopSettings,
      closeDesktopRailMenu: shell.closeDesktopRailMenu,
      stepBackDesktopRail: shell.stepBackDesktopRail,
      stepBackOrCloseDesktopRoomPanel: shell.stepBackOrCloseDesktopRoomPanel,
    },
  });

  return (
    <div>
      <div data-testid="rail-view">{shell.desktopRailView}</div>
      <div data-testid="settings-section">{shell.desktopSettingsSection}</div>
      <div data-testid="room-panel">{shell.desktopRoomPanelView ?? 'closed'}</div>
      <div data-testid="room-panel-width">{String(shell.desktopRoomPanelWidth)}</div>
      <div data-testid="rail-menu">{shell.showDesktopRailMenu ? 'open' : 'closed'}</div>
      <div data-testid="shortcut-overlay">{showShortcutOverlay ? 'open' : 'closed'}</div>

      <button type="button" onClick={() => shell.setShowDesktopRailMenu(true)}>
        Open rail menu
      </button>
      <button type="button" onClick={() => setShowShortcutOverlay(true)}>
        Open shortcuts
      </button>
      <button type="button" onClick={() => shell.setDesktopRoomPanelView('search')}>
        Open search panel
      </button>
      <button type="button" onClick={() => shell.openDesktopThreadPanel('$thread-root')}>
        Open thread panel
      </button>
      <button
        type="button"
        onClick={() => shell.setIsResizingDesktopRoomPanel(true)}
      >
        Start right resize
      </button>
      <button type="button" onClick={() => shell.setDesktopRoomPanelView('details')}>
        Open details panel
      </button>
      <button
        type="button"
        onClick={() => {
          shell.openDesktopSettings();
          shell.setDesktopSettingsSection('notifications');
        }}
      >
        Open nested settings
      </button>
      <button
        type="button"
        onClick={() => {
          shell.openDesktopSettings();
          shell.navigateDesktopSettingsSection('account');
        }}
      >
        Open account
      </button>
      <button
        type="button"
        onClick={() => {
          shell.navigateDesktopSettingsSection('profile');
        }}
      >
        Open profile
      </button>
      <button type="button" onClick={() => shell.openDesktopContacts()}>
        Open contacts
      </button>
      <input aria-label="Editable field" />

      {showShortcutOverlay ? (
        <div role="dialog" aria-modal="true" data-shortcuts-overlay="true">
          Keyboard shortcuts
        </div>
      ) : null}
      {showBlockingDialog ? (
        <div role="dialog" aria-modal="true" data-blocking-dialog="true">
          Blocking dialog
        </div>
      ) : null}
    </div>
  );
}

describe('desktop keyboard shortcuts', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('matches ctrl/cmd comma shortcuts and ignores editable targets', () => {
    const shortcutEvent = new KeyboardEvent('keydown', {
      key: ',',
      ctrlKey: true,
    });
    const input = document.createElement('input');
    const contentEditable = document.createElement('div');
    contentEditable.setAttribute('contenteditable', 'true');

    expect(
      matchesShortcut(shortcutEvent, {
        id: 'open-settings',
        label: 'Open settings',
        shortcutDisplay: 'Ctrl/Cmd + ,',
        category: 'Desktop shell',
        desktopOnly: true,
        key: ',',
        mod: true,
        when: () => true,
        run: () => undefined,
      })
    ).toBe(true);
    expect(isEditableShortcutTarget(input)).toBe(true);
    expect(isEditableShortcutTarget(contentEditable)).toBe(true);
    expect(isEditableShortcutTarget(document.body)).toBe(false);
  });

  it('closes the rail menu before the shortcuts overlay on escape', () => {
    render(<ShortcutHarness />);

    fireEvent.click(screen.getByText('Open rail menu'));
    fireEvent.click(screen.getByText('Open shortcuts'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expectText('rail-menu', 'closed');
    expectText('shortcut-overlay', 'open');

    fireEvent.keyDown(document, { key: 'Escape' });
    expectText('shortcut-overlay', 'closed');
  });

  it('closes the right panel in a single escape press', () => {
    render(<ShortcutHarness />);

    fireEvent.click(screen.getByText('Open search panel'));
    expectText('room-panel', 'search');

    fireEvent.keyDown(document, { key: 'Escape' });
    expectText('room-panel', 'closed');
  });

  it('closes the desktop thread panel in a single escape press', () => {
    render(<ShortcutHarness />);

    fireEvent.click(screen.getByText('Open thread panel'));
    expectText('room-panel', 'thread');

    fireEvent.keyDown(document, { key: 'Escape' });
    expectText('room-panel', 'closed');
  });

  it('updates the right panel width while resizing', () => {
    render(<ShortcutHarness />);

    expectText('room-panel-width', '360');

    fireEvent.click(screen.getByText('Start right resize'));
    const moveEvent = new Event('pointermove');
    Object.defineProperty(moveEvent, 'clientX', {
      value: window.innerWidth - 420,
    });
    act(() => {
      window.dispatchEvent(moveEvent);
      window.dispatchEvent(new Event('pointerup'));
    });

    expectText('room-panel-width', '420');
  });

  it('steps nested settings back to the root and then returns to topics on escape', () => {
    render(<ShortcutHarness />);

    fireEvent.click(screen.getByText('Open nested settings'));
    expectText('rail-view', 'settings');
    expectText('settings-section', 'notifications');

    fireEvent.keyDown(document, { key: 'Escape' });
    expectText('rail-view', 'settings');
    expectText('settings-section', 'menu');

    fireEvent.keyDown(document, { key: 'Escape' });
    expectText('rail-view', 'topics');
  });

  it('returns profile to the immediate prior settings section on escape', () => {
    render(<ShortcutHarness />);

    fireEvent.click(screen.getByText('Open account'));
    expectText('settings-section', 'account');

    fireEvent.click(screen.getByText('Open profile'));
    expectText('rail-view', 'settings');
    expectText('settings-section', 'profile');

    fireEvent.keyDown(document, { key: 'Escape' });
    expectText('rail-view', 'settings');
    expectText('settings-section', 'account');
  });

  it('returns contacts to topics on escape', () => {
    render(<ShortcutHarness />);

    fireEvent.click(screen.getByText('Open contacts'));
    expectText('rail-view', 'contacts');

    fireEvent.keyDown(document, { key: 'Escape' });
    expectText('rail-view', 'topics');
  });

  it('opens settings with ctrl/cmd comma', () => {
    render(<ShortcutHarness />);

    fireEvent.keyDown(document, { key: ',', ctrlKey: true });
    expectText('rail-view', 'settings');
    expectText('settings-section', 'menu');
  });

  it('opens the shortcuts overlay with question mark and ignores editable fields', () => {
    render(<ShortcutHarness />);

    fireEvent.keyDown(document, { key: '?' });
    expectText('shortcut-overlay', 'open');

    fireEvent.keyDown(document, { key: 'Escape' });
    expectText('shortcut-overlay', 'closed');

    const input = screen.getByLabelText('Editable field');
    act(() => {
      input.focus();
    });
    fireEvent.keyDown(input, { key: '?' });
    expectText('shortcut-overlay', 'closed');
  });

  it('does not override escape while another modal dialog is open', () => {
    render(<ShortcutHarness showBlockingDialog />);

    fireEvent.click(screen.getByText('Open search panel'));
    expectText('room-panel', 'search');

    fireEvent.keyDown(document, { key: 'Escape' });
    expectText('room-panel', 'search');
  });
});
