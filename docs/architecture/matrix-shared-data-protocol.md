# Matrix Shared Data Protocol

This document defines where app-owned shared records should live when they are
mirrored locally in the web client.

## Goal

The web client already keeps several kinds of durable Matrix-adjacent state in
IndexedDB:

- Matrix SDK room and sync state
- app-render caches
- drafts
- pending local actions

Shared Matrix-native records for things like notes, tasks, reminders, or other
structured room/account data should reuse that same browser database rather
than creating another parallel IndexedDB silo by default.

## Local Storage Layout

The app-level database is managed in:

- `apps/web/src/lib/asyncPersistence.ts`

It uses named buckets:

- `resources`
- `drafts`
- `pending-actions`
- `shared-data`

`shared-data` is reserved for local mirrors, indexes, or normalized snapshots
of Matrix Shared Data Protocol records.

## Recommendation

When this protocol is implemented:

1. Keep authoritative state in Matrix room/account data.
2. Mirror the minimum local data needed for fast startup, indexing, and offline
   continuity into the `shared-data` bucket.
3. Use stable keys based on scope and record identity, for example:
   `room:<roomId>:<recordType>:<recordId>` or
   `account:<userId>:<recordType>:<recordId>`.
4. Keep protocol-specific read/write logic in a typed layer above
   `asyncPersistence` instead of scattering raw key construction across pages.

## Non-Goals

This bucket is not intended for:

- Matrix SDK sync state
- generic room render caches
- drafts
- transient optimistic sends that already belong to another dedicated bucket

Those concerns should stay isolated so future protocol migrations can evolve
without touching unrelated UI caches.
