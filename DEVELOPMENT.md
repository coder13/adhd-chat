# Development Guide

This document provides detailed information about working with the ADHD Chat monorepo.

## Prerequisites

- Node.js >= 18
- Yarn 1.22.22

## Initial Setup

```bash
# Install all dependencies
yarn install

# Build all packages
yarn build
```

## Development Workflow

### Running the Web Application

```bash
# From the root directory
yarn dev

# Or run only the web app
cd apps/web
yarn dev
```

The web application will be available at http://localhost:5173

### Building Packages

```bash
# Build all packages
yarn build

# Build only the core package
cd packages/core
yarn build

# Build only the web app
cd apps/web
yarn build
```

### Testing

```bash
# Run all tests
yarn test

# Run tests for a specific package
cd packages/core
yarn test

# Run tests with coverage
yarn test --coverage
```

### Linting and Formatting

```bash
# Lint all packages
yarn lint

# Format all code
yarn format

# Check formatting without changing files
yarn format --check
```

## Working with the Core Package

The `@adhd-chat/core` package provides Matrix protocol integration.

### Using the Core Package

```typescript
import { MatrixChatClient } from '@adhd-chat/core';

// Create a client instance
const client = new MatrixChatClient({
  baseUrl: 'https://matrix.org',
});

// Initialize the client
await client.initialize();

// Login with credentials
await client.login('username', 'password');

// Start syncing
await client.startSync();

// Get the underlying Matrix client
const matrixClient = client.getClient();
```

### Adding Dependencies to Core Package

```bash
cd packages/core
yarn add <package-name>
```

## Working with the Web Application

### Adding Dependencies to Web App

```bash
cd apps/web
yarn add <package-name>
```

### Using the Core Package in Web App

The web app already includes `@adhd-chat/core` as a dependency. You can import it like any other package:

```typescript
import { MatrixChatClient } from '@adhd-chat/core';
```

## Turborepo Features

### Cache Management

Turborepo caches build outputs to speed up subsequent builds:

```bash
# Clear the cache
rm -rf .turbo

# Build with verbose output
yarn build --verbose
```

### Running Specific Tasks

```bash
# Run build for specific workspace
turbo run build --filter=@adhd-chat/core

# Run build for web app
turbo run build --filter=web
```

## Adding New Packages

1. Create a new directory under `packages/`
2. Create a `package.json` with a unique name (e.g., `@adhd-chat/new-package`)
3. Add build scripts matching the turbo.json configuration
4. Run `yarn install` from the root to link it
5. Import it in other packages using the package name

## Troubleshooting

### Build Errors

If you encounter build errors:

1. Clear all build outputs: `rm -rf packages/*/dist apps/*/dist`
2. Clear turbo cache: `rm -rf .turbo`
3. Reinstall dependencies: `rm -rf node_modules && yarn install`
4. Rebuild: `yarn build`

### Type Errors

If TypeScript is reporting errors about missing types:

1. Ensure all packages are built: `yarn build`
2. Check that `@adhd-chat/core` is listed in dependencies (not devDependencies)
3. Restart your IDE/TypeScript server

### Test Failures

If tests are failing:

1. Ensure packages are built before running tests: `yarn build`
2. Check that test configuration files (jest.config.cjs) are present
3. Run tests with verbose output: `yarn test --verbose`

## Project Structure

```
adhd-chat/
├── apps/
│   └── web/              # React + Vite application
│       ├── src/
│       ├── package.json
│       └── ...
├── packages/
│   └── core/             # Matrix integration package
│       ├── src/
│       │   ├── matrix-client.ts
│       │   ├── index.ts
│       │   └── __tests__/
│       ├── package.json
│       └── tsconfig.json
├── package.json          # Root package.json with workspaces
├── turbo.json            # Turborepo configuration
├── jest.config.js        # Root Jest configuration
├── .eslintrc.json        # ESLint configuration
├── .prettierrc.json      # Prettier configuration
└── README.md
```

## Tips

- Always run commands from the root directory when possible
- Use `yarn` (not `npm`) to maintain consistency with the workspace setup
- Turbo will automatically determine the correct build order based on dependencies
- The first build will take longer, but subsequent builds will be cached
