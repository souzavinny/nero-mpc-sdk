# @nerochain/mpc-sdk

Browser-based threshold signature client for self-custodial wallets. Uses MPC-TSS (Multi-Party Computation Threshold Signature Schemes) to generate and manage Ethereum wallets from social logins.

## Installation

```bash
npm install @nerochain/mpc-sdk
```

## Quick Start

```typescript
import { NeroMpcSDK } from "@nerochain/mpc-sdk";

const sdk = new NeroMpcSDK({
  backendUrl: "https://your-api.example.com",
  chainId: 689, // NERO Testnet
  // protocol defaults to "dkls"; use "pedersen" for legacy Pedersen DKG
});

await sdk.initialize();

// 1. Authenticate via OAuth
const { url } = await sdk.getOAuthUrl("google", window.location.href);
window.location.href = url;

// 2. Handle the callback (after redirect)
const { user, requiresDKG } = await sdk.handleOAuthCallback(provider, code, state);

// 3. Generate wallet if first login
if (requiresDKG) {
  const wallet = await sdk.generateWallet();
}

// 4. Sign messages
const signature = await sdk.signMessage("Hello NERO");
```

## React Integration

```tsx
import { NeroMpcAuthProvider, useNeroConnect, useNeroUser } from "@nerochain/mpc-sdk/react";

function App() {
  return (
    <NeroMpcAuthProvider config={{ backendUrl: "https://your-api.example.com" }}>
      <Wallet />
    </NeroMpcAuthProvider>
  );
}

function Wallet() {
  const { connect, isLoading } = useNeroConnect();
  const { user } = useNeroUser();

  return user ? (
    <p>Connected: {user.walletAddress}</p>
  ) : (
    <button onClick={() => connect("google")} disabled={isLoading}>
      Login with Google
    </button>
  );
}
```

## Package Exports

| Export | Import Path | Description |
|--------|------------|-------------|
| Core SDK | `@nerochain/mpc-sdk` | Main SDK class, wallet operations, transport |
| React | `@nerochain/mpc-sdk/react` | Provider, hooks, theme context |
| Modal | `@nerochain/mpc-sdk/modal` | Pre-built login modal UI |
| No Modal | `@nerochain/mpc-sdk/no-modal` | Headless SDK for custom UI |
| Chains | `@nerochain/mpc-sdk/chains` | Chain configurations and manager |
| Account Abstraction | `@nerochain/mpc-sdk/aa` | ERC-4337 smart account support |

## Features

- **Social Login** - Google, GitHub, Apple, and more via OAuth
- **DKLS Protocol (Default)** - 2-party threshold ECDSA (key never reconstructed on server)
- **Pedersen DKG** - Legacy protocol, available via `protocol: "pedersen"`
- **ERC-4337** - Smart account support with bundler and paymaster
- **Multi-Chain** - NERO Chain, Ethereum, Polygon, Arbitrum, Base
- **React Hooks** - `useNeroConnect`, `useNeroUser`, `useNeroWallet`, and more
- **External Wallets** - WalletConnect, MetaMask SDK, Coinbase Wallet
- **Theming** - Full whitelabel support with light/dark modes

## Peer Dependencies

Required:
- `@noble/curves` ^1.4.0
- `@noble/hashes` ^1.4.0

Optional (install based on features you use):
- `react` ^18.0.0 || ^19.0.0 (for React hooks)
- `@walletconnect/ethereum-provider` ^2.0.0 (for WalletConnect)
- `@metamask/sdk` ^0.20.0 (for MetaMask)
- `@coinbase/wallet-sdk` ^4.0.0 (for Coinbase Wallet)

## License

MIT
