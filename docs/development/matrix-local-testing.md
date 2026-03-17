# Local Matrix Testing

## Overview

The repo includes a local Synapse stack for development and Cypress coverage for
the password login flow.

## Start Synapse

Use Docker Compose from the repo root:

```bash
yarn matrix:synapse:up
```

The local homeserver will be available at `http://localhost:8008` and uses the
server name `localhost`.

Useful commands:

```bash
yarn matrix:synapse:logs
yarn matrix:synapse:down
```

## Start The Web App

In a separate terminal:

```bash
cd apps/web
yarn dev
```

The Vite app runs at `http://127.0.0.1:5175`.

## Password Login

The login screen now supports both SSO and password-based sign-in. For the
local Synapse stack:

- Homeserver URL: `http://localhost:8008`
- Login mode: `Password`
- Username: local username or Matrix ID
- Password: the password set for that account

## Cypress Auth Smoke Test

The Cypress smoke test provisions a disposable Matrix account through the local
Synapse admin registration API, then signs in through the app UI.

Run it from `apps/web` after Synapse and the Vite app are running:

```bash
yarn test:e2e:auth
```

The test uses these defaults:

- App base URL: `http://127.0.0.1:5175`
- Matrix base URL: `http://localhost:8008`
- Matrix server name: `localhost`
- Synapse registration shared secret: `dev_registration_secret`

Override them if needed:

```bash
CYPRESS_MATRIX_BASE_URL=http://localhost:8008 \
CYPRESS_MATRIX_SERVER_NAME=localhost \
CYPRESS_MATRIX_SHARED_SECRET=dev_registration_secret \
yarn test:e2e:auth
```

## CI

GitHub Actions runs the same flow in
[`matrix-auth-e2e.yml`](../../.github/workflows/matrix-auth-e2e.yml):

- installs dependencies
- starts the local Synapse Docker stack
- waits for the homeserver health endpoint
- runs the password auth hook test
- starts the Vite app and executes the Cypress auth smoke test
