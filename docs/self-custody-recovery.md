# Self-Custody Recovery

## The Problem

NERO MPC Auth uses 2-party threshold ECDSA (DKLS). The client holds `sk_A` and the backend holds `sk_B`. During normal operation, the full private key is never assembled - partial signatures are computed independently.

If the user loses their device, existing recovery restores `sk_A` from a backup. The backend still holds `sk_B`, so MPC signing resumes.

If NERO goes offline permanently, recovery fails. The user has `sk_A` but cannot access `sk_B`. Funds become inaccessible.

## The Solution

Self-custody recovery stores **both shares** in a single composite blob:

- `sk_A` (client share) - AES-256-GCM encrypted with an HKDF-derived key from the scrypt seed
- `sk_B` (backend share) - ECDH-encrypted to a password-derived public key

The full key `sk = sk_A * sk_B (mod q)` only exists at the explicit point of exit (offline recovery). It is never assembled during setup or normal operations.

## How It Works

### Setup Flow

```
User provides password
    |
    v
scrypt(password, salt) --> 32-byte seed
    |
    v
seed --> recoveryScalar --> recoveryPublicKey
    |
    v
POST /api/v2/wallet/key-material { ephemeralPublicKey: recoveryPublicKey }
    |
    v
Backend encrypts sk_B via ECDH(backendEphemeralKey, recoveryPublicKey)
    |
    v
SDK builds composite blob:
  {
    version: 2,
    encryptedClientShare: { ... },  <-- AES-GCM encrypted sk_A
    backendShareBlob: { ... },      <-- ECDH-encrypted sk_B
    sharingType: "multiplicative",
    kdfSalt: "...",
    kdfParams: { N, r, p },
    metadataMac: "..."             <-- HMAC over metadata fields
  }
    |
    v
Stored via factor API (password-protected)
```

**What each party knows during setup:**

| Party | Knows |
|-------|-------|
| User | Password (discarded after setup) |
| NERO backend | `sk_B`, encrypted blob (cannot decrypt without password), HKDF-derived credential from scrypt seed (for factor API envelope) |
| Composite blob | Encrypted `sk_A` + encrypted `sk_B` (both useless without password) |

The full key never exists in memory during setup.

### Normal Recovery (NERO Online)

Device lost, NERO still running:

1. User enters password
2. Factor API decrypts the outer envelope, returns composite blob
3. SDK calls `extractClientShare(compositeJson, password)` to decrypt and get `sk_A`
4. Restore `sk_A` to new device
5. Resume MPC signing with backend's `sk_B`

### Offline Recovery (NERO Unavailable)

Full exit scenario - user already has the composite blob stored locally or exported:

1. User provides composite blob + password
2. SDK re-derives seed from password + stored salt/params
3. Decrypts `sk_A` using HKDF-derived key from seed
4. ECDH-decrypts `sk_B` using the derived scalar
5. Reconstructs `sk = sk_A * sk_B (mod q)`
6. User imports the full private key into MetaMask, Rabby, etc.

## Usage

### Setup

```typescript
const sdk = new NeroMpcSDK(config);
await sdk.initialize();
// ... login and generate wallet ...

const { factorId } = await sdk.setupSelfCustodyRecovery("user-password-here");
// factorId can be stored for reference
```

### Offline Recovery

```typescript
// Works without SDK instance or network access
const { privateKey, walletAddress } = await NeroMpcSDK.offlineRecoverKey(
  compositeJson,        // the stored composite blob
  "user-password-here", // same password used during setup
  "0x1234...",          // optional: verify address matches
);

// Import privateKey into any Ethereum wallet
```

### React Hook

```typescript
function RecoveryPanel() {
  const { setupSelfCustody, offlineRecover, isLoading, error } = useNeroRecovery();

  const handleSetup = async () => {
    const { factorId } = await setupSelfCustody("my-password");
  };

  const handleOfflineRecover = async () => {
    const { privateKey, walletAddress } = await offlineRecover(
      storedCompositeJson,
      "my-password",
    );
  };
}
```

## Security Properties

| Property | During Setup | During Offline Recovery |
|----------|-------------|----------------------|
| Full private key in memory | Never | Only at point of reconstruction |
| Password in memory | Briefly (scrypt input) | Briefly (scrypt input) |
| `sk_A` in memory | Yes (read from storage, then encrypted) | Yes (after AES-GCM decrypt) |
| `sk_B` in memory | Never (encrypted blob passed through) | Yes (after ECDH decrypt) |
| Network required | Yes (key-material API) | No |

### Brute-Force Resistance

- scrypt with N=2^17, r=8, p=1 (131072 iterations)
- Each password attempt requires ~128MB memory and ~100ms on modern hardware
- Rate limiting on `/api/v2/wallet/key-material` prevents online enumeration

### Comparison with Web3Auth

| | NERO Self-Custody | Web3Auth |
|---|---|---|
| Full key assembly | Only during explicit offline exit | Every login session |
| Server compromise | Attacker gets `sk_B` but needs `sk_A` from user device | Attacker gets share; user's device share + social recovery share can reconstruct |
| Offline recovery | Yes, with password-derived key | Requires at least 2 of 3 shares from different storage providers |

## Cryptographic Parameters

| Parameter | Value |
|-----------|-------|
| KDF | scrypt |
| scrypt N | 131072 (2^17) |
| scrypt r | 8 |
| scrypt p | 1 |
| scrypt dkLen | 32 bytes |
| Key derivation | seed -> scalar (mod secp256k1 order) -> public key |
| Client share encryption | HKDF(SHA-256, seed) + AES-256-GCM |
| Client share HKDF info | `nero-mpc:self-custody:client-share` |
| Backend share encryption | ECDH + HKDF(SHA-256) + AES-256-GCM |
| Backend share HKDF info | `nero-mpc:ecdh:share-exchange` |
| Factor API credential | HKDF(seed, "nero-mpc:self-custody:factor-credential") - memory-hard by scrypt inheritance, not replayable |
| Metadata integrity | HMAC-SHA-256 over version, sharingType, kdfSalt, kdfParams (keyed by HKDF-derived mac key from seed). Required field - stripping it rejects the blob at parse time. |
| KDF param limits | N: [1024, 2^20] power of 2; r: [1, 64]; p: [1, 16] |
| Minimum password length | 12 characters |
| AES-GCM nonce | 12 bytes (random) |
| AES-GCM tag | 128 bits |
| Curve | secp256k1 |
| Secret reconstruction | Multiplicative: `sk = sk_A * sk_B (mod q)` |
| | Additive: `sk = 2*sk_A - sk_B (mod q)` |
