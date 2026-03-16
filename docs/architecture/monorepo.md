# Monorepo Architecture

## Overview

ADHD Chat is a Yarn workspaces monorepo managed with Turbo.

## Structure

```text
adhd-chat/
├── apps/web/          React + Vite + Ionic client
├── packages/core/     Shared Matrix client package
├── docs/              Project documentation by topic
├── backlog/           Project planning managed by Backlog CLI
└── config files       Turbo, ESLint, Prettier, Jest, TypeScript
```

## Workspace Responsibilities

### `apps/web`

- Hosts the main user-facing client.
- Owns routing, Ionic shell, feature UI, and Matrix session state.
- Implements feature pages such as chats, Tandem spaces, encryption setup, and
  settings.

### `packages/core`

- Wraps lower-level Matrix concerns for shared use.
- Provides the reusable Matrix client entry points used by the app layer.

## Shared Tooling

- `yarn lint`: runs workspace lint tasks through Turbo.
- `yarn typecheck`: runs TypeScript checks across workspaces.
- `yarn test`: runs workspace tests.
- `yarn format` and `yarn format:check`: run Prettier at the repo level.

## Documentation Rules

- General project docs live under `docs/`.
- Backlog-managed planning docs stay under `backlog/` and should not be edited
  outside the Backlog CLI when task metadata is involved.
- Package-specific usage notes can stay with the package README when they are
  tightly scoped to that workspace.
