import "fake-indexeddb/auto";

const cryptoMock = {
	getRandomValues: (buffer: Uint8Array): Uint8Array => {
		for (let i = 0; i < buffer.length; i++) {
			buffer[i] = Math.floor(Math.random() * 256);
		}
		return buffer;
	},
	subtle: {
		importKey: async (
			_format: string,
			_keyData: BufferSource,
			algorithm: AlgorithmIdentifier,
			extractable: boolean,
			keyUsages: KeyUsage[],
		): Promise<CryptoKey> => {
			return {
				type: "secret",
				extractable,
				algorithm:
					typeof algorithm === "string" ? { name: algorithm } : algorithm,
				usages: keyUsages,
			} as CryptoKey;
		},
		deriveKey: async (
			_algorithm: AlgorithmIdentifier,
			_baseKey: CryptoKey,
			derivedKeyType: AlgorithmIdentifier,
			extractable: boolean,
			keyUsages: KeyUsage[],
		): Promise<CryptoKey> => {
			return {
				type: "secret",
				extractable,
				algorithm:
					typeof derivedKeyType === "string"
						? { name: derivedKeyType }
						: derivedKeyType,
				usages: keyUsages,
			} as CryptoKey;
		},
		encrypt: async (
			_algorithm: AlgorithmIdentifier,
			_key: CryptoKey,
			data: BufferSource,
		): Promise<ArrayBuffer> => {
			const dataArray = new Uint8Array(data as ArrayBuffer);
			const result = new Uint8Array(dataArray.length + 16);
			result.set(dataArray);
			return result.buffer;
		},
		decrypt: async (
			_algorithm: AlgorithmIdentifier,
			_key: CryptoKey,
			data: BufferSource,
		): Promise<ArrayBuffer> => {
			const dataArray = new Uint8Array(data as ArrayBuffer);
			return dataArray.slice(0, -16).buffer;
		},
	},
};

if (typeof globalThis.crypto === "undefined") {
	(globalThis as any).crypto = cryptoMock;
}

if (typeof globalThis.localStorage === "undefined") {
	const storage = new Map<string, string>();
	(globalThis as any).localStorage = {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
		removeItem: (key: string) => storage.delete(key),
		clear: () => storage.clear(),
		get length() {
			return storage.size;
		},
		key: (index: number) => Array.from(storage.keys())[index] ?? null,
	};
}

if (typeof globalThis.navigator === "undefined") {
	(globalThis as any).navigator = {
		userAgent: "test-user-agent",
	};
}

if (typeof globalThis.window === "undefined") {
	(globalThis as any).window = {
		location: {
			href: "http://localhost:3000",
		},
	};
}

if (typeof globalThis.btoa === "undefined") {
	(globalThis as any).btoa = (str: string) =>
		Buffer.from(str).toString("base64");
}

if (typeof globalThis.atob === "undefined") {
	(globalThis as any).atob = (str: string) =>
		Buffer.from(str, "base64").toString();
}
