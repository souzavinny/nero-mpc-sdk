import { beforeEach, describe, expect, it } from "vitest";
import {
	LocalStorageAdapter,
	SessionStorageAdapter,
	createTokenStorage,
} from "../core/storage-adapters";

describe("LocalStorageAdapter", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("should store and retrieve values", async () => {
		const adapter = new LocalStorageAdapter();
		await adapter.set("key1", "value1");
		const result = await adapter.get("key1");
		expect(result).toBe("value1");
	});

	it("should return null for missing keys", async () => {
		const adapter = new LocalStorageAdapter();
		const result = await adapter.get("nonexistent");
		expect(result).toBeNull();
	});

	it("should delete values", async () => {
		const adapter = new LocalStorageAdapter();
		await adapter.set("key1", "value1");
		await adapter.delete("key1");
		const result = await adapter.get("key1");
		expect(result).toBeNull();
	});

	it("should overwrite existing values", async () => {
		const adapter = new LocalStorageAdapter();
		await adapter.set("key1", "v1");
		await adapter.set("key1", "v2");
		expect(await adapter.get("key1")).toBe("v2");
	});
});

describe("SessionStorageAdapter", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it("should store and retrieve values", async () => {
		const adapter = new SessionStorageAdapter();
		await adapter.set("sess-key", "sess-value");
		expect(await adapter.get("sess-key")).toBe("sess-value");
	});

	it("should return null for missing keys", async () => {
		const adapter = new SessionStorageAdapter();
		expect(await adapter.get("missing")).toBeNull();
	});

	it("should delete values", async () => {
		const adapter = new SessionStorageAdapter();
		await adapter.set("sess-key", "val");
		await adapter.delete("sess-key");
		expect(await adapter.get("sess-key")).toBeNull();
	});
});

describe("createTokenStorage", () => {
	it("should return LocalStorageAdapter when localStorage is available", () => {
		const storage = createTokenStorage();
		expect(storage).toBeInstanceOf(LocalStorageAdapter);
	});

	it("should return a storage adapter that can read and write", async () => {
		const storage = createTokenStorage();
		await storage.set("test-key", "test-val");
		expect(await storage.get("test-key")).toBe("test-val");
		await storage.delete("test-key");
		expect(await storage.get("test-key")).toBeNull();
	});
});
