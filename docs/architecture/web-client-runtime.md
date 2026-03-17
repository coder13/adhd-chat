# Web Client Runtime Architecture

## Why This Document Exists

The existing docs describe features separately. This document explains how the
web app actually behaves at runtime across auth, Matrix bootstrap, caching,
Tandem relationship state, room rendering, encryption, and PWA behavior.

It also records the parts that have been easy to misunderstand or break.

If this app is migrated to Android, iOS, or another client shell, this is the
most important mental model to preserve.

## Big Picture

The web app is a React + Vite + Ionic client on top of `matrix-js-sdk`.

There are four overlapping runtime layers:

1. Session and auth bootstrap
2. Matrix client and crypto initialization
3. App-specific data shaping for Tandem, rooms, preferences, and search
4. Local UI caching and optimistic state to keep the app feeling stable

The app is not fully offline-first yet. It is better described as:

- persisted-session
- crypto-persistent
- selectively UI-cached
- live-sync-dependent for most Matrix state

That distinction matters when porting it.

## Main Runtime Entry Points

### App Shell

- `apps/web/src/App.tsx`
- `apps/web/src/hooks/useMatrixClient/MatrixClientProvider.tsx`

`App.tsx` defines routes and wraps the router in `MatrixClientProvider`.
Everything that needs Matrix state reads it through the provider.

### Central Matrix Runtime

- `apps/web/src/hooks/useMatrixClient/useMatrixClientState.ts`
- `apps/web/src/hooks/useMatrixClient/helpers.ts`
- `apps/web/src/hooks/useMatrixClient/crypto.ts`

This is the real runtime core.

Pages do not create their own Matrix clients. They consume one shared client
plus a small state machine:

- `logged_out`
- `redirecting`
- `authenticating`
- `syncing`
- `ready`
- `error`

That separation is intentional and should be preserved in any migration.

## Startup Sequence

### Session Restore Flow

The normal refresh/startup path is:

1. Read the saved Matrix session from `localStorage`
2. Expose bootstrap identity early
3. Build the authenticated Matrix client
4. Refresh the token if needed
5. Initialize crypto
6. Start client sync
7. Mark the app `ready`

Relevant files:

- `apps/web/src/hooks/useMatrixClient/helpers.ts`
- `apps/web/src/hooks/useMatrixClient/useMatrixClientState.ts`

### Important Distinction: Bootstrap Identity vs Ready Client

One of the most important lessons from debugging refresh behavior:

- The app can know who the user is before it has a usable Matrix client.
- If cache keys wait for `user` from the live client instead of the saved
  session, refresh looks like logout.

The web client now exposes `bootstrapUserId` from the saved session in
`useMatrixClientState.ts`. Cache-backed pages use that to address persisted
data while the app is still `syncing`.

This is not cosmetic. Without it:

- Home can briefly look empty or logged out
- Space pages can briefly look like the user is not in the hub
- Room snapshots cannot hydrate even if local cache already exists

For a native port, preserve the idea that:

- identity restore
- client restore
- sync readiness

are separate phases.

Do not collapse them into a single boolean like `isAuthenticated`.

### Restore Failure Semantics

The startup hook retries transient restore failures before giving up.

That behavior is important because early startup failures are not always real
logout conditions. The app treats these differently:

- inactive token or invalid session: clear session and go to `logged_out`
- transient bootstrap failure: retry, then surface `error` without destroying
  the stored session immediately

That distinction lives in:

- `apps/web/src/hooks/useMatrixClient/sessionErrors.ts`
- `apps/web/src/hooks/useMatrixClient/useMatrixClientState.ts`

## Session Persistence

### What Is Persisted

#### Matrix Session

- Stored in `localStorage`
- File: `apps/web/src/hooks/useMatrixClient/helpers.ts`

The saved session currently includes:

- base URL
- user ID
- device ID
- access token
- refresh token when available
- expiry metadata when available

#### Crypto

Crypto state is persisted separately through Matrix crypto storage, not through
the app’s generic cache layer.

- File: `apps/web/src/hooks/useMatrixClient/helpers.ts`

This is a major reason encrypted sessions survive refresh better than other
Matrix-derived UI state.

#### UI Resource Caches

The app also stores selected rendered data in `localStorage` using:

- `apps/web/src/hooks/usePersistedResource.ts`
- `apps/web/src/lib/persistence.ts`

These caches are not authoritative Matrix state. They are last-known UI
snapshots used to avoid empty or broken-looking transitions.

Examples:

- Tandem spaces list
- room snapshot
- pinned message snapshot
- members snapshot
- contacts
- preferences
- Tandem relationship state

### What Is Not Persisted Well Enough Yet

Another hard-earned lesson:

- the app persists session and crypto state
- it does not persist a full Matrix room/event store

That means refresh still depends heavily on rebuilding state from the live
client. The service worker does not fix this.

For a native migration, this is one of the biggest architectural choices to
make up front:

- either add a real durable Matrix state store
- or keep a normalized app-shell cache for spaces, rooms, and timelines

without relying on live sync for basic rendering.

## The Local Cache Model

### `usePersistedResource`

This hook is the main local-cache abstraction:

- `apps/web/src/hooks/usePersistedResource.ts`

It does three things:

1. reads a cached value synchronously from `localStorage`
2. exposes it immediately
3. refreshes it asynchronously when live loading is enabled

Two details matter:

#### Cached data can load even when live fetching is disabled

The hook can still return cached data if `enabled` is false, as long as
`cacheKey` is non-null.

This is why bootstrap identity matters so much. If the cache key depends on the
fully restored Matrix user instead of the saved session identity, the cache is
effectively unreachable during startup.

#### Preserve functions matter

Several surfaces use `preserveValue` to avoid replacing good cached content
with an empty transient result during sync.

That is not just an optimization. It prevents the UI from thrashing during
reloads and membership churn.

### Current Limits of the Cache Model

The current cache layer is:

- per-surface
- local to this client
- not conflict-aware
- not a write queue
- not a durable event timeline store

It helps with perceived stability, but it is not full offline support.

## PWA and Offline Reality

### What the PWA Currently Does

- `apps/web/vite.config.ts`
- `apps/web/src/lib/pwa/registerPwa.ts`

The service worker primarily caches:

- app shell assets
- page navigations
- some media/assets

### What the PWA Does Not Do

It does not currently provide:

- persistent Matrix event sync
- queued outbound actions
- stale-while-revalidate room state
- offline relationship reconciliation
- background Matrix sync semantics comparable to a native client

This is another hard-earned point: the app can be installable and still not be
meaningfully offline-capable.

If migrating to Android, do not treat the current PWA behavior as the app’s
offline architecture. It is mostly shell caching.

## Tandem as an App-Specific Layer

### Core Idea

The app is not a generic Matrix chat UI. It overlays a Tandem relationship
model on top of Matrix rooms and spaces.

Relevant files:

- `apps/web/src/hooks/useTandem.ts`
- `apps/web/src/lib/matrix/tandem.ts`
- `apps/web/src/lib/matrix/tandemData.ts`
- `apps/web/src/lib/matrix/spaceCatalog.ts`
- `apps/web/src/lib/matrix/roomSnapshot.ts`

### Tandem Runtime Model

A Tandem relationship is anchored by:

- a shared Matrix space
- a main room
- optional child rooms for topics

The app repeatedly reshapes raw Matrix rooms into Tandem-native views:

- home: list of shared hubs
- hub: list of topic rooms
- room: single conversation snapshot

This means the app depends on derived catalogs, not just direct room rendering.

### Relationship Recovery

`useTandem.ts` handles account-data-backed relationship state and also runs
recovery logic for missing relationship rooms.

Important consequence:

- a relationship may exist conceptually before all rooms are locally joined or
  visible
- the app may need a recovery pass after sync before the UI fully stabilizes

That is why some pages intentionally preserve cached space data until recovery
finishes.

## Room Runtime Model

### Room Snapshots

The room page does not render directly from raw Matrix events alone.

It builds a `RoomSnapshot` through:

- `apps/web/src/lib/matrix/roomSnapshot.ts`

The snapshot combines:

- identity
- description
- room icon
- timeline messages
- encryption flag
- app-specific room metadata

This is the render model that should likely survive a platform migration.

### Pending Rooms

Child-room creation is optimistic.

- `apps/web/src/lib/matrix/pendingTandemRoom.ts`

The app can navigate to a temporary pending room ID before Matrix room creation
is complete. Once the real room exists, the UI transitions from the pending ID
to the live room.

This is a useful pattern to preserve in native clients because it makes room
creation feel immediate.

### Realtime + Optimistic Layer

The room page mixes several layers:

- persisted snapshot
- realtime Matrix updates
- optimistic outbound timeline items
- optimistic reaction changes

Relevant files:

- `apps/web/src/pages/Room.tsx`
- `apps/web/src/pages/room/useRoomRealtime.ts`
- `apps/web/src/pages/room/useRoomComposer.ts`
- `apps/web/src/lib/matrix/optimisticTimeline.ts`

That composition is subtle. If porting the room UI, keep those layers separate
instead of collapsing them into one mutable message array.

## Encryption Runtime Model

### Encryption Is More Than Encrypted Rooms

The app’s encryption runtime spans:

- cross-signing
- secret storage
- backup key restore
- recovery key generation
- interactive auth
- device verification

Relevant files:

- `apps/web/src/hooks/useMatrixClient/crypto.ts`
- `apps/web/src/hooks/useMatrixClient/useMatrixClientState.ts`
- `apps/web/src/components/EncryptionSetupModal.tsx`
- `apps/web/src/components/DeviceVerificationPanel.tsx`
- `apps/web/src/pages/settings/EncryptionSettingsPage.tsx`

### Hard-Earned Lesson: Verification and Secret Storage Are Separate

One of the most confusing parts of the encryption flow:

- device verification proves trust
- it does not automatically mean secret storage is unlocked in this browser

That distinction caused a real bug where emoji verification succeeded but the
app still asked for a recovery key.

The runtime now treats locally available private cross-signing keys as valid
device-ready state even if secret storage itself is not unlocked in the current
browser session.

If this is ported, preserve separate concepts for:

- trusted device
- secret storage unlocked
- backup key available locally
- historical message restore complete

Do not model encryption as a single `configured` flag.

### Hard-Earned Lesson: SAS Can Already Be Started Elsewhere

Another subtle bug came from device verification:

- one device can attach to a verifier after the other side has already started
  SAS
- if the app only waits for a future `ShowSas` event, it can miss the current
  callbacks and appear stuck

The current verifier attachment logic now checks existing SAS callbacks
immediately when attaching.

If porting verification UI, preserve this rule:

- always inspect current verifier state on attach
- do not assume you will only learn about SAS through future events

### Encryption Diagnostics vs Setup State

The settings page uses both:

- setup info
- diagnostics

These are related but not interchangeable.

Another bug came from mixing stale setup state with fallback diagnostics and
showing misleading status like:

- unknown device trust
- cross-signing not ready
- no backup

even when the real problem was “diagnostics unavailable”.

If porting settings, keep the diagnostics model explicit:

- checking
- unavailable
- partial
- ready

Do not silently fill missing diagnostics with fake-looking status values.

## Auth UI vs Cached UI

### Hard-Earned Lesson: Logged Out Is Not the Same as Restoring

The app used to show logged-out style UI during refresh because the route-level
surfaces gated entirely on `user` and `isReady`.

That was wrong. During refresh there are at least three different states:

- actually signed out
- restoring a saved session
- restoring a saved session while cached data is available

The app now uses `AuthFallbackState` plus bootstrap-aware caches so pages can
differentiate those cases.

For a native migration, preserve separate views for:

- no session
- restoring session
- restored session but still syncing
- ready

Otherwise the UI will feel broken even when state is technically valid.

## Search and Derived Indexes

Search is derived from Matrix/Tandem state rather than maintained as a
standalone local database.

Relevant files:

- `apps/web/src/lib/matrix/search.ts`
- `apps/web/src/pages/Search.tsx`

If search needs to be instant and resilient offline in a native client, it will
probably need stronger local indexing than the current runtime.

## Browser-Specific Concerns

### Media Access Tokens

Some media display paths depend on the current access token for authorized
fetches.

- `apps/web/src/components/chat/MessageBubble.tsx`

This matters when rendering cached room content while the client is still
restoring:

- text can often render from cache
- media may be limited or require deferred resolution

Native clients should model cached message metadata separately from media fetch
authorization.

### Interactive Auth and Secret Prompts

The web client includes modal-driven flows for:

- secret storage key entry
- password-based interactive auth
- browser-based interactive auth continuation

Relevant files:

- `apps/web/src/components/SecretStorageKeyModal.tsx`
- `apps/web/src/components/InteractiveAuthModal.tsx`
- `apps/web/src/components/BrowserInteractiveAuthModal.tsx`

Those are UI shells over runtime callbacks registered in the Matrix hook layer.
The important part to preserve is the callback contract, not the modal styling.

## Migration Guidance

### What Should Survive a Platform Port

These concepts are worth keeping almost exactly:

- one centralized Matrix runtime owner
- explicit auth/bootstrap state machine
- bootstrap identity separate from ready client
- Tandem as a derived app layer over Matrix primitives
- room snapshot model
- optimistic pending-room and optimistic-message flows
- encryption modeled as multiple independent readiness dimensions

### What Should Probably Change

These parts should be reconsidered for a native client:

- `localStorage` cache implementation
- service-worker-based assumptions
- page-level cache fragmentation
- lack of durable Matrix room/event persistence
- browser-driven modal prompting for auth and secret storage

### Recommended Native Direction

If building Android or another native client, the runtime should probably move
toward:

1. durable session storage
2. durable Matrix event/state storage
3. normalized app-shell projections for Tandem hubs and rooms
4. background sync and retry support
5. explicit offline and degraded-mode UX

The current web app already points in that direction, but it does not fully
implement it.

## Sharp Edges Summary

These are the highest-value things to remember:

- `bootstrapUserId` is critical for refresh stability
- session restore, client restore, and sync readiness are separate phases
- UI caches are not a replacement for a persistent Matrix store
- PWA support is not the same as real offline support
- device verification does not equal secret-storage unlock
- verifier attachment must inspect current SAS state immediately
- settings diagnostics must not invent fallback status values
- Tandem relationship recovery can lag behind initial auth restore
- room rendering is a composition of cached snapshot, realtime updates, and
  optimistic local changes

## Related Docs

- [Monorepo Architecture](./monorepo.md)
- [Authentication](../features/authentication.md)
- [End-to-End Encryption](../features/e2ee-encryption.md)
- [Tandem Spaces](../features/tandem-spaces.md)
- [Chat Experience](../features/chat-experience.md)
