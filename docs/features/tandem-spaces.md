# Tandem Spaces

## Overview

Tandem is the app’s relationship-focused layer on top of Matrix. A Tandem
relationship creates a shared private space, a main room, and optional child
rooms for topic-based conversations.

## Core Behaviors

### Invites

- Users can look up a Matrix user and send a Tandem invite.
- Invites include both native Matrix data and an external deep link.
- Invite acceptance creates or confirms the shared relationship state.

### Shared Space Model

- Each relationship is anchored by a shared Matrix space.
- The main room acts as the primary thread.
- Additional child rooms can be created inside the shared space.

### Pending Room Creation

- Child room creation is optimistic.
- The UI can navigate to a temporary pending room record while Matrix room
  creation finishes.
- Once the real room exists, the app swaps from the pending id to the live room
  id.

## Implementation Map

- Relationship hook: `apps/web/src/hooks/useTandem.ts`
- Tandem data and invite parsing: `apps/web/src/lib/matrix/tandemData.ts`
- Tandem room and relationship logic: `apps/web/src/lib/matrix/tandem.ts`
- Pending room persistence: `apps/web/src/lib/matrix/pendingTandemRoom.ts`
- Space catalog builders: `apps/web/src/lib/matrix/spaceCatalog.ts`
- Invite flow page: `apps/web/src/pages/AddContact.tsx`
- Invite acceptance page: `apps/web/src/pages/TandemInvite.tsx`
- Space overview page: `apps/web/src/pages/TandemSpace.tsx`
- Space members page: `apps/web/src/pages/TandemSpaceMembers.tsx`
- New room flow: `apps/web/src/pages/TandemCreateRoom.tsx`

## UX Notes

- Home focuses on Tandem spaces first.
- Shared spaces are filtered so app-native ADHD Chat spaces are treated
  differently from unrelated Matrix rooms.
- Tangents and topic-based child rooms are part of the Tandem organization
  model.

## Related Topics

- [Chat Experience](./chat-experience.md)
- [Authentication](./authentication.md)
