# Local Signing Integration Guide

This guide walks through integrating `@nerochain/mpc-sdk` with local signing into a React + wagmi application. Instead of routing every signature through MPC backend round-trips, the SDK's `getKeyMaterial()` reconstructs the full private key on the client, enabling instant offline signing.

## Architecture

```
OAuth → sdk.handleOAuthCallback() → sdk.generateWallet() (first time only)
  → sdk.getKeyMaterial() → reconstructed private key
  → LocalKeyProvider (EIP-1193, backed by ethers.Wallet)
  → wagmi connector returns LocalKeyProvider
  → useEthersSigner() converts to ethers.js Signer
  → All signing happens locally, no backend round-trips
```

The key insight: everything above the provider layer (AA account, signature context, hooks) works unchanged. Swapping the MPC provider for a local ethers.Wallet-backed provider is transparent to the rest of the stack.

## Prerequisites

- `@nerochain/mpc-sdk` with `getKeyMaterial()` support
- `ethers` v5 (already in most wagmi projects)
- `wagmi` with custom connector support

## Step 1: Create a LocalKeyProvider

Create an EIP-1193 compliant provider that wraps `ethers.Wallet` for local signing and forwards read-only RPC calls to the network.

```typescript
// src/config/localKeyProvider.ts
import { ethers } from 'ethers'

export class LocalKeyProvider {
  private wallet: ethers.Wallet
  private rpcProvider: ethers.providers.JsonRpcProvider
  private chainId: number

  constructor(privateKey: string, rpcUrl: string, chainId: number) {
    this.rpcProvider = new ethers.providers.JsonRpcProvider(rpcUrl)
    this.wallet = new ethers.Wallet(privateKey, this.rpcProvider)
    this.chainId = chainId
  }

  get address(): string {
    return this.wallet.address
  }

  async request({ method, params }: { method: string; params?: any[] }): Promise<any> {
    switch (method) {
      case 'eth_accounts':
      case 'eth_requestAccounts':
        return [this.wallet.address]

      case 'eth_chainId':
        return '0x' + this.chainId.toString(16)

      case 'personal_sign': {
        const [message] = params ?? []
        const bytes = ethers.utils.arrayify(message)
        return this.wallet.signMessage(bytes)
      }

      case 'eth_signTypedData_v4': {
        const [, typedDataJson] = params ?? []
        const typedData = typeof typedDataJson === 'string'
          ? JSON.parse(typedDataJson) : typedDataJson
        const { domain, types, message: value } = typedData
        const filteredTypes = { ...types }
        delete filteredTypes.EIP712Domain
        return this.wallet._signTypedData(domain, filteredTypes, value)
      }

      case 'eth_sendTransaction': {
        const [txParams] = params ?? []
        const tx = await this.wallet.sendTransaction({
          to: txParams.to,
          value: txParams.value
            ? ethers.BigNumber.from(txParams.value) : undefined,
          data: txParams.data,
          gasLimit: txParams.gas
            ? ethers.BigNumber.from(txParams.gas) : undefined,
        })
        return tx.hash
      }

      default:
        return this.rpcProvider.send(method, params ?? [])
    }
  }
}
```

The provider handles three categories:
- **Signing methods** (`personal_sign`, `eth_signTypedData_v4`, `eth_sendTransaction`) — executed locally via ethers.Wallet
- **Account/chain queries** (`eth_accounts`, `eth_chainId`) — answered from local state
- **Everything else** (`eth_call`, `eth_getBalance`, `eth_estimateGas`, etc.) — forwarded to the JSON-RPC provider

## Step 2: Add Key Reconstruction to the SDK Manager

The SDK manager singleton gains three responsibilities: reconstruct the key, cache it for the session, and create local providers from it.

```typescript
// src/config/neroSdkManager.ts
import {
  NeroMpcSDK,
  type SDKConfig,
  type ReconstructedKey,
} from '@nerochain/mpc-sdk'
import { LocalKeyProvider } from './localKeyProvider'

class NeroSdkManager {
  private sdk: NeroMpcSDK | null = null
  private initPromise: Promise<void> | null = null
  private reconstructedKey: ReconstructedKey | null = null

  // ... existing initialize(), waitForInit(), getSDK(), etc.

  async reconstructKey(): Promise<ReconstructedKey> {
    if (this.reconstructedKey) return this.reconstructedKey
    if (!this.sdk) throw new Error('SDK not initialized')
    this.reconstructedKey = await this.sdk.getKeyMaterial()
    return this.reconstructedKey
  }

  getReconstructedKey(): ReconstructedKey | null {
    return this.reconstructedKey
  }

  createLocalProvider(rpcUrl: string, chainId: number): LocalKeyProvider {
    if (!this.reconstructedKey) throw new Error('Key not reconstructed')
    return new LocalKeyProvider(
      this.reconstructedKey.privateKey, rpcUrl, chainId
    )
  }

  clearState(): void {
    this.reconstructedKey = null
  }
}

export const neroSdkManager = new NeroSdkManager()
```

`getKeyMaterial()` is rate-limited (5 calls/hour), so caching is essential. The key is reconstructed once after authentication and held in memory for the session. `clearState()` wipes it on disconnect.

## Step 3: Call getKeyMaterial() After Authentication

In the OAuth callback handler, call `reconstructKey()` after wallet generation completes. This fetches the backend's key share, decrypts it with an ephemeral ECDH key pair, and reconstructs the full private key.

```typescript
// src/components/features/connect/NeroOAuthCallbackHandler.tsx
const run = async () => {
  await neroSdkManager.waitForInit()
  const sdk = neroSdkManager.getSDK()
  if (!sdk) return

  const result = await sdk.handleOAuthCallback(provider, code, state, redirectUri)

  // Generate wallet only for new users
  if (!sdk.hasWallet) {
    try {
      await sdk.generateWallet()
    } catch (err: any) {
      if (!err?.message?.includes('already has a wallet')) throw err
    }
  }

  // Reconstruct the full private key from both shares
  await neroSdkManager.reconstructKey()

  // Connect the wagmi connector
  const neroConn = connectors.find((c) => c.id === 'nero-mpc')
  if (neroConn) connect({ connector: neroConn })
}
```

**Important**: Only call `generateWallet()` when `!sdk.hasWallet`. For returning users, the wallet already exists on the backend — calling `generateWallet()` would fail with "User already has a wallet". The `getKeyMaterial()` call works regardless of whether the wallet was just created or already existed.

## Step 4: Wire the wagmi Connector to Use the Local Provider

The connector returns the `LocalKeyProvider` instead of the SDK's built-in MPC provider. The provider is cached per session to avoid re-instantiation.

```typescript
// src/config/neroConnector.ts
import { createConnector } from 'wagmi'
import { neroSdkManager } from './neroSdkManager'
import type { LocalKeyProvider } from './localKeyProvider'

let cachedLocalProvider: LocalKeyProvider | null = null

function getLocalProvider(chainId: number, rpcUrl: string): LocalKeyProvider {
  if (!cachedLocalProvider) {
    cachedLocalProvider = neroSdkManager.createLocalProvider(rpcUrl, chainId)
  }
  return cachedLocalProvider
}

export function neroMpcConnector() {
  return createConnector((config) => ({
    id: 'nero-mpc',
    name: 'NERO Wallet',
    type: 'nero-mpc',

    async connect() {
      await neroSdkManager.waitForInit()
      const sdk = neroSdkManager.getSDK()

      if (sdk?.isAuthenticated && sdk?.hasWallet) {
        if (!neroSdkManager.getReconstructedKey()) {
          await neroSdkManager.reconstructKey()
        }
        const chainId = config.chains[0].id
        const rpcUrl = config.chains[0].rpcUrls.default.http[0]
        const provider = getLocalProvider(chainId, rpcUrl)
        return {
          accounts: [provider.address as `0x${string}`],
          chainId,
        }
      }

      // ... OAuth redirect flow for unauthenticated users
    },

    async disconnect() {
      const sdk = neroSdkManager.getSDK()
      if (sdk) {
        await sdk.logout()
        neroSdkManager.clearState()
        cachedLocalProvider = null
      }
    },

    async getAccounts() {
      const key = neroSdkManager.getReconstructedKey()
      if (!key) return []
      return [key.walletAddress as `0x${string}`]
    },

    async getChainId() {
      return config.chains[0].id
    },

    async getProvider() {
      const key = neroSdkManager.getReconstructedKey()
      if (!key) return undefined
      const chainId = config.chains[0].id
      const rpcUrl = config.chains[0].rpcUrls.default.http[0]
      return getLocalProvider(chainId, rpcUrl)
    },

    async isAuthorized() {
      await neroSdkManager.waitForInit()
      const sdk = neroSdkManager.getSDK()
      return !!(
        sdk?.isAuthenticated &&
        sdk?.hasWallet &&
        neroSdkManager.getReconstructedKey()
      )
    },

    // ... event handlers
  }))
}
```

Key changes from an MPC-based connector:
- `connect()` returns the local wallet address, not the MPC provider's address
- `getProvider()` returns `LocalKeyProvider`, not `sdk.provider`
- `getAccounts()` reads from the cached `ReconstructedKey`
- `isAuthorized()` checks for the reconstructed key in addition to auth state
- `disconnect()` calls `clearState()` to wipe the private key from memory

## Complete Flow

1. User clicks "Connect" and selects an OAuth provider (Google, GitHub, etc.)
2. Browser redirects to the OAuth provider, then back with `code` + `state`
3. `NeroOAuthCallbackHandler` processes the callback:
   - `sdk.handleOAuthCallback()` — authenticates the user
   - `sdk.generateWallet()` — runs DKG if this is a new user
   - `neroSdkManager.reconstructKey()` — calls `getKeyMaterial()` which:
     - Generates an ephemeral ECDH key pair
     - Sends the public key to the backend
     - Backend encrypts its key share with the ephemeral public key
     - SDK decrypts the share, combines with the client share
     - Returns `{ privateKey, walletAddress, publicKey, protocol }`
4. wagmi connector creates a `LocalKeyProvider` from the private key
5. `useEthersSigner()` converts the provider to an ethers.js Signer
6. All signing (UserOps, personal_sign, typed data) happens locally

## Security Considerations

- The private key exists in browser memory only for the duration of the session
- `clearState()` on disconnect wipes the key from the manager
- `getKeyMaterial()` is rate-limited server-side (5 calls/hour) to prevent abuse
- The ephemeral ECDH exchange ensures the key share is encrypted in transit
- The backend share is never stored on the client beyond the reconstruction step

## What Stays Unchanged

The local provider is a drop-in replacement. These layers require zero modifications:
- `useEthersSigner()` hook — converts any EIP-1193 provider to ethers Signer
- `SimpleAccount` — uses the Signer for UserOp signing
- `AccountManagerContext` — manages AA accounts
- `SignatureContext` — handles signature requests
- All transaction hooks (`useAAtransfer`, `useSendUserOp`, etc.)
