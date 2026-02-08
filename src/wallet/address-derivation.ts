import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

export function deriveEOAAddress(publicKey: string): string {
	let pubKeyHex = publicKey.startsWith("0x") ? publicKey.slice(2) : publicKey;

	if (pubKeyHex.startsWith("04")) {
		pubKeyHex = pubKeyHex.slice(2);
	}

	if (pubKeyHex.length !== 128) {
		throw new Error(
			`Invalid public key length: expected 128 hex chars (64 bytes), got ${pubKeyHex.length}`,
		);
	}

	const pubKeyBytes = hexToBytes(pubKeyHex);
	const hash = keccak_256(pubKeyBytes);
	const addressBytes = hash.slice(-20);

	return `0x${bytesToHex(addressBytes)}`;
}

/**
 * @deprecated This function produces incorrect addresses.
 * Use SmartWallet.getSmartWalletAddress() or SimpleAccount.getAccountAddress()
 * which call the factory's getAddress() method via RPC.
 */
export function deriveSmartWalletAddress(
	_factoryAddress: string,
	_ownerAddress: string,
	_salt = 0n,
): string {
	throw new Error(
		"deriveSmartWalletAddress is deprecated. " +
			"Use SmartWallet.getSmartWalletAddress() or SimpleAccount.getAccountAddress() " +
			"which call the factory's getAddress() method via RPC.",
	);
}

export function computeCreate2Address(
	factoryAddress: string,
	salt: string,
	initCodeHash: string,
): string {
	const CREATE2_PREFIX = "ff";

	const factoryHex = factoryAddress.slice(2).toLowerCase();
	const saltHex = salt.startsWith("0x") ? salt.slice(2) : salt;
	const initCodeHashHex = initCodeHash.startsWith("0x")
		? initCodeHash.slice(2)
		: initCodeHash;

	const packedData = hexToBytes(
		CREATE2_PREFIX + factoryHex + saltHex.padStart(64, "0") + initCodeHashHex,
	);

	const hash = keccak_256(packedData);
	const addressBytes = hash.slice(-20);

	return `0x${bytesToHex(addressBytes)}`;
}

export function checksumAddress(address: string): string {
	const addr = address.toLowerCase().replace("0x", "");
	const hash = bytesToHex(keccak_256(new TextEncoder().encode(addr)));

	let checksummed = "0x";
	for (let i = 0; i < 40; i++) {
		if (Number.parseInt(hash[i], 16) >= 8) {
			checksummed += addr[i].toUpperCase();
		} else {
			checksummed += addr[i];
		}
	}

	return checksummed;
}

export function isValidAddress(address: string): boolean {
	if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
		return false;
	}
	return true;
}
