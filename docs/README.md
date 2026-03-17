# Documentation

This folder contains the project documentation organized by topic instead of a
mix of root-level notes.

## Start Here

- [Architecture](./architecture/monorepo.md): repo shape, workspace boundaries,
  and shared tooling.
- [Web Client Runtime](./architecture/web-client-runtime.md): startup,
  bootstrap, caching, Tandem derivation, encryption behavior, and migration
  notes.
- [Development Setup](./development/setup.md): install, run, test, lint, and
  common workflows.

## Feature Docs

- [Authentication](./features/authentication.md): login, registration, session
  bootstrap, SSO callback handling, and interactive auth.
- [End-to-End Encryption](./features/e2ee-encryption.md): encryption setup,
  recovery keys, verification, and room encryption behavior.
- [Local Matrix Testing](./development/matrix-local-testing.md): local Synapse
  setup and Cypress auth smoke coverage.
- [Tandem Spaces](./features/tandem-spaces.md): relationship model, invites,
  shared spaces, and pending room creation.
- [Chat Experience](./features/chat-experience.md): mobile-first shell, room
  views, preferences, and navigation.

## Package Docs

- [Web App README](../apps/web/README.md)
- [Core Package README](../packages/core/README.md)
