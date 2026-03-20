/// <reference types="jest" />

import { TextDecoder, TextEncoder } from 'node:util';
import { render, screen } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';

globalThis.TextEncoder = TextEncoder as unknown as typeof globalThis.TextEncoder;
globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;

const mockUseMatrixClient = jest.fn();
const mockUseTandem = jest.fn();
const mockUseChatPreferences = jest.fn();
const mockUseTandemSpaceRoomCatalogStore = jest.fn();

jest.mock('@ionic/react', () => ({
  IonActionSheet: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IonButton: ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  IonButtons: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IonHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IonIcon: () => <span />,
  IonPage: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IonToolbar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('matrix-js-sdk', () => ({
  ClientEvent: {
    Sync: 'sync',
  },
  RoomEvent: {
    Timeline: 'timeline',
    Receipt: 'receipt',
    Name: 'name',
    MyMembership: 'my_membership',
    AccountData: 'account_data',
    LocalEchoUpdated: 'local_echo_updated',
    TimelineReset: 'timeline_reset',
  },
}));

jest.mock('../../components', () => ({
  AppAvatar: ({ name }: { name: string }) => <div>{name}</div>,
  AuthFallbackState: () => <div>Auth fallback</div>,
  Button: ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  Card: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IdentityEditorModal: () => null,
  Modal: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  NotificationSettingsPanel: () => null,
  TangentModal: () => null,
}));

jest.mock('../../hooks/useMatrixClient', () => ({
  useMatrixClient: mockUseMatrixClient,
}));

jest.mock('../../hooks/useTandem', () => ({
  useTandem: mockUseTandem,
}));

jest.mock('../../hooks/useChatPreferences', () => ({
  useChatPreferences: mockUseChatPreferences,
}));

jest.mock('../../hooks/useTandemSpaceRoomCatalogStore', () => ({
  useTandemSpaceRoomCatalogStore: mockUseTandemSpaceRoomCatalogStore,
}));

jest.mock('../../lib/matrix/identity', () => ({
  getRoomIcon: () => null,
  getRoomTopic: () => null,
  updateRoomIdentity: jest.fn(),
}));

jest.mock('../../lib/matrix/chatCatalog', () => ({
  getRoomDisplayName: () => 'Restored Hub',
}));

jest.mock('../../lib/matrix/pendingTandemRoom', () => ({
  startPendingTandemRoomCreation: jest.fn(),
  subscribeToPendingTandemRooms: jest.fn(() => () => undefined),
}));

jest.mock('../../lib/matrix/tandemPresentation', () => ({
  getTandemPartnerSummary: () => ({
    userId: '@partner:example.com',
    displayName: 'Partner',
    avatarUrl: null,
  }),
}));

jest.mock('../../lib/matrix/tandem', () => ({
  ensureTandemSpaceLinks: jest.fn().mockResolvedValue(undefined),
  joinTandemRoom: jest.fn().mockResolvedValue(undefined),
}));

let MemoryRouter: ComponentType<{
  children?: ReactNode;
  initialEntries?: string[];
}>;
let Route: ComponentType<{
  element: ReactNode;
  path: string;
}>;
let Routes: ComponentType<{
  children?: ReactNode;
}>;
let TandemSpacePage: ComponentType;

describe('TandemSpacePage', () => {
  const client = {
    getRoom: jest.fn(() => null),
    mxcUrlToHttp: jest.fn(() => null),
    on: jest.fn(),
    off: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseMatrixClient.mockReturnValue({
      client,
      isReady: true,
      state: 'ready',
      user: { userId: '@me:example.com', deviceId: 'DEVICE' },
      bootstrapUserId: '@me:example.com',
    });

    mockUseTandem.mockReturnValue({
      relationships: [
        {
          sharedSpaceId: '!space:example.com',
          partnerUserId: '@partner:example.com',
          mainRoomId: '!main:example.com',
        },
      ],
    });

    mockUseChatPreferences.mockReturnValue({
      preferences: { roomNotificationOverrides: {} },
      updateRoomNotificationMode: jest.fn(),
      resolveRoomNotificationMode: jest.fn(() => 'all'),
    });
  });

  beforeAll(async () => {
    const reactRouterDomModule = await import('react-router-dom');
    MemoryRouter = reactRouterDomModule.MemoryRouter;
    Route = reactRouterDomModule.Route;
    Routes = reactRouterDomModule.Routes;

    const tandemSpaceModule = await import('../TandemSpace');
    TandemSpacePage = tandemSpaceModule.default;
  });

  it('keeps rendering cached topics when the live hub room is temporarily missing', () => {
    mockUseTandemSpaceRoomCatalogStore.mockReturnValue({
      data: [
        {
          id: '!topic:example.com',
          name: 'Weekly Plans',
          icon: null,
          description: null,
          preview: 'Drafting check-in',
          timestamp: 0,
          unreadCount: 0,
          memberCount: 2,
          membership: 'join',
          isPinned: false,
          isArchived: false,
        },
      ],
      error: 'Tandem space not found.',
      isLoading: false,
      refresh: jest.fn(),
      hasCachedData: true,
    });

    render(
      <MemoryRouter initialEntries={['/tandem/space/%21space%3Aexample.com']}>
        <Routes>
          <Route path="/tandem/space/:spaceId" element={<TandemSpacePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Tandem space not found.')).toBeNull();
    expect(screen.getAllByText('Weekly Plans')).toHaveLength(2);
  });

  it('still shows the error for an invalid hub route with no cached state', () => {
    mockUseTandem.mockReturnValue({ relationships: [] });
    mockUseTandemSpaceRoomCatalogStore.mockReturnValue({
      data: [],
      error: 'Tandem space not found.',
      isLoading: false,
      refresh: jest.fn(),
      hasCachedData: false,
    });

    render(
      <MemoryRouter initialEntries={['/tandem/space/%21missing%3Aexample.com']}>
        <Routes>
          <Route path="/tandem/space/:spaceId" element={<TandemSpacePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Tandem space not found.')).toBeTruthy();
  });
});
