# React Matrix E2EE implementation

This page explains the minimum end-to-end encryption architecture that another React Matrix client should copy from Element Web.

The important idea is that "E2EE" is not one feature. In practice you need all of these working together:

- Rust crypto initialization
- secret storage (4S / SSSS)
- cross-signing
- key backup
- device verification
- encrypted room creation defaults

## Relevant files in this repo

- `apps/web/src/MatrixClientPeg.ts`
- `apps/web/src/SecurityManager.ts`
- `apps/web/src/CreateCrossSigning.ts`
- `apps/web/src/stores/InitialCryptoSetupStore.ts`
- `apps/web/src/stores/SetupEncryptionStore.ts`
- `apps/web/src/utils/crypto/shouldSkipSetupEncryption.ts`
- `apps/web/src/utils/direct-messages.ts`
- `apps/web/src/utils/rooms.ts`
- `docs/e2ee.md`

## Startup order

Element initializes encryption before starting sync:

1. create `MatrixClient`
2. start client store
3. call `initRustCrypto(...)`
4. register crypto callbacks for secret storage access
5. start the client

That ordering matters. If your app starts syncing before crypto is initialized, you will end up debugging partial encryption state and decryption races.

## Create the client with crypto callbacks

Element passes `crossSigningCallbacks` when creating the client. Those callbacks let the SDK ask the app for secret-storage keys when it needs them.

Sketch:

```ts
const client = createClient({
    baseUrl,
    accessToken,
    userId,
    deviceId,
    cryptoCallbacks: crossSigningCallbacks,
});

await client.store.startup();
await client.initRustCrypto({
    storageKey,
});
await client.startClient({
    lazyLoadMembers: true,
    pendingEventOrdering: PendingEventOrdering.Detached,
});
```

If you omit the callbacks, secret storage and cross-signing flows become much harder to integrate cleanly.

## Encrypt the local crypto store

Element allows the Rust crypto IndexedDB to be encrypted with either:

- a raw 32-byte storage key
- a password that derives the storage key

For a production app, do not leave the crypto store unencrypted unless you have a deliberate reason. Element logs a warning when no storage key is supplied.

## Secret storage access pattern

`SecurityManager.ts` contains the most reusable pattern in this area.

The SDK may need the secret-storage key multiple times during one operation. Prompting the user every time is not acceptable, so Element does this:

1. enter a scoped "secret storage access" operation
2. prompt once for passphrase or recovery key if needed
3. cache the key only for that operation
4. clear the cache afterwards

That is the right model for another React app too. Do not permanently keep the recovery key in memory just because one bootstrap flow needs it.

## What `accessSecretStorage()` is really doing

Element's `accessSecretStorage()` is the main orchestrator for encryption bootstrap. It ensures that:

- secret storage exists
- cross-signing keys are bootstrapped if needed
- secret storage is bootstrapped if needed
- UI auth is performed if the homeserver requires it

This is the core behavior to reproduce. Any action that needs encryption secrets should go through one gatekeeper function instead of each feature trying to bootstrap crypto independently.

## Cross-signing

Cross-signing gives the account a cryptographic identity and lets the user verify devices in a scalable way.

Element uses `createCrossSigning()` to:

1. call `cryptoApi.bootstrapCrossSigning()`
2. handle interactive auth if the server requires it

Important detail: creating cross-signing keys is not the same as backing them up. The code comments in `CreateCrossSigning.ts` explicitly call this out.

If your app stops after cross-signing is created, the user can still lose their crypto identity when they lose the session.

## Key backup and recovery

Element handles recovery through secret storage and key backup together.

The post-registration setup in `InitialCryptoSetupStore` does this:

1. create cross-signing keys
2. check whether key backup exists
3. enable it if it exists
4. otherwise create a fresh backup

That is a sensible default for a new React app as well. Treat recovery as part of account setup, not as an obscure settings page users discover after they lose a device.

## Device verification

A working E2EE client needs a path to verify:

- the current device after login on a new session
- other devices belonging to the same user
- other users in encrypted rooms

Element splits this into dedicated stores and dialogs rather than burying it inside room views.

For another app, keep verification state centralized. You will need to react to crypto events and ongoing verification requests from many parts of the UI.

## When to show encryption setup

Element does not blindly force the user through setup in every case.

`shouldSkipSetupEncryption()` skips setup when:

- encryption is force-disabled by well-known config
- and the user is not already in encrypted rooms

That is a good rule. Your app should gate encryption UX on actual capability and account state, not on a hardcoded assumption that every account needs the same setup flow immediately.

## Encrypted room creation defaults

Element's room-creation logic uses two levels of defaulting:

1. global default from `/.well-known/matrix/client`
2. per-room decision based on whether the target users have device keys

The default helper is `privateShouldBeEncrypted()`.

For DMs, `determineCreateRoomEncryptionOption()` turns encryption on when:

- encryption is enabled by default
- and the DM target can be encrypted to

For a React client, this means room creation UI should not just expose a checkbox. It should make a policy decision from:

- server policy
- target membership
- whether device keys exist

## UI auth is part of E2EE setup

This is easy to miss. Encryption bootstrap can require interactive auth, especially when uploading cross-signing keys.

Element handles this by passing an `authUploadDeviceSigningKeys` callback into `bootstrapCrossSigning()` and showing an interactive auth dialog when needed.

If your app supports SSO or delegated auth, account security flows still need a UI-auth story. E2EE setup is not independent from auth.

## Suggested React structure

- `src/matrix/createMatrixClient.ts`
- `src/crypto/secretStorage.ts`
- `src/crypto/bootstrap.ts`
- `src/crypto/recovery.ts`
- `src/crypto/verification.ts`
- `src/crypto/CryptoProvider.tsx`
- `src/features/settings/EncryptionSettingsPage.tsx`

Keep encryption orchestration out of general-purpose room components. It becomes unmaintainable quickly.

## Minimal implementation plan

If the other project wants the smallest viable secure setup, implement in this order:

1. Initialize Rust crypto before `startClient()`.
2. Add scoped secret-storage access with passphrase or recovery-key prompt.
3. Add cross-signing bootstrap with UI auth support.
4. Add key-backup bootstrap after cross-signing.
5. Add current-device verification UX.
6. Add encrypted DM creation defaults.

That sequence gets you from "messages decrypt sometimes" to a client that users can actually keep using across devices.

## Common mistakes

- Starting the client before crypto is initialized.
- Treating cross-signing as equivalent to recovery.
- Keeping secret-storage keys cached longer than a single operation.
- Forcing encryption setup even when encryption is disabled by policy.
- Creating encrypted rooms without checking whether the targets have device keys.
- Forgetting that E2EE bootstrap may require interactive auth.
