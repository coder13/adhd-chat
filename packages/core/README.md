# @adhd-chat/core

Core package for ADHD Chat application, providing Matrix protocol integration.

## Features

- Matrix protocol client wrapper
- Authentication and session management
- Message synchronization

## Usage

```typescript
import { MatrixChatClient } from '@adhd-chat/core';

const client = new MatrixChatClient({
  baseUrl: 'https://matrix.org',
});

await client.initialize();
await client.login('username', 'password');
await client.startSync();
```
