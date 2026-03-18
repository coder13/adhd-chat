# Chat Experience

## Overview

The web client is organized as a mobile-first messaging app instead of a
dashboard. Chats, contacts, Tandem spaces, and settings are routed as focused
surfaces with a lightweight Ionic shell.

## Primary Surfaces

### Home

- Lists Tandem spaces.
- Surfaces incoming relationship invites.
- Provides quick entry points into new Tandem invitations.

### Room

- Shows the active thread view and composer.
- Supports pending Tandem room creation states.
- Exposes room actions such as encryption, archive, pin, and category updates.

### Contacts and Other Rooms

- Contacts highlights direct relationships and invite entry points.
- Other Rooms captures Matrix rooms outside the app-native Tandem flow.

### User Menu and Preferences

- Provides entry points for encryption, device state, notifications, and chat
  appearance.
- Chat view mode preferences are persisted in Matrix account data.

## Implementation Map

- App shell and routes: `apps/web/src/App.tsx`
- Home page: `apps/web/src/pages/Home.tsx`
- Room page: `apps/web/src/pages/Room.tsx`
- Contacts page: `apps/web/src/pages/Contacts.tsx`
- Other rooms page: `apps/web/src/pages/OtherRooms.tsx`
- User menu pages: `apps/web/src/pages/UserMenu.tsx`,
  `apps/web/src/pages/UserMenuStub.tsx`
- Navigation components: `apps/web/src/components/navigation/`
- Chat presentation: `apps/web/src/components/chat/`
- Preferences hook and storage:
  `apps/web/src/hooks/useChatPreferences.ts`,
  `apps/web/src/lib/matrix/preferences.ts`

## Design Notes

- Mobile and desktop intentionally use different navigation models. See
  [Navigation Model](../architecture/navigation-model.md).
- Persisted local caches help pages render without flashing empty states during
  Matrix reloads.
- Theme usage should prefer semantic tokens over hardcoded gray palettes.

## Related Topics

- [Tandem Spaces](./tandem-spaces.md)
- [End-to-End Encryption](./e2ee-encryption.md)
