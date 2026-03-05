# ADR-001: Communication Architecture Improvements

**Date:** 2026-03-05
**Status:** Implemented

## Context

The SDK's transport layer had several architectural weaknesses identified through comparison with Web3Auth's web SDK:
- Monolithic 1625-line `APIClient` with 70+ methods
- No retry logic for transient failures
- Flat error codes requiring string comparison
- Hardcoded `localStorage` for token storage (breaks SSR)
- Unvalidated connection state transitions

## Decision

Implement 5 phases of improvements:

### Phase 1: Request Pipeline with Retry Middleware
- Composable middleware chain via `createPipeline()`
- Default retry middleware: 3 retries, exponential backoff with jitter
- Respects `Retry-After` header on 429s
- Only retries idempotent methods (GET/HEAD/OPTIONS/PUT/DELETE)

### Phase 2: API Client Decomposition
- Split into 12 domain modules: auth, session, dkg, dkls, wallet, backup, recovery, factor, mfa, user, audit, admin
- Each module receives a `RequestFn` dependency
- `APIClient` becomes a thin facade with namespaced access
- All call sites migrated (no deprecated methods)

### Phase 3: Hierarchical Error System
- Subclasses: `AuthError`, `NetworkError`, `WalletError`, `SigningError`, `ProtocolError`
- Factory methods: `AuthError.notAuthenticated()`, `WalletError.noWallet()`, etc.
- `NetworkError` carries `retryable` flag
- All subclasses are `instanceof SDKError` for backward compatibility

### Phase 4: Configurable Storage Strategy
- `LocalStorageAdapter` and `SessionStorageAdapter` implementing `StorageAdapter`
- `createTokenStorage()` factory with MemoryStorage fallback
- `SDKConfig.storage` option for custom storage backends

### Phase 5: Connection State Machine
- `ConnectionStateMachine` with validated transitions
- Invalid transitions are no-ops with `console.warn`
- `once()` method for one-shot event listeners
- Event listener errors are logged instead of silently swallowed

## Consequences

- Network resilience improved for all SDK consumers (retry middleware on by default)
- Domain modules are independently testable
- Error handling is type-safe with `instanceof` checks
- SSR/Next.js compatibility via configurable storage
- Connection state bugs prevented by transition validation

## Excluded Patterns

- Plugin system (NERO's `WalletServicesPlugin` is sufficient)
- Remote config fetching (adds latency and failure modes)
- Connector abstraction (solves a different problem)
- Parallel init with `Promise.allSettled` (NERO's init is inherently sequential)
