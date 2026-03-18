# Navigation Model

## Purpose

The web client uses different navigation patterns on mobile and desktop. This is intentional product behavior, not an implementation accident.

Future chat-shell work should preserve these constraints unless the navigation
model itself is being deliberately revised.

## Mobile

Mobile navigation is page-oriented.

- Full-screen routes are acceptable for search, settings, contacts, and other
  secondary flows.
- Back buttons and route history are primary navigation tools.
- Modal and sheet patterns are acceptable when they fit the interaction.
- It is acceptable for a secondary flow to temporarily replace the room view.

## Desktop

Desktop navigation is shell-oriented.

- The room page is the desktop home surface.
- The app should feel like a persistent chat workspace, not a stack of pages.
- The active conversation remains visible and primary whenever possible.
- Desktop should prefer contained panels over full-screen route detours.

## Desktop Shell Layout

### Left Rail

The left rail is for global and app-level navigation.

- Tandem topic list
- hub selection
- contacts
- other rooms
- settings and settings detail views
- app menu entry point from the top-left header area

These flows should stay inside the left rail on desktop instead of navigating
to separate full-screen pages.

### Center Column

The center column is the active room.

- room header
- timeline
- composer

This column is the primary surface and should remain stable while the user
opens surrounding panels.

### Right Rail

The right rail is for room-specific tools.

- pinned messages
- room search
- topic editing
- room-specific detail actions

These flows should stay contained to the right rail on desktop.

## Header Behavior

- The top-left header area belongs to the desktop shell.
- In topic mode it shows the hamburger menu and room-list search.
- In left-rail subviews it switches into a back button and section title.
- Desktop should avoid redundant stacked headers inside the rails when the top
  header already provides that context.

## Interaction Rules

- `Escape` should collapse desktop chrome instead of navigating browser history.
- Desktop search in the left rail should filter visible room navigation instead
  of taking over the entire screen.
- Desktop room-level actions should open in the right rail when possible.
- Mobile may still use full-page flows for the same features.

## Decision Rule For Future Changes

When adding or changing navigation:

1. If the interaction is app-scoped, prefer the desktop left rail.
2. If the interaction is room-scoped, prefer the desktop right rail.
3. If the interaction interrupts the conversation unnecessarily on desktop,
   redesign it to stay inside the shell.
4. If the same feature needs different behavior on mobile and desktop, optimize
   for the native navigation grammar of each form factor instead of forcing one
   shared pattern.

## Related Files

- `apps/web/src/pages/Room.tsx`
- `apps/web/src/pages/room/useDesktopRoomShell.ts`
- `apps/web/src/pages/room/DesktopRailHeader.tsx`
- `apps/web/src/pages/room/DesktopTopicSidebar.tsx`
- `apps/web/src/pages/room/DesktopRoomPanel.tsx`
