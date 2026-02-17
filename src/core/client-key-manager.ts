import type { KeyShare, WalletInfo } from "../types";
import { SDKError } from "../types";
import { generateRandomHex, hashSha256 } from "./crypto-primitives";
import { type SecureKeyStorage, createSecureStorage } from "./secure-storage";

export interface KeyManagerConfig {
	storagePrefix?: string;
}

export class ClientKeyManager {
	private storage: SecureKeyStorage;
	private currentUserId: string | null = null;
	private cachedKeyShare: KeyShare | null = null;
	private cachedPartyShares: Map<number, string> | null = null;

	constructor(deviceKey: string, config: KeyManagerConfig = {}) {
		this.storage = createSecureStorage(
			deviceKey,
			config.storagePrefix ?? "nero",
		);
	}

	async initialize(userId: string): Promise<void> {
		this.currentUserId = userId;
		this.cachedKeyShare = await this.storage.getKeyShare(userId);
	}

	async hasKeyShare(): Promise<boolean> {
		if (!this.currentUserId) {
			return false;
		}
		return this.storage.hasKeyShare(this.currentUserId);
	}

	async getKeyShare(): Promise<KeyShare | null> {
		if (this.cachedKeyShare) {
			return this.cachedKeyShare;
		}

		if (!this.currentUserId) {
			return null;
		}

		this.cachedKeyShare = await this.storage.getKeyShare(this.currentUserId);
		return this.cachedKeyShare;
	}

	async storeKeyShare(keyShare: KeyShare): Promise<void> {
		if (!this.currentUserId) {
			throw new SDKError("User not initialized", "USER_NOT_INITIALIZED");
		}

		await this.storage.storeKeyShare(this.currentUserId, keyShare);
		this.cachedKeyShare = keyShare;
	}

	async getPartyPublicShares(): Promise<Map<number, string> | null> {
		if (this.cachedPartyShares) {
			return this.cachedPartyShares;
		}

		if (!this.currentUserId) {
			return null;
		}

		this.cachedPartyShares = await this.storage.getPartyPublicShares(
			this.currentUserId,
		);
		return this.cachedPartyShares;
	}

	async storePartyPublicShares(shares: Map<number, string>): Promise<void> {
		if (!this.currentUserId) {
			throw new SDKError("User not initialized", "USER_NOT_INITIALIZED");
		}

		await this.storage.storePartyPublicShares(this.currentUserId, shares);
		this.cachedPartyShares = shares;
	}

	async storePublicKey(publicKey: string): Promise<void> {
		if (!this.currentUserId) {
			throw new SDKError("User not initialized", "USER_NOT_INITIALIZED");
		}
		await this.storage.storePublicKey(this.currentUserId, publicKey);
	}

	async getPublicKey(): Promise<string | null> {
		if (!this.currentUserId) return null;
		return this.storage.getPublicKey(this.currentUserId);
	}

	async storeBackendShare(share: string): Promise<void> {
		if (!this.currentUserId) {
			throw new SDKError("User not initialized", "USER_NOT_INITIALIZED");
		}
		await this.storage.storeBackendShare(this.currentUserId, share);
	}

	async getBackendShare(): Promise<string | null> {
		if (!this.currentUserId) return null;
		return this.storage.getBackendShare(this.currentUserId);
	}

	async deleteKeyShare(): Promise<void> {
		if (!this.currentUserId) {
			return;
		}

		await this.storage.deleteKeyShare(this.currentUserId);
		this.cachedKeyShare = null;
	}

	async rotateKeyShare(newKeyShare: KeyShare): Promise<void> {
		if (!this.currentUserId) {
			throw new SDKError("User not initialized", "USER_NOT_INITIALIZED");
		}

		const existingShare = await this.getKeyShare();
		if (!existingShare) {
			throw new SDKError("No existing key share to rotate", "NO_KEY_SHARE");
		}

		if (existingShare.partyId !== newKeyShare.partyId) {
			throw new SDKError(
				"Party ID mismatch during rotation",
				"PARTY_ID_MISMATCH",
			);
		}

		await this.storeKeyShare(newKeyShare);
	}

	async exportBackup(password: string): Promise<string> {
		const keyShare = await this.getKeyShare();
		if (!keyShare) {
			throw new SDKError("No key share to export", "NO_KEY_SHARE");
		}

		const { encryptWithPassword } = await import("./crypto-primitives");
		const encrypted = await encryptWithPassword(
			JSON.stringify(keyShare),
			password,
		);

		const backup = {
			version: 1,
			type: "nero-mpc-backup",
			data: encrypted,
			createdAt: Date.now(),
		};

		return btoa(JSON.stringify(backup));
	}

	async importBackup(
		backupString: string,
		password: string,
	): Promise<KeyShare> {
		const backup = JSON.parse(atob(backupString));

		if (backup.type !== "nero-mpc-backup") {
			throw new SDKError("Invalid backup format", "INVALID_BACKUP");
		}

		if (backup.version !== 1) {
			throw new SDKError(
				`Unsupported backup version: ${backup.version}`,
				"UNSUPPORTED_VERSION",
			);
		}

		const { decryptWithPassword } = await import("./crypto-primitives");
		const plaintext = await decryptWithPassword(backup.data, password);
		const keyShare = JSON.parse(plaintext) as KeyShare;

		return keyShare;
	}

	getWalletInfo(publicKey: string, chainId: number): WalletInfo {
		const eoaAddress = this.deriveEOAAddress(publicKey);

		return {
			eoaAddress,
			publicKey,
			chainId,
		};
	}

	private deriveEOAAddress(publicKey: string): string {
		let pubKeyBytes: Uint8Array;
		const pubKeyHex = publicKey.startsWith("0x")
			? publicKey.slice(2)
			: publicKey;

		if (pubKeyHex.length === 130) {
			pubKeyBytes = hexToBytes(pubKeyHex.slice(2));
		} else if (pubKeyHex.length === 128) {
			pubKeyBytes = hexToBytes(pubKeyHex);
		} else {
			throw new SDKError("Invalid public key format", "INVALID_PUBLIC_KEY");
		}

		const hash = keccak256(pubKeyBytes);
		const addressBytes = hash.slice(-20);
		return `0x${bytesToHex(addressBytes)}`;
	}

	async clear(): Promise<void> {
		await this.storage.clearAll();
		this.currentUserId = null;
		this.cachedKeyShare = null;
		this.cachedPartyShares = null;
	}
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function keccak256(data: Uint8Array): Uint8Array {
	const { keccak_256 } = require("@noble/hashes/sha3");
	return keccak_256(data);
}

export function generateDeviceKey(): string {
	return generateRandomHex(32);
}

export function deriveDeviceKey(
	userAgent: string,
	userId: string,
	additionalEntropy?: string,
): string {
	const combined = [userAgent, userId, additionalEntropy ?? ""].join(":");
	return hashSha256(combined);
}
