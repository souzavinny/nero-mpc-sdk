import { describe, expect, it } from "vitest";
import {
	AuthError,
	NetworkError,
	ProtocolError,
	SigningError,
	WalletError,
} from "../errors";
import { SDKError } from "../types";

describe("Error Hierarchy", () => {
	describe("AuthError", () => {
		it("should be instanceof SDKError", () => {
			const err = AuthError.notAuthenticated();
			expect(err).toBeInstanceOf(SDKError);
			expect(err).toBeInstanceOf(AuthError);
		});

		it("notAuthenticated() should have correct code", () => {
			const err = AuthError.notAuthenticated();
			expect(err.code).toBe("NOT_AUTHENTICATED");
			expect(err.message).toContain("authenticated");
		});

		it("tokenExpired() should have correct code", () => {
			const err = AuthError.tokenExpired();
			expect(err.code).toBe("TOKEN_REFRESH_FAILED");
		});

		it("should preserve name for stack traces", () => {
			const err = AuthError.notAuthenticated();
			expect(err.name).toBe("AuthError");
		});
	});

	describe("NetworkError", () => {
		it("should be instanceof SDKError", () => {
			const err = NetworkError.timeout();
			expect(err).toBeInstanceOf(SDKError);
			expect(err).toBeInstanceOf(NetworkError);
		});

		it("timeout() should be retryable", () => {
			const err = NetworkError.timeout();
			expect(err.retryable).toBe(true);
		});

		it("connectionFailed() should be retryable", () => {
			const err = NetworkError.connectionFailed();
			expect(err.retryable).toBe(true);
		});

		it("should default retryable to false", () => {
			const err = new NetworkError("custom", "REQUEST_FAILED");
			expect(err.retryable).toBe(false);
		});
	});

	describe("WalletError", () => {
		it("should be instanceof SDKError", () => {
			const err = WalletError.noWallet();
			expect(err).toBeInstanceOf(SDKError);
			expect(err).toBeInstanceOf(WalletError);
		});

		it("noWallet() should have correct code", () => {
			const err = WalletError.noWallet();
			expect(err.code).toBe("NO_WALLET");
		});

		it("notInitialized() should have correct code", () => {
			const err = WalletError.notInitialized();
			expect(err.code).toBe("NOT_INITIALIZED");
		});

		it("keyShareMissing() should have correct code", () => {
			const err = WalletError.keyShareMissing();
			expect(err.code).toBe("NO_KEY_SHARE");
		});
	});

	describe("SigningError", () => {
		it("should be instanceof SDKError", () => {
			const err = SigningError.sessionConflict();
			expect(err).toBeInstanceOf(SDKError);
			expect(err).toBeInstanceOf(SigningError);
		});

		it("sessionConflict() should have 409 status", () => {
			const err = SigningError.sessionConflict("sess-123");
			expect(err.statusCode).toBe(409);
			expect(err.code).toBe("SIGNING_SESSION_CONFLICT");
			expect(err.details?.activeSessionId).toBe("sess-123");
		});

		it("sessionConflict() without id should have no details", () => {
			const err = SigningError.sessionConflict();
			expect(err.statusCode).toBe(409);
			expect(err.details).toBeUndefined();
		});
	});

	describe("ProtocolError", () => {
		it("should be instanceof SDKError", () => {
			const err = ProtocolError.dkgFailed();
			expect(err).toBeInstanceOf(SDKError);
			expect(err).toBeInstanceOf(ProtocolError);
		});

		it("dkgFailed() should use default message", () => {
			const err = ProtocolError.dkgFailed();
			expect(err.message).toBe("DKG protocol failed");
			expect(err.code).toBe("DKG_FAILED");
		});

		it("dkgFailed() should accept custom reason", () => {
			const err = ProtocolError.dkgFailed("commitment mismatch");
			expect(err.message).toBe("commitment mismatch");
		});

		it("dklsFailed() should have correct code", () => {
			const err = ProtocolError.dklsFailed();
			expect(err.code).toBe("DKLS_SIGNING_FAILED");
		});
	});

	describe("Cross-cutting", () => {
		it("all error subclasses should work with instanceof SDKError", () => {
			const errors = [
				AuthError.notAuthenticated(),
				NetworkError.timeout(),
				WalletError.noWallet(),
				SigningError.sessionConflict(),
				ProtocolError.dkgFailed(),
			];
			for (const err of errors) {
				expect(err).toBeInstanceOf(SDKError);
			}
		});

		it("catch(SDKError) should catch all subclasses", () => {
			const fn = () => {
				throw AuthError.notAuthenticated();
			};
			try {
				fn();
			} catch (e) {
				expect(e).toBeInstanceOf(SDKError);
				expect(e).toBeInstanceOf(AuthError);
			}
		});
	});
});
