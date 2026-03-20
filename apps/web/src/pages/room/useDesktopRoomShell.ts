import { useCallback, useEffect, useState } from 'react';
import {
  loadDesktopLastSelection,
  saveDesktopRailState,
  saveDesktopLastSelection,
} from '../../lib/desktopShell';
import { loadPersistedValue, savePersistedValue } from '../../lib/persistence';
import type { DesktopRoomPanelView } from './DesktopRoomPanel';
import type { DesktopDirectoryView } from './DesktopDirectoryPanel';
import type { DesktopSettingsSection } from './DesktopSettingsPanel';

const DESKTOP_RAIL_WIDTH_KEY = 'desktop-room-rail-width';
const DESKTOP_ROOM_PANEL_WIDTH_KEY = 'desktop-room-panel-width';
const DESKTOP_RAIL_STATE_KEY = 'desktop-room-rail-state';
const MIN_DESKTOP_RAIL_WIDTH = 280;
const MAX_DESKTOP_RAIL_WIDTH = 460;
const MIN_DESKTOP_ROOM_PANEL_WIDTH = 320;
const MAX_DESKTOP_ROOM_PANEL_WIDTH = 560;

export type DesktopRailView = 'topics' | 'settings' | DesktopDirectoryView;

interface PersistedDesktopRailState {
  railView: DesktopRailView;
  settingsSection: DesktopSettingsSection;
  settingsHistory: DesktopSettingsSection[];
}

interface UseDesktopRoomShellOptions {
  isDesktopLayout: boolean;
  showDesktopSidebar: boolean;
  roomId: string | null;
  tangentSpaceId: string | null;
  userId: string | null | undefined;
  bootstrapUserId: string | null | undefined;
}

function clampDesktopRailWidth(width: number) {
  return Math.min(MAX_DESKTOP_RAIL_WIDTH, Math.max(MIN_DESKTOP_RAIL_WIDTH, width));
}

function clampDesktopRoomPanelWidth(width: number) {
  return Math.min(
    MAX_DESKTOP_ROOM_PANEL_WIDTH,
    Math.max(MIN_DESKTOP_ROOM_PANEL_WIDTH, width)
  );
}

function getDesktopRailStateStorageKey(userId: string | null | undefined) {
  return userId ? `${DESKTOP_RAIL_STATE_KEY}:${userId}` : null;
}

function isDesktopRailView(value: unknown): value is DesktopRailView {
  return (
    value === 'topics' ||
    value === 'settings' ||
    value === 'contacts' ||
    value === 'other' ||
    value === 'hubs' ||
    value === 'add-contact'
  );
}

function isDesktopSettingsSection(value: unknown): value is DesktopSettingsSection {
  return (
    value === 'menu' ||
    value === 'profile' ||
    value === 'notifications' ||
    value === 'encryption' ||
    value === 'account' ||
    value === 'devices' ||
    value === 'unverified-devices' ||
    value === 'chat-appearance'
  );
}

function sanitizePersistedDesktopRailState(
  value: PersistedDesktopRailState | null
): PersistedDesktopRailState | null {
  if (!value || !isDesktopRailView(value.railView)) {
    return null;
  }

  const settingsSection = isDesktopSettingsSection(value.settingsSection)
    ? value.settingsSection
    : 'menu';
  const settingsHistory = Array.isArray(value.settingsHistory)
    ? value.settingsHistory.filter(isDesktopSettingsSection)
    : [];

  return {
    railView: value.railView,
    settingsSection,
    settingsHistory,
  };
}

function resolveDesktopRailViewForRoom(params: {
  isDesktopLayout: boolean;
  roomId: string | null;
  tangentSpaceId: string | null;
  railView: DesktopRailView;
}) {
  const { isDesktopLayout, roomId, tangentSpaceId, railView } = params;
  if (!isDesktopLayout || !roomId) {
    return railView;
  }

  if (tangentSpaceId) {
    return railView === 'other' ? 'topics' : railView;
  }

  return railView === 'topics' ? 'other' : railView;
}

export function useDesktopRoomShell({
  isDesktopLayout,
  showDesktopSidebar,
  roomId,
  tangentSpaceId,
  userId,
  bootstrapUserId,
}: UseDesktopRoomShellOptions) {
  const persistedUserId = userId ?? bootstrapUserId;
  const desktopRailStateStorageKey = getDesktopRailStateStorageKey(persistedUserId);
  const [desktopRailView, setDesktopRailView] = useState<DesktopRailView>('topics');
  const [desktopSettingsSection, setDesktopSettingsSection] =
    useState<DesktopSettingsSection>('menu');
  const [desktopSettingsHistory, setDesktopSettingsHistory] = useState<
    DesktopSettingsSection[]
  >([]);
  const [desktopRailSearchQuery, setDesktopRailSearchQuery] = useState('');
  const [showDesktopRailMenu, setShowDesktopRailMenu] = useState(false);
  const [desktopRoomPanelView, setDesktopRoomPanelView] =
    useState<DesktopRoomPanelView | null>(null);
  const [desktopThreadRootId, setDesktopThreadRootId] = useState<string | null>(
    null
  );
  const [desktopRailWidth, setDesktopRailWidth] = useState(() => {
    const savedWidth = loadPersistedValue<number>(DESKTOP_RAIL_WIDTH_KEY);
    if (typeof savedWidth !== 'number' || Number.isNaN(savedWidth)) {
      return 320;
    }

    return clampDesktopRailWidth(savedWidth);
  });
  const [desktopRoomPanelWidth, setDesktopRoomPanelWidth] = useState(() => {
    const savedWidth = loadPersistedValue<number>(DESKTOP_ROOM_PANEL_WIDTH_KEY);
    if (typeof savedWidth !== 'number' || Number.isNaN(savedWidth)) {
      return 360;
    }

    return clampDesktopRoomPanelWidth(savedWidth);
  });
  const [isResizingDesktopRail, setIsResizingDesktopRail] = useState(false);
  const [isResizingDesktopRoomPanel, setIsResizingDesktopRoomPanel] =
    useState(false);

  useEffect(() => {
    if (!showDesktopSidebar && desktopRailView === 'topics') {
      setDesktopRailView('topics');
      setDesktopSettingsSection('menu');
      setDesktopSettingsHistory([]);
      setDesktopRailSearchQuery('');
      setShowDesktopRailMenu(false);
    }
  }, [desktopRailView, showDesktopSidebar]);

  useEffect(() => {
    if (!isDesktopLayout) {
      setDesktopRoomPanelView(null);
      setDesktopThreadRootId(null);
    }
  }, [isDesktopLayout]);

  useEffect(() => {
    if (!isDesktopLayout || !roomId) {
      return;
    }
    setDesktopRailView((currentView) =>
      resolveDesktopRailViewForRoom({
        isDesktopLayout,
        roomId,
        tangentSpaceId,
        railView: currentView,
      })
    );
  }, [isDesktopLayout, roomId, tangentSpaceId]);

  useEffect(() => {
    setDesktopThreadRootId(null);
    setDesktopRoomPanelView((currentView) =>
      currentView === 'thread' ? null : currentView
    );
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !tangentSpaceId) {
      return;
    }

    saveDesktopLastSelection({
      userId: userId ?? bootstrapUserId,
      spaceId: tangentSpaceId,
      roomId,
    });
  }, [bootstrapUserId, roomId, tangentSpaceId, userId]);

  useEffect(() => {
    savePersistedValue(DESKTOP_RAIL_WIDTH_KEY, desktopRailWidth);
  }, [desktopRailWidth]);

  useEffect(() => {
    savePersistedValue(DESKTOP_ROOM_PANEL_WIDTH_KEY, desktopRoomPanelWidth);
  }, [desktopRoomPanelWidth]);

  useEffect(() => {
    if (!desktopRailStateStorageKey || !isDesktopLayout) {
      return;
    }

    const persistedState = sanitizePersistedDesktopRailState(
      loadPersistedValue<PersistedDesktopRailState>(desktopRailStateStorageKey)
    );
    if (!persistedState) {
      return;
    }

    setDesktopRailView(
      resolveDesktopRailViewForRoom({
        isDesktopLayout,
        roomId,
        tangentSpaceId,
        railView: persistedState.railView,
      })
    );
    setDesktopSettingsSection(persistedState.settingsSection);
    setDesktopSettingsHistory(persistedState.settingsHistory);
  }, [desktopRailStateStorageKey, isDesktopLayout, roomId, tangentSpaceId]);

  useEffect(() => {
    if (!desktopRailStateStorageKey || !isDesktopLayout) {
      return;
    }

    saveDesktopRailState({
      userId: persistedUserId,
      railView: desktopRailView,
      settingsSection: desktopSettingsSection,
      settingsHistory: desktopSettingsHistory,
    });
  }, [
    desktopRailStateStorageKey,
    desktopRailView,
    desktopSettingsHistory,
    desktopSettingsSection,
    isDesktopLayout,
    persistedUserId,
  ]);

  useEffect(() => {
    if (!isResizingDesktopRail) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setDesktopRailWidth(clampDesktopRailWidth(event.clientX));
    };

    const stopResizing = () => {
      setIsResizingDesktopRail(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
    };
  }, [isResizingDesktopRail]);

  useEffect(() => {
    if (!isResizingDesktopRoomPanel) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setDesktopRoomPanelWidth(
        clampDesktopRoomPanelWidth(window.innerWidth - event.clientX)
      );
    };

    const stopResizing = () => {
      setIsResizingDesktopRoomPanel(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
    };
  }, [isResizingDesktopRoomPanel]);

  const persistedDesktopSelection = loadDesktopLastSelection(userId ?? bootstrapUserId);

  const openDesktopContacts = useCallback(() => {
    setShowDesktopRailMenu(false);
    setDesktopRailView('contacts');
  }, []);

  const openDesktopAddContact = useCallback(() => {
    setShowDesktopRailMenu(false);
    setDesktopRailView('add-contact');
  }, []);

  const openDesktopHubs = useCallback(() => {
    setShowDesktopRailMenu(false);
    setDesktopRailView('hubs');
  }, []);

  const openDesktopOtherRooms = useCallback(() => {
    setShowDesktopRailMenu(false);
    setDesktopRailView('other');
  }, []);

  const openDesktopSettings = useCallback(() => {
    setShowDesktopRailMenu(false);
    setDesktopSettingsSection('menu');
    setDesktopSettingsHistory([]);
    setDesktopRailView('settings');
  }, []);

  const navigateDesktopSettingsSection = useCallback(
    (section: Exclude<DesktopSettingsSection, 'menu'>) => {
      setDesktopSettingsHistory((currentHistory) => {
        if (desktopSettingsSection === section) {
          return currentHistory;
        }

        return [...currentHistory, desktopSettingsSection];
      });
      setDesktopSettingsSection(section);
      setDesktopRailView('settings');
    },
    [desktopSettingsSection]
  );

  const closeDesktopRailMenu = useCallback(() => {
    setShowDesktopRailMenu(false);
  }, []);

  const handleDesktopRailBack = useCallback(() => {
    if (
      desktopRailView === 'contacts' ||
      desktopRailView === 'other' ||
      desktopRailView === 'hubs' ||
      desktopRailView === 'add-contact'
    ) {
      setDesktopRailView('topics');
      return;
    }

    if (desktopSettingsSection === 'menu') {
      setDesktopRailView('topics');
      return;
    }

    setDesktopSettingsHistory((currentHistory) => {
      const previousSection = currentHistory[currentHistory.length - 1] ?? 'menu';
      setDesktopSettingsSection(previousSection);
      return currentHistory.slice(0, -1);
    });
  }, [desktopRailView, desktopSettingsSection]);

  const stepBackDesktopRail = useCallback(() => {
    if (
      desktopRailView === 'contacts' ||
      desktopRailView === 'other' ||
      desktopRailView === 'hubs' ||
      desktopRailView === 'add-contact'
    ) {
      setDesktopRailView('topics');
      return true;
    }

    if (desktopRailView === 'settings' && desktopSettingsSection !== 'menu') {
      setDesktopSettingsHistory((currentHistory) => {
        const previousSection = currentHistory[currentHistory.length - 1] ?? 'menu';
        setDesktopSettingsSection(previousSection);
        return currentHistory.slice(0, -1);
      });
      return true;
    }

    if (desktopRailView === 'settings') {
      setDesktopRailView('topics');
      return true;
    }

    return false;
  }, [desktopRailView, desktopSettingsSection]);

  const openDesktopEditPanel = useCallback(() => {
    setDesktopThreadRootId(null);
    setDesktopRoomPanelView('edit');
  }, []);

  const openDesktopPinsPanel = useCallback(() => {
    setDesktopThreadRootId(null);
    setDesktopRoomPanelView('pins');
  }, []);

  const openDesktopSearchPanel = useCallback(() => {
    setDesktopThreadRootId(null);
    setDesktopRoomPanelView('search');
  }, []);

  const openDesktopDetailsPanel = useCallback(() => {
    setDesktopThreadRootId(null);
    setDesktopRoomPanelView('details');
  }, []);

  const openDesktopThreadPanel = useCallback((threadRootId: string) => {
    setDesktopThreadRootId(threadRootId);
    setDesktopRoomPanelView('thread');
  }, []);

  const closeDesktopRoomPanel = useCallback(() => {
    setDesktopThreadRootId(null);
    setDesktopRoomPanelView(null);
  }, []);

  const backToDesktopRoomDetails = useCallback(() => {
    setDesktopThreadRootId(null);
    setDesktopRoomPanelView((currentView) =>
      currentView === 'thread' ? null : 'details'
    );
  }, []);

  const stepBackOrCloseDesktopRoomPanel = useCallback(() => {
    if (desktopRoomPanelView !== null) {
      setDesktopThreadRootId(null);
      setDesktopRoomPanelView(null);
      return true;
    }

    return false;
  }, [desktopRoomPanelView]);

  return {
    persistedDesktopSelection,
    desktopRailView,
    setDesktopRailView,
    desktopSettingsSection,
    setDesktopSettingsSection,
    navigateDesktopSettingsSection,
    desktopRailSearchQuery,
    setDesktopRailSearchQuery,
    showDesktopRailMenu,
    setShowDesktopRailMenu,
    desktopRoomPanelView,
    desktopThreadRootId,
    setDesktopRoomPanelView,
    desktopRailWidth,
    desktopRoomPanelWidth,
    isResizingDesktopRail,
    isResizingDesktopRoomPanel,
    setIsResizingDesktopRail,
    setIsResizingDesktopRoomPanel,
    openDesktopContacts,
    openDesktopAddContact,
    openDesktopHubs,
    openDesktopOtherRooms,
    openDesktopSettings,
    closeDesktopRailMenu,
    handleDesktopRailBack,
    stepBackDesktopRail,
    openDesktopEditPanel,
    openDesktopPinsPanel,
    openDesktopSearchPanel,
    openDesktopDetailsPanel,
    openDesktopThreadPanel,
    closeDesktopRoomPanel,
    backToDesktopRoomDetails,
    stepBackOrCloseDesktopRoomPanel,
  };
}
