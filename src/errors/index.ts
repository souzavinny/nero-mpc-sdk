import type { SDKErrorCode } from "../types";

export { SDKError } from "../types";
import { SDKError } from "../types";

export class AuthError extends SDKError {
	constructor(
		message: string,
		code: SDKErrorCode,
		statusCode?: number,
		details?: Record<string, unknown>,
	) {
		super(message, code, statusCode, details);
		this.name = "AuthError";
	}

	static notAuthenticated(): AuthError {
		return new AuthError("User not authenticated", "NOT_AUTHENTICATED");
	}

	static tokenExpired(): AuthError {
		return new AuthError(
			"Authentication token expired",
			"TOKEN_REFRESH_FAILED",
		);
	}

	static noRefreshToken(): AuthError {
		return new AuthError("No refresh token available", "NO_REFRESH_TOKEN");
	}
}

export class NetworkError extends SDKError {
	public retryable: boolean;

	constructor(
		message: string,
		code: SDKErrorCode,
		statusCode?: number,
		details?: Record<string, unknown>,
		retryable = false,
	) {
		super(message, code, statusCode, details);
		this.name = "NetworkError";
		this.retryable = retryable;
	}

	static timeout(): NetworkError {
		return new NetworkError(
			"Request timed out",
			"REQUEST_FAILED",
			undefined,
			undefined,
			true,
		);
	}

	static connectionFailed(cause?: string): NetworkError {
		return new NetworkError(
			cause ? `Connection failed: ${cause}` : "Connection failed",
			"REQUEST_FAILED",
			undefined,
			undefined,
			true,
		);
	}
}

export class WalletError extends SDKError {
	constructor(
		message: string,
		code: SDKErrorCode,
		statusCode?: number,
		details?: Record<string, unknown>,
	) {
		super(message, code, statusCode, details);
		this.name = "WalletError";
	}

	static noWallet(): WalletError {
		return new WalletError("No wallet available", "NO_WALLET");
	}

	static keyShareMissing(): WalletError {
		return new WalletError("No key share found", "NO_KEY_SHARE");
	}

	static notInitialized(): WalletError {
		return new WalletError("SDK not initialized", "NOT_INITIALIZED");
	}
}

export class SigningError extends SDKError {
	constructor(
		message: string,
		code: SDKErrorCode,
		statusCode?: number,
		details?: Record<string, unknown>,
	) {
		super(message, code, statusCode, details);
		this.name = "SigningError";
	}

	static sessionConflict(activeSessionId?: string): SigningError {
		return new SigningError(
			"Signing session conflict",
			"SIGNING_SESSION_CONFLICT",
			409,
			activeSessionId ? { activeSessionId } : undefined,
		);
	}
}

export class ProtocolError extends SDKError {
	constructor(
		message: string,
		code: SDKErrorCode,
		statusCode?: number,
		details?: Record<string, unknown>,
	) {
		super(message, code, statusCode, details);
		this.name = "ProtocolError";
	}

	static dkgFailed(reason?: string): ProtocolError {
		return new ProtocolError(reason ?? "DKG protocol failed", "DKG_FAILED");
	}

	static dklsFailed(reason?: string): ProtocolError {
		return new ProtocolError(
			reason ?? "DKLS protocol failed",
			"DKLS_SIGNING_FAILED",
		);
	}
}
