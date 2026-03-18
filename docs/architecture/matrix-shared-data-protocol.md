# Matrix Shared Data Protocol

## Why This Document Exists

This document defines a Matrix-native protocol for storing shared notes, tasks,
calendar items, and reminders directly in Matrix rooms under the `com.tandem`
namespace.

The goal is to keep the Matrix homeserver as the canonical shared datastore
while making the format simple enough for Tandem clients and third-party apps
to read, write, and sync without a Tandem-specific backend.

## Core Model

- A hub is a Matrix space.
- A topic is a Matrix room under that space.
- Notes, tasks, calendar items, and reminder definitions are room timeline
  events.
- topic-level shared facts live in room state events.
- Per-user UI and delivery preferences live in account data.
- Cross-room views such as "all open tasks" are derived client-side from synced
  Matrix data.

This protocol intentionally treats Matrix as both the transport and the shared
source of truth.

## Room Topology

- The hub-level container SHOULD be a room with Matrix room type `m.space`.
- Each topic SHOULD be a child room linked with `m.space.child` from the space
  and `m.space.parent` from the child room.
- This protocol does not redefine Matrix membership, visibility, or room
  hierarchy semantics. It only defines how Tandem data objects are stored once
  the room topology exists.

## Design Goals

- Keep all shared product data on the homeserver.
- Use native Matrix primitives instead of a parallel application database.
- Support lightweight clients and clients with a full local event index.
- Use stable, explicit object IDs so other apps can interoperate safely.
- Prefer full-snapshot updates over patches for simpler sync and conflict
  handling.
- Keep user-specific notification and presentation state out of the shared room
  timeline.

## Non-Goals

- Server-side materialized views or a Tandem-owned index service.
- Hard-delete semantics as a core v1 workflow.
- Full recurrence rules, attendee workflows, or ICS parity in v1.
- Large binary note attachments embedded directly in protocol events.

## Storage Split

| Matrix primitive | Purpose | Canonical examples |
| --- | --- | --- |
| Room timeline events | Shared collections and history | notes, tasks, calendar items, reminder definitions |
| Room state events | Singular current room facts | archive status, pinned note IDs, topic icon/color |
| Global account data | Per-user app defaults | home sorting, default calendar view |
| Room account data | Per-user room UI and reminder execution state | collapsed sections, muted room, snoozed reminders |

Notes, tasks, events, and reminders MUST NOT be stored as room state keyed by
object ID in v1. Room state is reserved for singleton room facts and shared
hints, not large mutable collections.

## Event Type Registry

The protocol reserves the following event types.

### Timeline Events

| Event type | Purpose |
| --- | --- |
| `com.tandem.note` | Create note snapshot |
| `com.tandem.note.update` | Replace note snapshot with a newer version |
| `com.tandem.task` | Create task snapshot |
| `com.tandem.task.update` | Replace task snapshot with a newer version |
| `com.tandem.event` | Create calendar item snapshot |
| `com.tandem.event.update` | Replace calendar item snapshot with a newer version |
| `com.tandem.reminder` | Create shared reminder definition |
| `com.tandem.reminder.update` | Replace reminder definition with a newer version |

`com.tandem.event` means calendar event here, not a generic Matrix event.

### Room State Events

| Event type | `state_key` | Purpose |
| --- | --- | --- |
| `com.tandem.topic.meta` | `""` | Shared room-level metadata and optional derived hints |

Future protocol revisions MAY add focused state event types such as
`com.tandem.topic.pins` or `com.tandem.topic.archive`, but v1 only requires
`com.tandem.topic.meta`.

### Account Data

| Event type | Scope | Purpose |
| --- | --- | --- |
| `com.tandem.preferences` | Global | Per-user defaults across all topics |
| `com.tandem.room.preferences` | Room | Per-user room UI preferences |
| `com.tandem.room.reminder_state` | Room | Optional per-user reminder delivery, dismiss, and snooze state |

## Common Conventions

### Encoding Rules

- Event content MUST be a JSON object.
- Clients MUST ignore unknown fields.
- Apps MAY add implementation-specific fields under `extensions`.
- `schema_version` MUST be present and MUST be `1` for this protocol version.
- All examples in this document use `snake_case` JSON keys.

### Stable IDs

- Every shared object MUST have a stable object ID in its content.
- Object IDs are opaque application identifiers, not derived from Matrix event
  IDs.
- Clients SHOULD generate object IDs as ULIDs or UUIDv7 values with a
  type-specific prefix:
  - `note_...`
  - `task_...`
  - `evt_...`
  - `rem_...`
- Matrix `event_id` values are opaque references and MUST be treated as such.

Object IDs are scoped to the room that contains them. A note or task does not
"move" between rooms in v1.

### Timestamps and Temporal Values

Protocol timestamps use RFC 3339 strings unless a field explicitly uses a
date-only form.

Reusable temporal shapes:

```json
{
  "kind": "date",
  "date": "2026-04-01",
  "timezone": "America/Los_Angeles"
}
```

```json
{
  "kind": "date_time",
  "at": "2026-04-14T10:30:00-07:00",
  "timezone": "America/Los_Angeles"
}
```

Rules:

- `date` is for all-day semantics.
- `date_time` is for a specific instant plus a canonical IANA timezone.
- Clients MAY use Matrix `origin_server_ts` for ordering, but MUST NOT replace
  protocol timestamps with it when re-emitting snapshots.

### Rich Text Bodies

Notes and rich descriptions use this reusable body shape:

```json
{
  "format": "tandem.richtext.v1",
  "text": "Flights\n- Book ANA by Friday\n- Check baggage rules",
  "blocks": [
    { "type": "heading", "text": "Flights" },
    { "type": "bullet_list", "items": ["Book ANA by Friday", "Check baggage rules"] }
  ]
}
```

Rules:

- `text` MUST contain a plain-text fallback.
- `format` MAY be `text/plain`, `text/markdown`, or `tandem.richtext.v1`.
- `blocks` MUST only be sent for `tandem.richtext.v1`.
- Clients that do not understand `blocks` MUST render `text`.

### Common Relationship Fields

Shared objects SHOULD use a consistent relationship envelope:

```json
{
  "relations": {
    "source_event_ids": ["$matrixEventId"],
    "note_ids": ["note_01..."],
    "task_ids": ["task_01..."],
    "calendar_event_ids": ["evt_01..."],
    "reminder_ids": ["rem_01..."]
  }
}
```

Rules:

- `source_event_ids` refer to Matrix events in the same room.
- Related object IDs SHOULD point to objects in the same room in v1.
- Empty relation arrays MAY be omitted.

### Common External References

Objects MAY carry external IDs for sync bridges:

```json
{
  "external_refs": [
    {
      "system": "google_calendar",
      "id": "external-provider-id",
      "url": "https://calendar.google.com/..."
    }
  ]
}
```

These references are advisory and do not change the Matrix room as the
canonical shared store.

### Snapshot Lifecycle Rules

- A create event MUST start with `version: 1`.
- An update event MUST contain a full replacement snapshot, not a patch.
- An update event MUST repeat the full current object state after the edit.
- Update events MUST include the object ID, the new `version`, and
  `previous_event_id`.
- Update events SHOULD increment `version` by exactly `1` from the prior
  accepted snapshot and MUST use a value greater than the prior accepted
  version.
- `previous_event_id` MUST point to the Matrix event that the author believed
  was the latest accepted snapshot when they wrote the update.
- Immutable fields MUST NOT change across versions:
  - object ID
  - `created_by`
  - `created_at`
  - room scope
  - reminder target kind and target ID
- Clients SHOULD treat updates without a matching create event as orphaned and
  SHOULD NOT materialize them as canonical objects unless a valid create event
  later appears.

Apps MAY also include `m.relates_to` with an `m.reference` relation to
`previous_event_id`, but the protocol does not require Matrix edit semantics
such as `m.replace`.

### Conflict Resolution

Clients materialize one current snapshot per object ID.

If multiple snapshots exist for the same object ID:

1. Prefer the snapshot with the highest `version`.
2. If versions tie, prefer the snapshot with the later Matrix
   `origin_server_ts`.
3. If timestamps tie, prefer the lexicographically larger Matrix `event_id`.

If two different snapshots share the same object ID and `version`, clients
SHOULD surface a conflict indicator in UI if possible, even though the rules
above still choose a deterministic winner.

### Archival, Cancellation, and Delete Semantics

This protocol distinguishes archival or cancellation from Matrix redaction.

- Notes use `archived: true` when hidden from normal views.
- Tasks use `status: "completed"` or `status: "canceled"`.
- Calendar items use `status: "canceled"` when no longer active.
- Reminders use `active: false` when canceled.

Hard delete is intentionally out of scope for v1. Apps SHOULD NOT use Matrix
redactions as the primary end-user delete mechanism for these objects because
redactions remove event content in a way that is awkward for application data
replication and history.

If a protocol event is redacted anyway, clients SHOULD ignore its content and
recompute the object from the remaining valid snapshots.

## Object Schemas

### Note Create: `com.tandem.note`

| Field | Required | Notes |
| --- | --- | --- |
| `schema_version` | Yes | Always `1` in v1 |
| `note_id` | Yes | Stable note ID |
| `version` | Yes | Must be `1` |
| `title` | Yes | Human-visible title |
| `body` | Yes | Rich body with plain-text fallback |
| `archived` | Yes | `false` for normal notes |
| `relations` | No | Related Matrix/object references |
| `external_refs` | No | External sync references |
| `extensions` | No | App-specific namespaced data |
| `created_by` | Yes | Matrix user ID |
| `created_at` | Yes | RFC 3339 timestamp |

Example:

```json
{
  "schema_version": 1,
  "note_id": "note_01JXYZ8W6V98M8S6K7GDX9C1Q8",
  "version": 1,
  "title": "Japan trip plan",
  "body": {
    "format": "tandem.richtext.v1",
    "text": "Flights\n- Compare SEA to NRT\n- Check baggage rules",
    "blocks": [
      { "type": "heading", "text": "Flights" },
      { "type": "bullet_list", "items": ["Compare SEA to NRT", "Check baggage rules"] }
    ]
  },
  "archived": false,
  "relations": {
    "source_event_ids": ["$messageEventId1"]
  },
  "created_by": "@alice:example.com",
  "created_at": "2026-03-16T00:00:00Z"
}
```

### Note Update: `com.tandem.note.update`

Same shape as note create, plus:

| Field | Required | Notes |
| --- | --- | --- |
| `version` | Yes | Must be greater than the prior accepted version |
| `previous_event_id` | Yes | Matrix event ID of the prior snapshot |
| `updated_by` | Yes | Matrix user ID |
| `updated_at` | Yes | RFC 3339 timestamp |

`created_by` and `created_at` MUST remain unchanged from version `1`.

### Task Create: `com.tandem.task`

| Field | Required | Notes |
| --- | --- | --- |
| `schema_version` | Yes | Always `1` in v1 |
| `task_id` | Yes | Stable task ID |
| `version` | Yes | Must be `1` |
| `title` | Yes | Task title |
| `description` | No | Rich body or omitted |
| `status` | Yes | `open`, `completed`, or `canceled` |
| `assignee` | No | Matrix user ID, `"both"`, or `null` |
| `due` | No | `date` or `date_time` temporal value |
| `relations` | No | Related Matrix/object references |
| `external_refs` | No | External sync references |
| `extensions` | No | App-specific namespaced data |
| `created_by` | Yes | Matrix user ID |
| `created_at` | Yes | RFC 3339 timestamp |

Example:

```json
{
  "schema_version": 1,
  "task_id": "task_01JABCJ7GJY7E9XGJ0MFD3B8TX",
  "version": 1,
  "title": "Book Airbnb",
  "description": {
    "format": "text/plain",
    "text": "Find something near the station"
  },
  "status": "open",
  "assignee": "@alice:example.com",
  "due": {
    "kind": "date",
    "date": "2026-04-01",
    "timezone": "America/Los_Angeles"
  },
  "relations": {
    "source_event_ids": ["$messageEventId2"],
    "note_ids": ["note_01JXYZ8W6V98M8S6K7GDX9C1Q8"]
  },
  "created_by": "@bob:example.com",
  "created_at": "2026-03-16T00:00:00Z"
}
```

### Task Update: `com.tandem.task.update`

Same shape as task create, plus:

| Field | Required | Notes |
| --- | --- | --- |
| `version` | Yes | Must be greater than the prior accepted version |
| `previous_event_id` | Yes | Matrix event ID of the prior snapshot |
| `updated_by` | Yes | Matrix user ID |
| `updated_at` | Yes | RFC 3339 timestamp |
| `completed_by` | No | Set when status becomes `completed` |
| `completed_at` | No | Set when status becomes `completed` |

Task updates SHOULD preserve `completed_by` and `completed_at` once the task is
completed unless the task is explicitly reopened in a future protocol version.
Task reopening is out of scope for v1.

### Calendar Item Create: `com.tandem.event`

| Field | Required | Notes |
| --- | --- | --- |
| `schema_version` | Yes | Always `1` in v1 |
| `calendar_event_id` | Yes | Stable calendar item ID |
| `version` | Yes | Must be `1` |
| `title` | Yes | Event title |
| `description` | No | Rich body or omitted |
| `start` | Yes | `date` or `date_time` temporal value |
| `end` | No | Same temporal kind as `start` when present |
| `all_day` | Yes | Boolean convenience flag |
| `location` | No | Freeform location string |
| `status` | Yes | `tentative`, `confirmed`, or `canceled` |
| `relations` | No | Related Matrix/object references |
| `external_refs` | No | External sync references |
| `extensions` | No | App-specific namespaced data |
| `created_by` | Yes | Matrix user ID |
| `created_at` | Yes | RFC 3339 timestamp |

Rules:

- `all_day: true` SHOULD use `date` temporal values for `start` and `end`.
- `all_day: false` SHOULD use `date_time` temporal values.
- "Upcoming", "past", and "completed" are derived client-side from time and do
  not belong in canonical status.

Example:

```json
{
  "schema_version": 1,
  "calendar_event_id": "evt_01JDEF13Y9FDQ9W1N3W45S0BRQ",
  "version": 1,
  "title": "Flight to Tokyo",
  "description": {
    "format": "text/plain",
    "text": "SEA to NRT"
  },
  "start": {
    "kind": "date_time",
    "at": "2026-04-14T10:30:00-07:00",
    "timezone": "America/Los_Angeles"
  },
  "end": {
    "kind": "date_time",
    "at": "2026-04-15T13:45:00+09:00",
    "timezone": "Asia/Tokyo"
  },
  "all_day": false,
  "location": "SeaTac Airport",
  "status": "confirmed",
  "relations": {
    "source_event_ids": ["$messageEventId3"],
    "note_ids": ["note_01JXYZ8W6V98M8S6K7GDX9C1Q8"],
    "task_ids": ["task_01JABCJ7GJY7E9XGJ0MFD3B8TX"]
  },
  "created_by": "@alice:example.com",
  "created_at": "2026-03-16T00:00:00Z"
}
```

### Calendar Item Update: `com.tandem.event.update`

Same shape as calendar create, plus:

| Field | Required | Notes |
| --- | --- | --- |
| `version` | Yes | Must be greater than the prior accepted version |
| `previous_event_id` | Yes | Matrix event ID of the prior snapshot |
| `updated_by` | Yes | Matrix user ID |
| `updated_at` | Yes | RFC 3339 timestamp |

### Reminder Create: `com.tandem.reminder`

Reminders are shared scheduling definitions, not per-user delivery receipts.
Actual notification delivery, snooze, and dismiss state belongs in room account
data.

| Field | Required | Notes |
| --- | --- | --- |
| `schema_version` | Yes | Always `1` in v1 |
| `reminder_id` | Yes | Stable reminder ID |
| `version` | Yes | Must be `1` |
| `target` | Yes | Object being reminded about |
| `trigger` | Yes | Absolute or relative trigger |
| `title` | No | Override title shown in reminder UI |
| `body` | No | Freeform note shown in reminder UI |
| `active` | Yes | `true` unless canceled |
| `relations` | No | Related Matrix/object references |
| `external_refs` | No | External sync references |
| `extensions` | No | App-specific namespaced data |
| `created_by` | Yes | Matrix user ID |
| `created_at` | Yes | RFC 3339 timestamp |

`target` shape:

```json
{
  "kind": "task",
  "id": "task_01JABCJ7GJY7E9XGJ0MFD3B8TX"
}
```

`trigger` shapes:

```json
{
  "kind": "absolute",
  "at": "2026-04-14T09:30:00-07:00",
  "timezone": "America/Los_Angeles"
}
```

```json
{
  "kind": "relative",
  "anchor": "event.start",
  "offset_minutes": -30
}
```

Rules:

- Allowed `target.kind` values are `note`, `task`, and `calendar_event`.
- Relative `anchor` values are:
  - `task.due`
  - `event.start`
  - `event.end`
- Relative reminders MUST resolve against an object in the same room.
- Reminder firing does not mutate shared state by itself.

Example:

```json
{
  "schema_version": 1,
  "reminder_id": "rem_01JREM5WQ4NYV9WR1WX7RT6W4T",
  "version": 1,
  "target": {
    "kind": "calendar_event",
    "id": "evt_01JDEF13Y9FDQ9W1N3W45S0BRQ"
  },
  "trigger": {
    "kind": "relative",
    "anchor": "event.start",
    "offset_minutes": -30
  },
  "title": "Leave for airport",
  "body": "Check in and grab passports.",
  "active": true,
  "created_by": "@alice:example.com",
  "created_at": "2026-03-16T00:00:00Z"
}
```

### Reminder Update: `com.tandem.reminder.update`

Same shape as reminder create, plus:

| Field | Required | Notes |
| --- | --- | --- |
| `version` | Yes | Must be greater than the prior accepted version |
| `previous_event_id` | Yes | Matrix event ID of the prior snapshot |
| `updated_by` | Yes | Matrix user ID |
| `updated_at` | Yes | RFC 3339 timestamp |

The reminder `target` MUST NOT change across versions.

## topic State Schema

### `com.tandem.topic.meta`

State event with `state_key: ""`.

Matrix state is keyed by `(event type, state_key)`, so v1 uses the empty
`state_key` for a single shared topic metadata document per room.

| Field | Required | Notes |
| --- | --- | --- |
| `archived` | Yes | Shared archive state for the topic |
| `icon` | No | topic icon or emoji |
| `color` | No | App-defined token or color key |
| `summary_note_id` | No | Note ID used as the topic summary |
| `pinned_note_ids` | No | Ordered array of pinned note IDs |
| `display_hints` | No | Shared presentation hints |
| `open_task_count_hint` | No | Derived optimization hint, not canonical |
| `next_event_id_hint` | No | Derived optimization hint, not canonical |

Example:

```json
{
  "archived": false,
  "icon": "airplane",
  "color": "blue",
  "summary_note_id": "note_01JXYZ8W6V98M8S6K7GDX9C1Q8",
  "pinned_note_ids": ["note_01JXYZ8W6V98M8S6K7GDX9C1Q8"],
  "display_hints": {
    "default_tab": "chat"
  },
  "open_task_count_hint": 2,
  "next_event_id_hint": "evt_01JDEF13Y9FDQ9W1N3W45S0BRQ"
}
```

Rules:

- Clients MUST be able to function if all hint fields are missing or stale.
- `open_task_count_hint` and `next_event_id_hint` are accelerators only.
- Canonical task and calendar state still comes from timeline events.

## Account Data Schemas

### Global Account Data: `com.tandem.preferences`

Example:

```json
{
  "default_home_sort": "recent_activity",
  "show_archived_topics": false,
  "default_calendar_view": "agenda"
}
```

This event is per-user and MUST NOT be used for shared room facts.

### Room Account Data: `com.tandem.room.preferences`

Example:

```json
{
  "collapsed_completed_tasks": true,
  "collapsed_past_events": true,
  "selected_tab": "chat",
  "muted": false,
  "saved_filter": "open_items"
}
```

This event is per-user and room-scoped.

### Optional Room Account Data: `com.tandem.room.reminder_state`

Example:

```json
{
  "dismissed_reminder_ids": ["rem_01JREM5WQ4NYV9WR1WX7RT6W4T"],
  "snoozed_until_by_id": {
    "rem_01JREM5WQ4NYV9WR1WX7RT6W4T": "2026-04-14T09:45:00-07:00"
  },
  "last_delivered_at_by_id": {
    "rem_01JREM5WQ4NYV9WR1WX7RT6W4T": "2026-04-14T09:30:00-07:00"
  }
}
```

This event is explicitly non-canonical shared data. It exists so each user can
track local reminder execution without mutating shared reminder objects.

## Materialization Rules

Clients SHOULD build local indexes from synced Matrix data using these rules:

1. Sync the Tandem space and all child topic rooms.
2. Read `com.tandem.topic.meta` state for each room.
3. Scan room timeline events for known `com.tandem.*` object event types.
4. Group snapshots by object ID within each room.
5. Apply the conflict resolution rules to choose the current snapshot.
6. Derive higher-level views such as:
   - all open tasks across topics
   - all upcoming calendar items
   - notes linked to a chat message
   - reminders due soon for this user

Clients MAY keep a local persistent index for performance, but the protocol
does not require a server-owned projection service.

## Interoperability Rules

Apps that write this protocol SHOULD follow these rules:

- Preserve object IDs when importing or exporting from external systems.
- Preserve `created_by` and `created_at` from the original create event.
- Include plain-text fallbacks for rich text content.
- Ignore unknown fields but avoid deleting unknown `extensions` owned by other
  apps when possible.
- Keep shared reminder definitions in the room timeline and per-user execution
  state in account data.
- Avoid Tandem-only assumptions in core object fields so other apps can adopt
  the same schema family.

Apps MAY implement only a subset of the object families. For example, a client
can implement `com.tandem.task*` without supporting notes or calendar items.

## Security and Encryption Notes

- In encrypted rooms, these events inherit Matrix room encryption behavior like
  any other room event.
- Reminder delivery for encrypted rooms requires the client to decrypt synced
  events before scheduling local notifications.
- Apps SHOULD treat source message links, note bodies, and task descriptions as
  sensitive shared data.

## Recommended Next Steps

The protocol above is enough for a v1 implementation. The next likely protocol
extensions are:

- recurrence rules for calendar items
- attachments linked from notes
- comments or activity threads on tasks
- richer pinning and topic state event splits
- bridge mapping guidance for Google Calendar and task providers
