import type { EncryptedKeyShare, KeyShare, StorageAdapter } from "../types";
import {
	type EncryptionResult,
	decryptWithPassword,
	encryptWithPassword,
	hashSha256,
} from "./crypto-primitives";

const DB_NAME = "nero-mpc-sdk";
const DB_VERSION = 1;
const STORE_NAME = "encrypted-data";

interface StoredItem {
	key: string;
	value: string;
	createdAt: number;
	updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
		};

		request.onsuccess = () => {
			resolve(request.result);
		};

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "key" });
			}
		};
	});
}

export class IndexedDBStorage implements StorageAdapter {
	private prefix: string;

	constructor(prefix = "nero") {
		this.prefix = prefix;
	}

	private prefixKey(key: string): string {
		return `${this.prefix}:${key}`;
	}

	async get(key: string): Promise<string | null> {
		const db = await openDatabase();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readonly");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.get(this.prefixKey(key));

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const item = request.result as StoredItem | undefined;
				resolve(item?.value ?? null);
			};
		});
	}

	async set(key: string, value: string): Promise<void> {
		const db = await openDatabase();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const now = Date.now();
			const item: StoredItem = {
				key: this.prefixKey(key),
				value,
				createdAt: now,
				updatedAt: now,
			};
			const request = store.put(item);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async delete(key: string): Promise<void> {
		const db = await openDatabase();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.delete(this.prefixKey(key));

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async clear(): Promise<void> {
		const db = await openDatabase();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);

			const cursorRequest = store.openCursor();
			cursorRequest.onerror = () => reject(cursorRequest.error);

			cursorRequest.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (cursor) {
					const key = cursor.key as string;
					if (key.startsWith(`${this.prefix}:`)) {
						cursor.delete();
					}
					cursor.continue();
				} else {
					resolve();
				}
			};
		});
	}
}

export class MemoryStorage implements StorageAdapter {
	private store = new Map<string, string>();
	private prefix: string;

	constructor(prefix = "nero") {
		this.prefix = prefix;
	}

	private prefixKey(key: string): string {
		return `${this.prefix}:${key}`;
	}

	async get(key: string): Promise<string | null> {
		return this.store.get(this.prefixKey(key)) ?? null;
	}

	async set(key: string, value: string): Promise<void> {
		this.store.set(this.prefixKey(key), value);
	}

	async delete(key: string): Promise<void> {
		this.store.delete(this.prefixKey(key));
	}

	async clear(): Promise<void> {
		const keysToDelete: string[] = [];
		for (const key of this.store.keys()) {
			if (key.startsWith(`${this.prefix}:`)) {
				keysToDelete.push(key);
			}
		}
		for (const key of keysToDelete) {
			this.store.delete(key);
		}
	}
}

const ENCRYPTION_VERSION = 1;

export class SecureKeyStorage {
	private storage: StorageAdapter;
	private deviceKey: string;

	constructor(storage: StorageAdapter, deviceKey: string) {
		this.storage = storage;
		this.deviceKey = deviceKey;
	}

	private getStorageKey(userId: string): string {
		return `keyshare:${hashSha256(userId)}`;
	}

	private getPartySharesKey(userId: string): string {
		return `partyshares:${hashSha256(userId)}`;
	}

	async storeKeyShare(userId: string, keyShare: KeyShare): Promise<void> {
		const plaintext = JSON.stringify(keyShare);
		const encrypted = await encryptWithPassword(plaintext, this.deviceKey);

		const storedData: EncryptedKeyShare = {
			ciphertext: encrypted.ciphertext,
			iv: encrypted.iv,
			salt: encrypted.salt,
			version: ENCRYPTION_VERSION,
		};

		await this.storage.set(
			this.getStorageKey(userId),
			JSON.stringify(storedData),
		);
	}

	async getKeyShare(userId: string): Promise<KeyShare | null> {
		const stored = await this.storage.get(this.getStorageKey(userId));
		if (!stored) {
			return null;
		}

		const encryptedData = JSON.parse(stored) as EncryptedKeyShare;

		if (encryptedData.version !== ENCRYPTION_VERSION) {
			throw new Error(
				`Unsupported encryption version: ${encryptedData.version}`,
			);
		}

		const encrypted: EncryptionResult = {
			ciphertext: encryptedData.ciphertext,
			iv: encryptedData.iv,
			salt: encryptedData.salt,
		};

		const plaintext = await decryptWithPassword(encrypted, this.deviceKey);
		return JSON.parse(plaintext) as KeyShare;
	}

	async hasKeyShare(userId: string): Promise<boolean> {
		const stored = await this.storage.get(this.getStorageKey(userId));
		return stored !== null;
	}

	async deleteKeyShare(userId: string): Promise<void> {
		await this.storage.delete(this.getStorageKey(userId));
	}

	async storePartyPublicShares(
		userId: string,
		shares: Map<number, string>,
	): Promise<void> {
		const sharesArray = Array.from(shares.entries());
		const plaintext = JSON.stringify(sharesArray);
		const encrypted = await encryptWithPassword(plaintext, this.deviceKey);

		const storedData = {
			ciphertext: encrypted.ciphertext,
			iv: encrypted.iv,
			salt: encrypted.salt,
			version: ENCRYPTION_VERSION,
		};

		await this.storage.set(
			this.getPartySharesKey(userId),
			JSON.stringify(storedData),
		);
	}

	async getPartyPublicShares(
		userId: string,
	): Promise<Map<number, string> | null> {
		const stored = await this.storage.get(this.getPartySharesKey(userId));
		if (!stored) {
			return null;
		}

		const encryptedData = JSON.parse(stored);

		if (encryptedData.version !== ENCRYPTION_VERSION) {
			throw new Error(
				`Unsupported encryption version: ${encryptedData.version}`,
			);
		}

		const encrypted: EncryptionResult = {
			ciphertext: encryptedData.ciphertext,
			iv: encryptedData.iv,
			salt: encryptedData.salt,
		};

		const plaintext = await decryptWithPassword(encrypted, this.deviceKey);
		const sharesArray = JSON.parse(plaintext) as Array<[number, string]>;
		return new Map(sharesArray);
	}

	async deletePartyPublicShares(userId: string): Promise<void> {
		await this.storage.delete(this.getPartySharesKey(userId));
	}

	async clearAll(): Promise<void> {
		await this.storage.clear();
	}
}

export function createSecureStorage(
	deviceKey: string,
	prefix = "nero",
): SecureKeyStorage {
	const isIndexedDBAvailable =
		typeof indexedDB !== "undefined" && indexedDB !== null;

	const adapter = isIndexedDBAvailable
		? new IndexedDBStorage(prefix)
		: new MemoryStorage(prefix);

	return new SecureKeyStorage(adapter, deviceKey);
}
