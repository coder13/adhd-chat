# Temporary Plan: Matrix Stability and Performance

## Why This Exists

This document started as a forward-looking plan for Matrix stability and
performance work in the web client.

A substantial part of that work is now implemented. This document is now a
status-aware checkpoint:

- what has already landed
- what still remains
- what should happen next if we continue this line of work

It is temporary because the long-term goal is to fold the stable parts into the
permanent runtime architecture docs and remove the planning residue.

## Current Status Snapshot

### Landed

The biggest app-layer Matrix stability/performance wins already shipped:

1. Durable Matrix SDK persistence
   - authenticated clients now attempt to use the SDK `IndexedDBStore`
   - startup falls back cleanly if IndexedDB-backed SDK state fails to open

2. Durable app cache persistence
   - heavy UI-derived Matrix caches moved off hot synchronous `localStorage`
   - the app cache now uses IndexedDB-backed async persistence
   - the app database is bucketed into `resources`, `drafts`,
     `pending-actions`, and reserved `shared-data`
   - main room and hub consumers now read shared projections through a
     centralized Matrix view-store layer instead of each owning their own
     persisted resource state

3. Better restore behavior
   - the extra startup-only `getJoinedRooms()` validation roundtrip was removed
   - drafts, pending Tandem room state, and search metadata/index now survive
     reload more reliably

4. Incremental room realtime patching
   - simple live messages patch directly into the active room snapshot
   - thread events patch only the affected thread snapshot
   - receipts patch only the affected message scopes when the receipt payload
     can be narrowed
   - edits patch only the affected target message
   - reactions patch only the affected target message
   - reaction removals via redaction patch only the affected target message
   - visible-message redactions patch only the affected target message
   - metadata updates patch room state without forcing full room rebuilds

5. Broader event-driven derived updates
   - room/topic/catalog/contact surfaces were moved away from broad sync-driven
     refreshes toward narrower Matrix event patching where practical

6. Initial developer instrumentation
   - development-only Matrix performance metrics now exist for client
     bootstrap, room snapshot build, room history pagination, and active-room
     full timeline fallback rebuilds
   - local inspection is available through
     `window.__ADHD_CHAT_MATRIX_PERF__`

### Still Missing

The remaining work is no longer “basic hot path cleanup.” It is mostly
architectural:

- no app-owned normalized full event database yet
- no incremental backward-pagination path yet
- no instrumentation layer for timing/fallback-rate baselines
- no centralized room-derived reducer/store that all consumers share
- cache versioning/invalidation is better than before, but still not as explicit
  as it should be for future schema evolution

## Current Runtime Shape

There are now four relevant persistence/state layers:

1. Matrix SDK durable state
   - `MatrixClient`
   - `Room`
   - `MatrixEvent`
   - SDK `IndexedDBStore`
   - SDK crypto store

2. App-derived persisted state
   - room snapshots
   - room/thread summary projections
   - catalogs
   - search metadata/index inputs
   - other IndexedDB-backed UI restore artifacts

3. Local durable UI state
   - drafts
   - pending local actions
   - bootstrap-critical small values that still live in `localStorage`

4. Ephemeral React/UI state
   - optimistic messages
   - optimistic reaction changes
   - scroll state
   - transient interaction state

The main weakness now is narrower than before:

- open-room realtime handling is much better
- startup and cache restore are much better
- but the app still lacks an app-owned normalized event store for durable
  derived state

## Goals Going Forward

1. Make large-room restore stable without needing broad projection rebuilds.
2. Keep full room rebuilds as rare recovery paths instead of routine behavior.
3. Make pagination prepend-only instead of refresh-driven.
4. Clarify ownership and schema evolution for app-derived persisted data.
5. Add instrumentation so remaining work can be justified with actual numbers.

## Non-Goals

- replacing `matrix-js-sdk`
- building a full local-first Matrix sync engine in this pass
- adding another parallel browser database outside the shared app persistence
  layer

## Workstream Status

### 1. Baselines and Instrumentation

Status: Partially done

What landed:

- a development-only Matrix performance metrics utility
- timings for Matrix client bootstrap
- timings for room snapshot build
- timings for backward room history pagination
- counters and timings for active-room full timeline fallback rebuilds
- a discoverable local inspection handle at
  `window.__ADHD_CHAT_MATRIX_PERF__`

Still needed:

- time to first usable room view, not just snapshot build
- clearer benchmark checklist for local comparison
- broader timing coverage for thread bootstrap and other non-room surfaces

### 2. Data Ownership and Persistence Rules

Status: Partially done

What landed:

- durable app cache moved to IndexedDB-backed async persistence
- bucketed persistence layout exists
- `shared-data` bucket is reserved for future shared Matrix-native app data

Still needed:

- explicit schema/version helpers per resource family
- clearer invalidation helpers for room snapshots, catalogs, and search
- written ownership rules for which shapes are authoritative vs disposable

### 3. Durable Normalized Derived Store

Status: Started for the active room path

What landed:

- the active room path now persists normalized room metadata, main-timeline
  message entities, and timeline ordering
- the room store can hydrate from those normalized records before falling back
  to rebuilding the full room snapshot

Still needed:

- expand the normalized store beyond the active room path
- normalize threads, receipts, members, and broader hub-derived entities
- move from per-room normalized records toward broader reusable entity/index
  families where justified

The app should eventually persist app-owned normalized records such as:

- room metadata projection by room ID
- top-level timeline message records by room ID and event ID
- thread summary records by room ID and thread root ID
- projection watermarks or cursors

Recommendation:

- build this on top of the existing IndexedDB app persistence layer
- keep it in a dedicated typed module
- keep future shared-data protocol mirrors separate from generic room render
  caches, even if they share the same underlying database

### 4. Incremental Realtime Reducers

Status: Largely done for the active room path

What landed:

- simple messages
- local echo reconciliation
- thread updates
- receipts
- edits
- reactions
- reaction redactions
- visible-message redactions
- room metadata updates

What still remains:

- unify the patch logic behind clearer reducer boundaries if this grows further
- instrument and compare fallback rebuild frequency over time
- decide whether more consumers should read from a normalized reducer store
  instead of room snapshots

### 5. Incremental Pagination

Status: Not started

Routine backward pagination still has room to improve.

Target behavior:

- paginate backward
- detect only newly available older events
- resolve/prepend only those events
- preserve scroll anchor exactly

This is the next obvious performance target after the current realtime work.

### 6. Thread Handling

Status: Partially done

What landed:

- thread realtime updates are now thread-scoped instead of forcing broad room
  rebuilds

Still needed:

- durable normalized thread records if we adopt a normalized derived store
- cleaner bootstrap/pagination story for thread-heavy rooms

### 7. Listener Fan-Out and Coordination

Status: More done than before, but not finished

What landed:

- the main room and hub surfaces now read through a centralized Matrix
  view-store module plus store action helpers
- those consumers no longer each own separate persisted-resource instances for
  the same room/hub projections

Still needed:

- broader migration of secondary consumers onto the same store layer
- clearer reducer boundaries if more action types accumulate
- eventual normalized event/view entities instead of keyed snapshot records

This becomes more important if we add:

- normalized room reducers
- instrumentation
- broader room-derived consumers

### 8. Cache Versioning and Recovery

Status: Partially done

What landed:

- better persistence structure
- cleaner separation between resource families
- fallback behavior when durable stores fail

Still needed:

- explicit version helpers for app-derived record families
- targeted invalidation instead of coarse resets
- corruption recovery rules per resource family

## Revised Recommended Sequence

### Phase 1: Instrument What Is Left

- add fallback counters and timing metrics
- establish before/after numbers for restore, room entry, and pagination

### Phase 2: Build a Normalized Derived Store

- start with room metadata and top-level timeline records
- restore room pages from normalized records before broad projection rebuilds

### Phase 3: Convert Pagination

- prepend only new older events
- preserve exact scroll anchor
- avoid full room snapshot refresh after routine pagination

### Phase 4: Expand Shared Consumption

- move more room-adjacent consumers onto the normalized derived store
- reduce duplicated derivation across screens

### Phase 5: Harden Schema and Recovery

- explicit schema versioning
- per-family invalidation
- corruption recovery tests

## Validation Plan

For future phases, verify at minimum:

- refresh with a large room
- refresh with poor network
- room open with missing members initially
- receipt-heavy rooms
- thread-heavy rooms
- rooms with edits, reactions, replies, and redactions
- pagination near the top of long histories
- pending room creation across refresh
- schema-version mismatch and cache invalidation behavior

Track at least:

- median and p95 room restore time
- median and p95 realtime patch time
- fallback full rebuild count per room session
- time to usable cached room on refresh
- pagination prepend cost and added-event count

## Risks

- Incremental reducers can still drift from SDK truth if they spread into too
  many one-off patch paths.
- A normalized store can become too broad if it tries to mirror everything.
- Persisting too much derived state can make invalidation and migrations harder.

## Risk Mitigations

- keep full rebuild as an explicit correctness escape hatch
- add instrumentation before larger store work
- keep normalized persisted records minimal and UI-driven
- version app-derived shapes aggressively
- keep future shared-data protocol mirrors in the same database but behind a
  typed layer and dedicated bucket

## Suggested Next Tasks

1. Add Matrix room performance instrumentation and fallback counters.
2. Define explicit schema/version helpers for app-derived IndexedDB resources.
3. Implement normalized room metadata and top-level timeline persistence.
4. Convert backward pagination to prepend-only updates.
5. Move additional room-adjacent consumers onto the normalized derived store.

## Temporary Nature

Once the remaining work is either completed or split into stable permanent
architecture docs, this document should be removed.
