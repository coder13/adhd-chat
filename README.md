# adhd-chat

A chat application built with Matrix protocol, using a Yarn workspace and Turborepo monorepo structure.

## Project Structure

```
adhd-chat/
├── apps/
│   └── web/              # Vite + React + TypeScript application
├── packages/
│   └── core/             # Core package with Matrix protocol integration
└── [config files]        # Shared configuration (ESLint, Prettier, Jest, Turbo)
```

## Getting Started

### Prerequisites

- Node.js >= 18
- Yarn 1.22.22

### Installation

```bash
yarn install
```

### Development

```bash
# Run all apps in development mode
yarn dev

# Run the web app only
cd apps/web
yarn dev
```

### Building

```bash
# Build all packages and apps
yarn build
```

### Testing

```bash
# Run all tests
yarn test
```

### Linting

```bash
# Lint all packages and apps
yarn lint
```

### Formatting

```bash
# Format all code with Prettier
yarn format
```

## Packages

### @adhd-chat/core

Core package providing Matrix protocol integration for the ADHD Chat application.

**Features:**

- Matrix client wrapper
- Authentication and session management
- Message synchronization

See [packages/core/README.md](packages/core/README.md) for more details.

### web

The main web application built with Vite, React, and TypeScript.

## Tech Stack

- **Monorepo:** Yarn Workspaces + Turborepo
- **Frontend:** React, TypeScript, Vite
- **Protocol:** Matrix (via matrix-js-sdk)
- **Testing:** Jest, React Testing Library
- **Code Quality:** ESLint, Prettier
- **Build Tool:** Turbo
