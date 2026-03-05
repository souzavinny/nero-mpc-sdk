import type { StorageAdapter } from "../types";
import { MemoryStorage } from "./secure-storage";

export class LocalStorageAdapter implements StorageAdapter {
	async get(key: string): Promise<string | null> {
		return localStorage.getItem(key);
	}

	async set(key: string, value: string): Promise<void> {
		localStorage.setItem(key, value);
	}

	async delete(key: string): Promise<void> {
		localStorage.removeItem(key);
	}

	async clear(): Promise<void> {
		console.warn(
			"[NeroMpcSDK] LocalStorageAdapter.clear() is a no-op. Use delete() for specific keys.",
		);
	}
}

export class SessionStorageAdapter implements StorageAdapter {
	async get(key: string): Promise<string | null> {
		return sessionStorage.getItem(key);
	}

	async set(key: string, value: string): Promise<void> {
		sessionStorage.setItem(key, value);
	}

	async delete(key: string): Promise<void> {
		sessionStorage.removeItem(key);
	}

	async clear(): Promise<void> {
		console.warn(
			"[NeroMpcSDK] SessionStorageAdapter.clear() is a no-op. Use delete() for specific keys.",
		);
	}
}

export function createTokenStorage(): StorageAdapter {
	if (typeof localStorage !== "undefined") {
		return new LocalStorageAdapter();
	}
	return new MemoryStorage("tokens");
}
