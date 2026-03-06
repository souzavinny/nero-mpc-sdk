import { beforeEach, describe, expect, it, vi } from "vitest";
import { SDKError } from "../types";

describe("SDKError details field", () => {
	it("should carry details from API error response", () => {
		const error = new SDKError("Conflict", "SIGNING_SESSION_CONFLICT", 409, {
			activeSessionId: "signing-123",
			code: "SIGNING_SESSION_CONFLICT",
		});
		expect(error.details?.activeSessionId).toBe("signing-123");
		expect(error.statusCode).toBe(409);
		expect(error.code).toBe("SIGNING_SESSION_CONFLICT");
	});

	it("should work without details", () => {
		const error = new SDKError("fail", "REQUEST_FAILED", 500);
		expect(error.details).toBeUndefined();
	});
});

describe("DKLSClient 409 conflict retry", () => {
	it("should cancel stale session using activeSessionId from error details", async () => {
		const mockCancel = vi.fn().mockResolvedValue({ sessionId: "stale-1" });
		const mockSigningResult = {
			signature: "0xsig",
			r: "0xr",
			s: "0xs",
			v: 27,
			messageHash: "0xhash",
		};
		let callCount = 0;
		const mockSigningInit = vi.fn().mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				throw new SDKError(
					"Concurrent signing",
					"SIGNING_SESSION_CONFLICT",
					409,
					{ activeSessionId: "stale-signing-session" },
				);
			}
			return {
				sessionId: "new-session-id",
				status: "initialized",
				backendNonceCommitment: { partyId: 1, commitment: "c" },
				walletAddress: "0xaddr",
			};
		});

		const { DKLSClient } = await import("../protocols/dkls/dkls-client");

		const storage = {
			get: vi.fn().mockResolvedValue(
				JSON.stringify({
					keyShare: {
						secretShare: "a".repeat(64),
						publicShare: "b".repeat(66),
						jointPublicKey: "c".repeat(66),
						partyId: 1,
					},
					dkgSessionId: "dkg-session-1",
				}),
			),
			set: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
		};

		const apiClient = {
			dkls: {
				signingInit: mockSigningInit,
				signingCancel: mockCancel,
				signingNonce: vi.fn().mockResolvedValue({
					sessionId: "new-session-id",
					r: "0xr",
					rValue: "0xrv",
					backendNonceReveal: { partyId: 1, R: "R" },
					backendPartialSignature: { partyId: 1, sigma: "s", R: "R" },
				}),
				mtaRound1: vi.fn().mockResolvedValue({
					mta1Response: { sessionId: "s", response: { responses: [] } },
					mta2Response: { sessionId: "s", response: { responses: [] } },
				}),
				mtaRound2: vi.fn().mockResolvedValue({ success: true }),
				signingPartial: vi.fn().mockResolvedValue(mockSigningResult),
			},
		};

		const client = new DKLSClient({
			apiClient: apiClient as any,
			storage,
		});

		await client.loadKeyShare();

		try {
			await client.sign({
				messageHash: `0x${"a".repeat(64)}`,
				messageType: "message",
				dkgSessionId: "dkg-session-1",
			});
		} catch {
			// Signing may fail due to crypto mocks, but we verify the cancel call
		}

		expect(mockCancel).toHaveBeenCalledWith("stale-signing-session");
	});

	it("should skip cancel when no activeSessionId in error details", async () => {
		const mockCancel = vi.fn();
		let callCount = 0;
		const mockSigningInit = vi.fn().mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				throw new SDKError(
					"Concurrent signing",
					"SIGNING_SESSION_CONFLICT",
					409,
				);
			}
			return {
				sessionId: "new-session-id",
				status: "initialized",
				backendNonceCommitment: { partyId: 1, commitment: "c" },
				walletAddress: "0xaddr",
			};
		});

		const { DKLSClient } = await import("../protocols/dkls/dkls-client");

		const storage = {
			get: vi.fn().mockResolvedValue(
				JSON.stringify({
					keyShare: {
						secretShare: "a".repeat(64),
						publicShare: "b".repeat(66),
						jointPublicKey: "c".repeat(66),
						partyId: 1,
					},
					dkgSessionId: "dkg-session-1",
				}),
			),
			set: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
		};

		const apiClient = {
			dkls: {
				signingInit: mockSigningInit,
				signingCancel: mockCancel,
				signingNonce: vi.fn().mockResolvedValue({
					sessionId: "new-session-id",
					r: "0xr",
					rValue: "0xrv",
					backendNonceReveal: { partyId: 1, R: "R" },
				}),
				mtaRound1: vi.fn().mockResolvedValue({
					mta1Response: { sessionId: "s", response: { responses: [] } },
					mta2Response: { sessionId: "s", response: { responses: [] } },
				}),
				mtaRound2: vi.fn().mockResolvedValue({ success: true }),
				signingPartial: vi.fn().mockResolvedValue({
					signature: "0xsig",
					r: "0xr",
					s: "0xs",
					v: 27,
				}),
			},
		};

		const client = new DKLSClient({
			apiClient: apiClient as any,
			storage,
		});

		await client.loadKeyShare();

		try {
			await client.sign({
				messageHash: `0x${"a".repeat(64)}`,
				messageType: "message",
				dkgSessionId: "dkg-session-1",
			});
		} catch {
			// Expected
		}

		expect(mockCancel).not.toHaveBeenCalled();
	});
});

describe("NeroMpcSDK event system", () => {
	it("should register and invoke event listeners", async () => {
		const { NeroMpcSDK } = await import("../nero-sdk");
		const sdk = new NeroMpcSDK({
			backendUrl: "https://api.test.com",
			chainId: 689,
		});

		const listener = vi.fn();
		sdk.on("initialized", listener);

		(sdk as any).emit("initialized", undefined);

		expect(listener).toHaveBeenCalledOnce();
		expect(listener).toHaveBeenCalledWith(undefined);
	});

	it("should unregister listeners with off()", async () => {
		const { NeroMpcSDK } = await import("../nero-sdk");
		const sdk = new NeroMpcSDK({
			backendUrl: "https://api.test.com",
			chainId: 689,
		});

		const listener = vi.fn();
		sdk.on("login", listener);
		sdk.off("login", listener);

		(sdk as any).emit("login", { user: { id: "u1" } });

		expect(listener).not.toHaveBeenCalled();
	});

	it("should support multiple listeners for the same event", async () => {
		const { NeroMpcSDK } = await import("../nero-sdk");
		const sdk = new NeroMpcSDK({
			backendUrl: "https://api.test.com",
			chainId: 689,
		});

		const listener1 = vi.fn();
		const listener2 = vi.fn();
		sdk.on("connected", listener1);
		sdk.on("connected", listener2);

		(sdk as any).emit("connected", { chainId: 689 });

		expect(listener1).toHaveBeenCalledWith({ chainId: 689 });
		expect(listener2).toHaveBeenCalledWith({ chainId: 689 });
	});

	it("should not throw when emitting with no listeners", async () => {
		const { NeroMpcSDK } = await import("../nero-sdk");
		const sdk = new NeroMpcSDK({
			backendUrl: "https://api.test.com",
			chainId: 689,
		});

		expect(() => {
			(sdk as any).emit("disconnected", undefined);
		}).not.toThrow();
	});
});

describe("Token encryption", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("should encrypt tokens when deviceKey is available", async () => {
		const { NeroMpcSDK } = await import("../nero-sdk");
		const sdk = new NeroMpcSDK({
			backendUrl: "https://api.test.com",
			chainId: 689,
			storagePrefix: "test-enc",
		});

		(sdk as any).deviceKey = "test-device-key-32chars-abcdefgh";

		const tokens = {
			accessToken: "at-123",
			refreshToken: "rt-456",
			expiresAt: Date.now() + 3600000,
		};

		await (sdk as any).storeTokens(tokens);

		const stored = localStorage.getItem("test-enc:tokens");
		expect(stored).toBeTruthy();

		const parsed = JSON.parse(stored!);
		expect(parsed).not.toHaveProperty("accessToken");
		expect(parsed).toHaveProperty("ciphertext");
	});

	it("should decrypt and restore tokens", async () => {
		const { NeroMpcSDK } = await import("../nero-sdk");
		const sdk = new NeroMpcSDK({
			backendUrl: "https://api.test.com",
			chainId: 689,
			storagePrefix: "test-rt",
		});

		(sdk as any).deviceKey = "test-device-key-32chars-abcdefgh";

		const tokens = {
			accessToken: "at-789",
			refreshToken: "rt-012",
			expiresAt: Date.now() + 3600000,
		};

		await (sdk as any).storeTokens(tokens);

		const loaded = await (sdk as any).loadStoredTokens();
		expect(loaded?.accessToken).toBe("at-789");
		expect(loaded?.refreshToken).toBe("rt-012");
	});

	it("should store plaintext when deviceKey is not set", async () => {
		const { NeroMpcSDK } = await import("../nero-sdk");
		const sdk = new NeroMpcSDK({
			backendUrl: "https://api.test.com",
			chainId: 689,
			storagePrefix: "test-plain",
		});

		(sdk as any).deviceKey = null;

		const tokens = {
			accessToken: "at-plain",
			refreshToken: "rt-plain",
			expiresAt: Date.now() + 3600000,
		};

		await (sdk as any).storeTokens(tokens);

		const stored = localStorage.getItem("test-plain:tokens");
		const parsed = JSON.parse(stored!);
		expect(parsed.accessToken).toBe("at-plain");
	});
});
