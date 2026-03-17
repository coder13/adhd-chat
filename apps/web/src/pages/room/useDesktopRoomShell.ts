import { useCallback, useEffect, useState } from 'react';
import {
  loadDesktopLastSelection,
  saveDesktopLastSelection,
} from '../../lib/desktopShell';
import { loadPersistedValue, savePersistedValue } from '../../lib/persistence';
import type { DesktopRoomPanelView } from './DesktopRoomPanel';
import type { DesktopDirectoryView } from './DesktopDirectoryPanel';
import type { DesktopSettingsSection } from './DesktopSettingsPanel';

const DESKTOP_RAIL_WIDTH_KEY = 'desktop-room-rail-width';
const MIN_DESKTOP_RAIL_WIDTH = 280;
const MAX_DESKTOP_RAIL_WIDTH = 460;

export type DesktopRailView = 'topics' | 'settings' | DesktopDirectoryView;

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

export function useDesktopRoomShell({
  isDesktopLayout,
  showDesktopSidebar,
  roomId,
  tangentSpaceId,
  userId,
  bootstrapUserId,
}: UseDesktopRoomShellOptions) {
  const [desktopRailView, setDesktopRailView] = useState<DesktopRailView>('topics');
  const [desktopSettingsSection, setDesktopSettingsSection] =
    useState<DesktopSettingsSection>('menu');
  const [desktopRailSearchQuery, setDesktopRailSearchQuery] = useState('');
  const [showDesktopRailMenu, setShowDesktopRailMenu] = useState(false);
  const [desktopRoomPanelView, setDesktopRoomPanelView] =
    useState<DesktopRoomPanelView | null>(null);
  const [desktopRailWidth, setDesktopRailWidth] = useState(() => {
    const savedWidth = loadPersistedValue<number>(DESKTOP_RAIL_WIDTH_KEY);
    if (typeof savedWidth !== 'number' || Number.isNaN(savedWidth)) {
      return 320;
    }

    return clampDesktopRailWidth(savedWidth);
  });
  const [isResizingDesktopRail, setIsResizingDesktopRail] = useState(false);

  useEffect(() => {
    if (!showDesktopSidebar) {
      setDesktopRailView('topics');
      setDesktopSettingsSection('menu');
      setDesktopRailSearchQuery('');
      setShowDesktopRailMenu(false);
    }
  }, [showDesktopSidebar]);

  useEffect(() => {
    if (!isDesktopLayout) {
      setDesktopRoomPanelView(null);
    }
  }, [isDesktopLayout]);

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

  const persistedDesktopSelection = loadDesktopLastSelection(userId ?? bootstrapUserId);

  const openDesktopContacts = useCallback(() => {
    setShowDesktopRailMenu(false);
    setDesktopRailView('contacts');
  }, []);

  const openDesktopOtherRooms = useCallback(() => {
    setShowDesktopRailMenu(false);
    setDesktopRailView('other');
  }, []);

  const openDesktopSettings = useCallback(() => {
    setShowDesktopRailMenu(false);
    setDesktopSettingsSection('menu');
    setDesktopRailView('settings');
  }, []);

  const handleDesktopRailBack = useCallback(() => {
    if (desktopRailView === 'contacts' || desktopRailView === 'other') {
      setDesktopRailView('topics');
      return;
    }

    if (desktopSettingsSection === 'menu') {
      setDesktopRailView('topics');
      return;
    }

    setDesktopSettingsSection('menu');
  }, [desktopRailView, desktopSettingsSection]);

  const openDesktopEditPanel = useCallback(() => {
    setDesktopRoomPanelView('edit');
  }, []);

  const openDesktopPinsPanel = useCallback(() => {
    setDesktopRoomPanelView('pins');
  }, []);

  const openDesktopSearchPanel = useCallback(() => {
    setDesktopRoomPanelView('search');
  }, []);

  const openDesktopDetailsPanel = useCallback(() => {
    setDesktopRoomPanelView('details');
  }, []);

  const closeDesktopRoomPanel = useCallback(() => {
    setDesktopRoomPanelView(null);
  }, []);

  const backToDesktopRoomDetails = useCallback(() => {
    setDesktopRoomPanelView('details');
  }, []);

  return {
    persistedDesktopSelection,
    desktopRailView,
    setDesktopRailView,
    desktopSettingsSection,
    setDesktopSettingsSection,
    desktopRailSearchQuery,
    setDesktopRailSearchQuery,
    showDesktopRailMenu,
    setShowDesktopRailMenu,
    desktopRoomPanelView,
    setDesktopRoomPanelView,
    desktopRailWidth,
    isResizingDesktopRail,
    setIsResizingDesktopRail,
    openDesktopContacts,
    openDesktopOtherRooms,
    openDesktopSettings,
    handleDesktopRailBack,
    openDesktopEditPanel,
    openDesktopPinsPanel,
    openDesktopSearchPanel,
    openDesktopDetailsPanel,
    closeDesktopRoomPanel,
    backToDesktopRoomDetails,
  };
}
