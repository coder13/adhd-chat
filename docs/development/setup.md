# Development Setup

## Prerequisites

- Node.js 18 or newer
- Yarn 1.22.22

## Install

```bash
yarn install
```

## Common Commands

```bash
yarn dev
yarn build
yarn test
yarn lint
yarn typecheck
yarn format
yarn format:check
```

## Workspace Commands

```bash
cd apps/web && yarn dev
cd apps/web && yarn build
cd packages/core && yarn test
cd packages/core && yarn typecheck
```

## Development Workflow

1. Install dependencies with `yarn install`.
2. Start the app with `yarn dev`.
3. Make changes in the relevant workspace.
4. Validate with `yarn lint`, `yarn typecheck`, and `yarn test`.
5. Run `yarn format` before finishing larger edits.

## Turbo Notes

- Turbo handles task fan-out across workspaces.
- Linting and typechecking are separate tasks, so both should be run before
  merging.

## Troubleshooting

### Dependency Drift

```bash
yarn install
```

### Type or Build Cache Issues

```bash
rm -rf .turbo
yarn build
```

### Test Issues

```bash
yarn test --verbose
```
