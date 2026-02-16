import type {
	AuthTokens,
	CustomLoginOptions,
	DeviceFingerprint,
	OAuthProviderInfo,
	SDKConfig,
	SessionReconnectResult,
	SessionStatus,
	SocialLoginResponse,
	User,
	WalletInfo,
} from "../types";
import { SDKError } from "../types";

interface APIResponse<T> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
	};
}

export class APIClient {
	private baseUrl: string;
	private apiKey: string | undefined;
	private deviceId: string | undefined;
	private tokens: AuthTokens | null = null;
	private refreshPromise: Promise<void> | null = null;

	constructor(config: SDKConfig) {
		this.baseUrl = config.backendUrl.replace(/\/$/, "");
		this.apiKey = config.apiKey;
		this.deviceId = config.deviceId;
	}

	setDeviceId(deviceId: string): void {
		this.deviceId = deviceId;
	}

	setTokens(tokens: AuthTokens): void {
		this.tokens = tokens;
	}

	getTokens(): AuthTokens | null {
		return this.tokens;
	}

	clearTokens(): void {
		this.tokens = null;
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
		requiresAuth = true,
	): Promise<T> {
		if (requiresAuth && this.tokens) {
			if (Date.now() >= this.tokens.expiresAt - 60000) {
				await this.refreshAccessToken();
			}
		}

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (this.apiKey) {
			headers["X-API-Key"] = this.apiKey;
		}

		if (this.deviceId) {
			headers["X-Device-Id"] = this.deviceId;
		}

		if (requiresAuth && this.tokens) {
			headers.Authorization = `Bearer ${this.tokens.accessToken}`;
		}

		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
			credentials: "include",
		});

		const data: APIResponse<T> = await response.json();

		if (!data.success) {
			throw new SDKError(
				data.error?.message ?? "Request failed",
				data.error?.code ?? "REQUEST_FAILED",
				response.status,
			);
		}

		return data.data as T;
	}

	private async refreshAccessToken(): Promise<void> {
		if (this.refreshPromise) {
			return this.refreshPromise;
		}

		this.refreshPromise = (async () => {
			if (!this.tokens?.refreshToken) {
				throw new SDKError("No refresh token available", "NO_REFRESH_TOKEN");
			}

			const refreshHeaders: Record<string, string> = {
				"Content-Type": "application/json",
			};
			if (this.apiKey) {
				refreshHeaders["X-API-Key"] = this.apiKey;
			}

			const response = await fetch(`${this.baseUrl}/api/v2/session/refresh`, {
				method: "POST",
				headers: refreshHeaders,
				body: JSON.stringify({
					refreshToken: this.tokens.refreshToken,
				}),
			});

			const data: APIResponse<{
				tokens: {
					accessToken: string;
					refreshToken: string;
					expiresIn: number;
				};
			}> = await response.json();

			if (!data.success || !data.data) {
				this.tokens = null;
				throw new SDKError("Token refresh failed", "TOKEN_REFRESH_FAILED");
			}

			this.tokens = {
				accessToken: data.data.tokens.accessToken,
				refreshToken: data.data.tokens.refreshToken,
				expiresAt: Date.now() + data.data.tokens.expiresIn * 1000,
			};
		})();

		try {
			await this.refreshPromise;
		} finally {
			this.refreshPromise = null;
		}
	}

	async getOAuthUrl(
		provider: string,
		redirectUri: string,
	): Promise<{ url: string; state: string }> {
		const data = await this.request<{
			authUrl: string;
			state: string;
		}>(
			"GET",
			`/api/v2/auth/oauth-url/${provider}?redirectUri=${encodeURIComponent(redirectUri)}`,
			undefined,
			false,
		);
		return { url: data.authUrl, state: data.state };
	}

	async handleOAuthCallback(
		provider: string,
		code: string,
		state: string,
		fingerprint: DeviceFingerprint,
		options?: { skipWalletGeneration?: boolean },
	): Promise<{
		user: User;
		tokens: AuthTokens;
		wallet?: WalletInfo;
		requiresDKG: boolean;
	}> {
		const result = await this.request<SocialLoginResponse>(
			"POST",
			"/api/v2/auth/social-login",
			{
				provider,
				code,
				state,
				deviceId: fingerprint.additionalData,
				skipWalletGeneration: options?.skipWalletGeneration,
			},
			false,
		);

		this.tokens = {
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			expiresAt: Date.now() + result.tokens.expiresIn * 1000,
			dappShare: result.dappShare,
		};

		const requiresDKG =
			result.wallet?.requiresKeyGeneration === true &&
			!result.wallet?.walletAddress;

		return {
			user: result.user,
			tokens: this.tokens,
			wallet: result.wallet?.walletAddress
				? {
						eoaAddress: result.wallet.walletAddress,
						publicKey: "",
						chainId: 0,
					}
				: undefined,
			requiresDKG,
		};
	}

	async getCurrentUser(): Promise<User> {
		const result = await this.request<{ user: User }>("GET", "/api/v2/auth/me");
		return result.user;
	}

	async logout(): Promise<void> {
		await this.request("POST", "/api/v2/auth/logout");
		this.tokens = null;
	}

	// Auth v2 methods

	async getOAuthProviders(): Promise<OAuthProviderInfo[]> {
		const result = await this.request<{
			providers: OAuthProviderInfo[];
		}>("GET", "/api/v2/auth/providers", undefined, false);
		return result.providers;
	}

	async sendEmailAuth(
		email: string,
		type: "otp" | "magic_link" = "otp",
	): Promise<{ message: string; expiresInMinutes: number }> {
		return this.request(
			"POST",
			"/api/v2/auth/email/send",
			{ email, type },
			false,
		);
	}

	async verifyEmailAuth(
		email: string,
		code: string,
		options?: { deviceId?: string; deviceName?: string },
	): Promise<{
		user: User;
		tokens: AuthTokens;
		requiresDKG: boolean;
	}> {
		const result = await this.request<SocialLoginResponse>(
			"POST",
			"/api/v2/auth/email/verify",
			{ email, code, ...options },
			false,
		);

		this.tokens = {
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			expiresAt: Date.now() + result.tokens.expiresIn * 1000,
			dappShare: result.dappShare,
		};

		const requiresDKG =
			result.wallet?.requiresKeyGeneration === true &&
			!result.wallet?.walletAddress;

		return { user: result.user, tokens: this.tokens, requiresDKG };
	}

	async sendPhoneOTP(
		phoneNumber: string,
	): Promise<{ message: string; expiresInMinutes: number }> {
		return this.request(
			"POST",
			"/api/v2/auth/phone/send",
			{ phoneNumber },
			false,
		);
	}

	async verifyPhoneOTP(
		phoneNumber: string,
		code: string,
		options?: { deviceId?: string; deviceName?: string },
	): Promise<{
		user: User;
		tokens: AuthTokens;
		requiresDKG: boolean;
	}> {
		const result = await this.request<SocialLoginResponse>(
			"POST",
			"/api/v2/auth/phone/verify",
			{ phoneNumber, code, ...options },
			false,
		);

		this.tokens = {
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			expiresAt: Date.now() + result.tokens.expiresIn * 1000,
			dappShare: result.dappShare,
		};

		const requiresDKG =
			result.wallet?.requiresKeyGeneration === true &&
			!result.wallet?.walletAddress;

		return { user: result.user, tokens: this.tokens, requiresDKG };
	}

	async customLogin(options: CustomLoginOptions): Promise<{
		user: User;
		tokens: AuthTokens;
		requiresDKG: boolean;
	}> {
		const result = await this.request<SocialLoginResponse>(
			"POST",
			"/api/v2/auth/custom-login",
			{
				verifier_id: options.verifierId,
				id_token: options.idToken,
				deviceId: options.deviceId,
				deviceName: options.deviceName,
				skipWalletGeneration: options.skipWalletGeneration,
			},
			false,
		);

		this.tokens = {
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			expiresAt: Date.now() + result.tokens.expiresIn * 1000,
			dappShare: result.dappShare,
		};

		const requiresDKG =
			result.wallet?.requiresKeyGeneration === true &&
			!result.wallet?.walletAddress;

		return { user: result.user, tokens: this.tokens, requiresDKG };
	}

	// Session methods

	async sessionRefresh(
		refreshToken: string,
		deviceId?: string,
	): Promise<{ tokens: AuthTokens; sessionLifetime: number }> {
		const result = await this.request<{
			tokens: {
				accessToken: string;
				refreshToken: string;
				expiresIn: number;
			};
			sessionLifetime: number;
		}>("POST", "/api/v2/session/refresh", { refreshToken, deviceId }, false);

		this.tokens = {
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			expiresAt: Date.now() + result.tokens.expiresIn * 1000,
		};

		return { tokens: this.tokens, sessionLifetime: result.sessionLifetime };
	}

	async sessionStatus(): Promise<SessionStatus> {
		return this.request("GET", "/api/v2/session/status");
	}

	async sessionReconnect(
		dappShare: string,
		deviceId?: string,
	): Promise<SessionReconnectResult> {
		const result = await this.request<{
			user: User;
			tokens: {
				accessToken: string;
				refreshToken: string;
				expiresIn: number;
			};
			sessionLifetime: number;
		}>(
			"POST",
			"/api/v2/session/reconnect",
			{ dapp_share: dappShare, device_id: deviceId },
			false,
		);

		this.tokens = {
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			expiresAt: Date.now() + result.tokens.expiresIn * 1000,
		};

		return {
			user: result.user,
			tokens: this.tokens,
			sessionLifetime: result.sessionLifetime,
		};
	}

	async sessionRevoke(): Promise<{ message: string }> {
		return this.request("POST", "/api/v2/session/revoke");
	}

	// DKG v2 methods (synchronous 3-step flow)

	async dkgInitiate(
		threshold?: number,
		totalParties?: number,
	): Promise<{
		sessionId: string;
		backendCommitment: {
			partyId: number;
			commitments: string[];
			publicKey: string;
			proofOfKnowledge: string;
		};
		ephemeralPublicKey: string;
		message: string;
	}> {
		return this.request("POST", "/api/v2/dkg/initiate", {
			threshold,
			totalParties,
		});
	}

	async dkgSubmitCommitment(
		sessionId: string,
		clientCommitment: {
			partyId: number;
			commitments: string[];
			publicKey: string;
			proofOfKnowledge: string;
		},
	): Promise<{
		sessionId: string;
		backendShareForClient: {
			fromPartyId: number;
			toPartyId: number;
			ephemeralPublicKey: string;
			ciphertext: string;
			nonce: string;
			tag: string;
		};
		message: string;
	}> {
		return this.request("POST", "/api/v2/dkg/commitment", {
			sessionId,
			clientCommitment,
		});
	}

	async dkgSubmitShare(
		sessionId: string,
		clientShare: {
			fromPartyId: number;
			toPartyId: number;
			ephemeralPublicKey: string;
			ciphertext: string;
			nonce: string;
			tag: string;
		},
	): Promise<{
		sessionId: string;
		publicKey: string;
		walletAddress: string;
		partyId: number;
		message: string;
	}> {
		return this.request("POST", "/api/v2/dkg/share", {
			sessionId,
			clientShare,
		});
	}

	async dkgGetSession(sessionId: string): Promise<{
		sessionId: string;
		status: string;
		threshold: number;
		totalParties: number;
		result: {
			publicKey: string;
			walletAddress: string;
			partyId: number;
		} | null;
		error: string | null;
		createdAt: string;
		completedAt: string | null;
	}> {
		return this.request("GET", `/api/v2/dkg/${sessionId}`);
	}

	async dkgCancel(sessionId: string): Promise<{
		sessionId: string;
		message: string;
	}> {
		return this.request("DELETE", `/api/v2/dkg/${sessionId}`);
	}

	// Wallet v2 methods

	async getWalletInfoV2(): Promise<{
		wallet: {
			address: string | null;
			hasWallet: boolean;
			createdAt: string;
		};
		mpc: {
			threshold: number;
			totalParties: number;
			activeParties: number;
			securityLevel: string;
			protocolVersion: string;
		};
		signing: {
			supported: string[];
		};
	}> {
		return this.request("GET", "/api/v2/wallet/info");
	}

	async listWallets(): Promise<{
		wallets: Array<{
			projectId: string;
			walletAddress: string;
			createdAt: string;
			mpcMode: string;
			thresholdMode: string;
		}>;
		count: number;
	}> {
		return this.request("GET", "/api/v2/wallet/list");
	}

	// Backup V2 API Methods

	async backupExport(password: string): Promise<{
		backup: import("../types").BackupData;
		fingerprint: string;
	}> {
		return this.request("POST", "/api/v2/backup/export", { password });
	}

	async backupImport(
		backup: import("../types").BackupData,
		password: string,
	): Promise<{
		partyId: number;
		publicKey: string;
		createdAt: string;
		verified: boolean;
	}> {
		return this.request("POST", "/api/v2/backup/import", {
			backup,
			password,
		});
	}

	async backupInfo(): Promise<import("../types").BackupInfo> {
		return this.request("GET", "/api/v2/backup/info");
	}

	// Recovery V2 API Methods

	async recoverySetup(
		methodType: import("../types").RecoveryMethodType,
		config: Record<string, unknown>,
		encryptedData?: string,
	): Promise<{
		method: {
			id: string;
			methodType: string;
			status: string;
			createdAt: string;
		};
		verificationRequired: boolean;
		expiresAt?: string;
	}> {
		return this.request("POST", "/api/v2/recovery/setup", {
			methodType,
			config: { methodType, ...config },
			encryptedData,
		});
	}

	async recoveryListMethods(includeInactive?: boolean): Promise<{
		methods: import("../types").RecoveryMethod[];
		count: number;
	}> {
		const query = includeInactive ? "?includeInactive=true" : "";
		return this.request("GET", `/api/v2/recovery/methods${query}`);
	}

	async recoveryDeleteMethod(methodId: string): Promise<{ deleted: true }> {
		return this.request("DELETE", `/api/v2/recovery/methods/${methodId}`);
	}

	async recoveryInitiate(
		methodId: string,
	): Promise<import("../types").RecoveryAttempt> {
		return this.request("POST", "/api/v2/recovery/initiate", { methodId });
	}

	async recoveryVerify(
		attemptId: string,
		verificationCode: string,
	): Promise<{
		attemptId: string;
		status: string;
		verified: boolean;
		canComplete: boolean;
		timelockExpiresAt: string | null;
	}> {
		return this.request("POST", "/api/v2/recovery/verify", {
			attemptId,
			verificationCode,
		});
	}

	async recoveryComplete(attemptId: string): Promise<{
		attemptId: string;
		status: string;
		recoveredData: unknown;
	}> {
		return this.request("POST", "/api/v2/recovery/complete", { attemptId });
	}

	async recoveryCancel(attemptId: string): Promise<{ cancelled: true }> {
		return this.request("POST", "/api/v2/recovery/cancel", { attemptId });
	}

	// Factors V2 API Methods

	async factorAdd(
		factorType: import("../types").FactorType,
		encryptedShare: string,
		options?: { password?: string; deviceFingerprint?: string },
	): Promise<{
		factor: {
			id: string;
			factorType: string;
			status: string;
			createdAt: string;
		};
		factorKey?: string;
	}> {
		return this.request("POST", "/api/v2/factors", {
			factorType,
			encryptedShare,
			...options,
		});
	}

	async factorList(): Promise<{
		factors: import("../types").Factor[];
		count: number;
	}> {
		return this.request("GET", "/api/v2/factors");
	}

	async factorDelete(id: string): Promise<{ deleted: true }> {
		return this.request("DELETE", `/api/v2/factors/${id}`);
	}

	async factorVerify(
		factorId: string,
		verificationCode: string,
	): Promise<{ verified: boolean }> {
		return this.request("POST", "/api/v2/factors/verify", {
			factorId,
			verificationCode,
		});
	}

	async factorRecoverShare(
		factorId: string,
		verificationCode: string,
	): Promise<{ recoveredShare: unknown }> {
		return this.request("POST", "/api/v2/factors/recover-share", {
			factorId,
			verificationCode,
		});
	}

	async factorRecoveryInitiate(factorId: string): Promise<{
		attemptId: string;
		status: string;
		requiresVerification: boolean;
	}> {
		return this.request("POST", "/api/v2/factors/recover/initiate", {
			factorId,
		});
	}

	async factorRecoveryVerify(
		attemptId: string,
		verificationCode: string,
	): Promise<{
		attemptId: string;
		status: string;
		verified: boolean;
		canComplete: boolean;
	}> {
		return this.request("POST", "/api/v2/factors/recover/verify", {
			attemptId,
			verificationCode,
		});
	}

	async factorRecoveryComplete(attemptId: string): Promise<{
		attemptId: string;
		status: string;
		recoveredData: unknown;
	}> {
		return this.request("POST", "/api/v2/factors/recover/complete", {
			attemptId,
		});
	}

	async factorRecoveryCancel(attemptId: string): Promise<{ cancelled: true }> {
		return this.request("POST", "/api/v2/factors/recover/cancel", {
			attemptId,
		});
	}

	// MFA V2 API Methods

	async mfaGetStatus(): Promise<import("../types").MFAStatus> {
		return this.request("GET", "/api/v2/mfa/status");
	}

	async mfaTotpSetup(): Promise<import("../types").TOTPSetupResponse> {
		return this.request("POST", "/api/v2/mfa/totp/setup");
	}

	async mfaTotpVerifySetup(
		methodId: string,
		code: string,
	): Promise<{
		methodId: string;
		methodType: string;
		backupCodesRemaining: number;
	}> {
		return this.request("POST", "/api/v2/mfa/totp/verify-setup", {
			methodId,
			code,
		});
	}

	async mfaWebAuthnSetup(): Promise<import("../types").WebAuthnSetupResponse> {
		return this.request("POST", "/api/v2/mfa/webauthn/setup");
	}

	async mfaWebAuthnVerifySetup(
		methodId: string,
		credential: Record<string, unknown>,
	): Promise<{ methodId: string; methodType: string }> {
		return this.request("POST", "/api/v2/mfa/webauthn/verify-setup", {
			methodId,
			credential,
		});
	}

	async mfaCreateChallenge(
		operation: import("../types").MFAOperationType,
		methodType?: import("../types").MFAMethodType,
	): Promise<import("../types").MFAChallenge> {
		return this.request("POST", "/api/v2/mfa/challenge", {
			operation,
			methodType,
		});
	}

	async mfaVerifyChallenge(
		challengeId: string,
		response: {
			code?: string;
			credential?: Record<string, unknown>;
			backupCode?: string;
		},
	): Promise<{
		verified: boolean;
		methodId: string;
		methodType: string;
		backupCodesRemaining?: number;
	}> {
		return this.request("POST", "/api/v2/mfa/verify", {
			challengeId,
			...response,
		});
	}

	async mfaDisableMethod(methodId: string): Promise<{
		methodId: string;
		disabled: boolean;
	}> {
		return this.request("DELETE", `/api/v2/mfa/methods/${methodId}`);
	}

	async mfaRegenerateBackupCodes(methodId: string): Promise<{
		backupCodes: string[];
		count: number;
	}> {
		return this.request("POST", `/api/v2/mfa/methods/${methodId}/backup-codes`);
	}

	async mfaUpdatePolicy(
		policy: import("../types").MFAPolicy,
	): Promise<Record<string, unknown>> {
		return this.request("PATCH", "/api/v2/mfa/policy", policy);
	}

	// User Management V2 API Methods

	async userGetProfile(): Promise<{ profile: import("../types").UserProfile }> {
		return this.request("GET", "/api/v2/users/profile");
	}

	async userUpdateProfile(data: {
		displayName?: string;
		profilePicture?: string;
	}): Promise<{ profile: Partial<import("../types").UserProfile> }> {
		return this.request("PUT", "/api/v2/users/profile", data);
	}

	async userDeleteAccount(
		confirmation: string,
		password?: string,
	): Promise<{ message: string }> {
		return this.request("DELETE", "/api/v2/users/profile", {
			confirmation,
			password,
		});
	}

	async userGetSessions(): Promise<{
		sessions: unknown[];
		message?: string;
	}> {
		return this.request("GET", "/api/v2/users/sessions");
	}

	async userRevokeSession(sessionId: string): Promise<void> {
		return this.request("DELETE", `/api/v2/users/sessions/${sessionId}`);
	}

	async userRevokeAllSessions(): Promise<void> {
		return this.request("DELETE", "/api/v2/users/sessions");
	}

	async userGetDevices(): Promise<{
		devices: import("../types").TrustedDevice[];
	}> {
		return this.request("GET", "/api/v2/users/devices");
	}

	async userInitiateDeviceVerification(deviceName?: string): Promise<{
		verificationId: string;
		expiresAt: string;
		emailSent: string;
		message: string;
	}> {
		return this.request("POST", "/api/v2/users/devices/verify/initiate", {
			deviceName,
		});
	}

	async userCompleteDeviceVerification(
		verificationId: string,
		code: string,
	): Promise<{
		deviceId: string;
		trustLevel: string;
		message: string;
	}> {
		return this.request("POST", "/api/v2/users/devices/verify/complete", {
			verificationId,
			code,
		});
	}

	async userTrustDevice(
		deviceId: string,
		deviceName?: string,
	): Promise<{ deviceId: string; message: string }> {
		return this.request("POST", `/api/v2/users/devices/${deviceId}/trust`, {
			deviceName,
		});
	}

	async userRemoveDevice(
		deviceId: string,
	): Promise<{ deviceId: string; message: string }> {
		return this.request("DELETE", `/api/v2/users/devices/${deviceId}`);
	}

	async userGetSecurity(): Promise<{
		securitySettings: import("../types").SecuritySettings;
	}> {
		return this.request("GET", "/api/v2/users/security");
	}

	async userUpdateSecurity(
		settings: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		return this.request("PUT", "/api/v2/users/security", settings);
	}

	async userChangePassword(
		currentPassword: string,
		newPassword: string,
		confirmPassword: string,
	): Promise<Record<string, unknown>> {
		return this.request("POST", "/api/v2/users/security/change-password", {
			currentPassword,
			newPassword,
			confirmPassword,
		});
	}

	async userGetActivity(params?: {
		page?: number;
		limit?: number;
		action?: string;
		from?: string;
		to?: string;
	}): Promise<{
		activities: import("../types").ActivityEntry[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	}> {
		const query = new URLSearchParams();
		if (params?.page) query.set("page", String(params.page));
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.action) query.set("action", params.action);
		if (params?.from) query.set("from", params.from);
		if (params?.to) query.set("to", params.to);
		const qs = query.toString();
		return this.request("GET", `/api/v2/users/activity${qs ? `?${qs}` : ""}`);
	}

	async userGetSecurityEvents(params?: {
		page?: number;
		limit?: number;
	}): Promise<{
		events: unknown[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	}> {
		const query = new URLSearchParams();
		if (params?.page) query.set("page", String(params.page));
		if (params?.limit) query.set("limit", String(params.limit));
		const qs = query.toString();
		return this.request(
			"GET",
			`/api/v2/users/security-events${qs ? `?${qs}` : ""}`,
		);
	}

	async userExportData(
		format?: "json" | "csv",
		includeWallet?: boolean,
	): Promise<Record<string, unknown>> {
		const query = new URLSearchParams();
		if (format) query.set("format", format);
		if (includeWallet !== undefined)
			query.set("includeWallet", String(includeWallet));
		const qs = query.toString();
		return this.request("GET", `/api/v2/users/export${qs ? `?${qs}` : ""}`);
	}

	async userGetNotifications(): Promise<{
		preferences: import("../types").NotificationPreferences;
	}> {
		return this.request("GET", "/api/v2/users/notifications");
	}

	async userUpdateNotifications(
		prefs: Partial<import("../types").NotificationPreferences>,
	): Promise<{
		preferences: import("../types").NotificationPreferences;
		message: string;
	}> {
		return this.request("PUT", "/api/v2/users/notifications", prefs);
	}

	// Audit V2 API Methods

	async auditGetLogs(params?: import("../types").AuditLogQuery): Promise<{
		logs: import("../types").AuditLog[];
		pagination: {
			limit: number;
			offset: number;
			total: number;
			hasMore: boolean;
		};
	}> {
		const query = new URLSearchParams();
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.offset) query.set("offset", String(params.offset));
		if (params?.action) query.set("action", params.action);
		if (params?.startDate) query.set("startDate", params.startDate);
		if (params?.endDate) query.set("endDate", params.endDate);
		const qs = query.toString();
		return this.request("GET", `/api/v2/audit-logs${qs ? `?${qs}` : ""}`);
	}

	async auditGetStats(): Promise<import("../types").AuditStats> {
		return this.request("GET", "/api/v2/audit-logs/stats");
	}

	async auditGetRecent(): Promise<{
		logs: import("../types").AuditLog[];
	}> {
		return this.request("GET", "/api/v2/audit-logs/recent");
	}

	// Admin V2 API Methods

	async adminCreateApiKey(options?: {
		name?: string;
		scopes?: string[];
		rateLimitPerMinute?: number;
		expiresAt?: string;
	}): Promise<import("../types").ApiKeyCreateResult> {
		return this.request("POST", "/api/v2/admin/api-keys", {
			name: options?.name,
			scopes: options?.scopes,
			rate_limit_per_minute: options?.rateLimitPerMinute,
			expires_at: options?.expiresAt,
		});
	}

	async adminListApiKeys(): Promise<{
		apiKeys: import("../types").ApiKeyRecord[];
	}> {
		return this.request("GET", "/api/v2/admin/api-keys");
	}

	async adminRevokeApiKey(id: string): Promise<{ message: string }> {
		return this.request("DELETE", `/api/v2/admin/api-keys/${id}`);
	}

	async adminRotateApiKey(
		id: string,
		name?: string,
	): Promise<
		import("../types").ApiKeyCreateResult & { previousKeyId: string }
	> {
		return this.request("POST", `/api/v2/admin/api-keys/${id}/rotate`, {
			name,
		});
	}

	async adminGetSettings(): Promise<import("../types").ProjectSettings> {
		return this.request("GET", "/api/v2/admin/settings");
	}

	async adminUpdateSettings(settings: {
		sessionLifetimeSeconds?: number;
		enableDappShare?: boolean;
	}): Promise<import("../types").ProjectSettings> {
		return this.request("PATCH", "/api/v2/admin/settings", {
			session_lifetime_seconds: settings.sessionLifetimeSeconds,
			enable_dapp_share: settings.enableDappShare,
		});
	}

	// Verifier V2 API Methods

	async createVerifier(config: {
		name: string;
		type: "oidc" | "firebase";
		issuer: string;
		jwksUrl?: string;
		audience?: string;
		clientId?: string;
		configJson?: Record<string, unknown>;
	}): Promise<import("../types").JwtVerifier> {
		return this.request("POST", "/api/v2/auth/verifiers", {
			name: config.name,
			type: config.type,
			issuer: config.issuer,
			jwks_url: config.jwksUrl,
			audience: config.audience,
			client_id: config.clientId,
			config_json: config.configJson,
		});
	}

	async listVerifiers(): Promise<{
		verifiers: import("../types").JwtVerifier[];
	}> {
		return this.request("GET", "/api/v2/auth/verifiers");
	}

	async updateVerifier(
		id: string,
		updates: {
			name?: string;
			issuer?: string;
			jwksUrl?: string | null;
			audience?: string | null;
			clientId?: string | null;
			configJson?: Record<string, unknown>;
			isActive?: boolean;
		},
	): Promise<import("../types").JwtVerifier> {
		return this.request("PUT", `/api/v2/auth/verifiers/${id}`, {
			name: updates.name,
			issuer: updates.issuer,
			jwks_url: updates.jwksUrl,
			audience: updates.audience,
			client_id: updates.clientId,
			config_json: updates.configJson,
			is_active: updates.isActive,
		});
	}

	async deleteVerifier(id: string): Promise<{ message: string }> {
		return this.request("DELETE", `/api/v2/auth/verifiers/${id}`);
	}

	// Aggregate Verifier V2 API Methods

	async createAggregateRule(config: {
		name: string;
		matchField?: string;
		subVerifiers: string[];
	}): Promise<import("../types").AggregateVerifierRule> {
		return this.request("POST", "/api/v2/auth/aggregate-verifiers", {
			name: config.name,
			match_field: config.matchField,
			sub_verifiers: config.subVerifiers,
		});
	}

	async listAggregateRules(): Promise<{
		rules: import("../types").AggregateVerifierRule[];
	}> {
		return this.request("GET", "/api/v2/auth/aggregate-verifiers");
	}

	async updateAggregateRule(
		id: string,
		updates: {
			name?: string;
			subVerifiers?: string[];
			isActive?: boolean;
		},
	): Promise<import("../types").AggregateVerifierRule> {
		return this.request("PUT", `/api/v2/auth/aggregate-verifiers/${id}`, {
			name: updates.name,
			sub_verifiers: updates.subVerifiers,
			is_active: updates.isActive,
		});
	}

	async deleteAggregateRule(id: string): Promise<{ message: string }> {
		return this.request("DELETE", `/api/v2/auth/aggregate-verifiers/${id}`);
	}

	/** @deprecated Use dkgInitiate() for v2 synchronous 3-step DKG flow */
	async initiateDKG(): Promise<{
		sessionId: string;
		partyId: number;
		participantCount: number;
		threshold: number;
	}> {
		return this.request("POST", "/api/mpc/dkg/initiate");
	}

	async submitDKGCommitment(
		sessionId: string,
		commitment: {
			partyId: number;
			commitments: string[];
			publicKey: string;
			proofOfKnowledge: string;
		},
	): Promise<void> {
		return this.request("POST", "/api/mpc/dkg/commitment", {
			sessionId,
			commitment,
		});
	}

	async getDKGCommitments(sessionId: string): Promise<{
		commitments: Array<{
			partyId: number;
			commitments: string[];
			publicKey: string;
			proofOfKnowledge?: string;
		}>;
		ready: boolean;
	}> {
		return this.request("GET", `/api/mpc/dkg/${sessionId}/commitments`);
	}

	async submitDKGShare(
		sessionId: string,
		encryptedShare: string,
		toPartyId: number,
	): Promise<void> {
		return this.request("POST", "/api/mpc/dkg/share", {
			sessionId,
			encryptedShare,
			toPartyId,
		});
	}

	async getDKGShares(
		sessionId: string,
		partyId: number,
	): Promise<{
		shares: Array<{
			fromPartyId: number;
			encryptedShare: string;
		}>;
		ready: boolean;
	}> {
		return this.request("GET", `/api/mpc/dkg/${sessionId}/shares/${partyId}`);
	}

	async completeDKG(
		sessionId: string,
		partyId: number,
		publicKey: string,
		walletAddress: string,
	): Promise<{
		success: boolean;
		wallet: WalletInfo;
	}> {
		return this.request("POST", "/api/mpc/dkg/complete", {
			sessionId,
			partyId,
			publicKey,
			walletAddress,
		});
	}

	async initiateSigningSession(
		messageHash: string,
		messageType: "transaction" | "message" | "typed_data",
	): Promise<{
		sessionId: string;
		participatingParties: number[];
	}> {
		return this.request("POST", "/api/mpc/signing/initiate", {
			messageHash,
			messageType,
		});
	}

	async submitNonceCommitment(
		sessionId: string,
		partyId: number,
		commitment: string,
	): Promise<void> {
		return this.request("POST", "/api/mpc/signing/nonce-commitment", {
			sessionId,
			partyId,
			commitment,
		});
	}

	async getNonceCommitments(sessionId: string): Promise<{
		commitments: Map<number, string>;
		ready: boolean;
	}> {
		return this.request(
			"GET",
			`/api/mpc/signing/${sessionId}/nonce-commitments`,
		);
	}

	async submitPartialSignature(
		sessionId: string,
		partyId: number,
		partialSignature: {
			r: string;
			s: string;
			publicShare: string;
			nonceCommitment: string;
		},
	): Promise<void> {
		return this.request("POST", "/api/mpc/signing/partial", {
			sessionId,
			partyId,
			partialSignature,
		});
	}

	async getPartialSignatures(sessionId: string): Promise<{
		partials: Array<{
			partyId: number;
			s: string;
			publicShare: string;
			nonceCommitment: string;
		}>;
		ready: boolean;
	}> {
		return this.request("GET", `/api/mpc/signing/${sessionId}/partials`);
	}

	async getSigningResult(sessionId: string): Promise<{
		complete: boolean;
		signature?: {
			r: string;
			s: string;
			v: number;
			fullSignature: string;
		};
	}> {
		return this.request("GET", `/api/mpc/signing/${sessionId}/result`);
	}

	async getWalletInfo(): Promise<WalletInfo> {
		return this.request("GET", "/api/v2/wallet/info");
	}

	async getPartyPublicShares(): Promise<{
		shares: Array<{ partyId: number; publicShare: string }>;
	}> {
		return this.request("GET", "/api/wallet/party-shares");
	}

	// DKLS V2 API Methods

	async dklsKeygenInit(): Promise<{
		sessionId: string;
		backendCommitment: {
			partyId: number;
			commitment: string;
		};
	}> {
		return this.request("POST", "/api/v2/dkls/keygen/init");
	}

	async dklsKeygenCommitment(
		sessionId: string,
		clientCommitment: {
			partyId: number;
			commitment: string;
		},
	): Promise<{
		sessionId: string;
		backendPublicShare: {
			partyId: number;
			publicShare: string;
			proof: {
				commitment: string;
				challenge: string;
				response: string;
			};
		};
	}> {
		return this.request("POST", "/api/v2/dkls/keygen/commitment", {
			sessionId,
			clientCommitment,
		});
	}

	async dklsKeygenComplete(
		sessionId: string,
		clientPublicShare: {
			partyId: number;
			publicShare: string;
			proof: {
				commitment: string;
				challenge: string;
				response: string;
			};
		},
	): Promise<{
		sessionId: string;
		walletAddress: string;
		jointPublicKey: string;
		keyId: string;
	}> {
		return this.request("POST", "/api/v2/dkls/keygen/complete", {
			sessionId,
			clientPublicShare,
		});
	}

	async dklsSigningInit(params: {
		messageHash: string;
		messageType?: "message" | "transaction" | "typed_data";
		dkgSessionId: string;
	}): Promise<{
		sessionId: string;
		status: string;
		backendNonceCommitment: {
			partyId: number;
			commitment: string;
		};
		walletAddress: string;
	}> {
		return this.request("POST", "/api/v2/dkls/signing/init", params);
	}

	async dklsSigningNonce(
		sessionId: string,
		clientNonceCommitment: {
			partyId: number;
			R: string;
			commitment: string;
		},
	): Promise<{
		sessionId: string;
		r: string;
		rValue: string;
		backendNonceReveal: {
			partyId: number;
			R: string;
		};
		backendPartialSignature: {
			partyId: number;
			sigma: string;
			R: string;
		};
	}> {
		return this.request("POST", "/api/v2/dkls/signing/nonce", {
			sessionId,
			clientNonceCommitment,
		});
	}

	/**
	 * @deprecated This method defeats threshold security by transmitting the full key share.
	 * Use the MtA-based signing flow instead: dklsMtaRound1 -> dklsMtaRound2 -> dklsSigningPartial.
	 * This endpoint is only available in test mode (DKLS_LOCAL_TESTING_MODE=true).
	 */
	async dklsSigningComplete(
		sessionId: string,
		clientKeyShare: {
			partyId: number;
			secretShare: string;
			publicShare: string;
			jointPublicKey: string;
		},
	): Promise<{
		sessionId: string;
		signature: string;
		r: string;
		s: string;
		v: number;
		messageHash: string;
		walletAddress: string | null;
		securityLevel: string;
	}> {
		console.warn(
			"[DEPRECATED] dklsSigningComplete defeats threshold security. " +
				"Use MtA-based signing (dklsMtaRound1/dklsMtaRound2/dklsSigningPartial) instead.",
		);
		return this.request("POST", "/api/v2/dkls/signing/complete", {
			sessionId,
			clientKeyShare,
		});
	}

	async dklsSigningStatus(sessionId: string): Promise<{
		sessionId: string;
		status: string;
		messageHash: string;
		messageType: string;
		result?: {
			signature: string;
			r: string;
			s: string;
			v: number;
		};
		error?: string;
		createdAt: string;
		completedAt?: string;
	}> {
		return this.request("GET", `/api/v2/dkls/signing/${sessionId}`);
	}

	async dklsSigningCancel(sessionId: string): Promise<{
		sessionId: string;
		message: string;
	}> {
		return this.request("DELETE", `/api/v2/dkls/signing/${sessionId}`);
	}

	async dklsMtaRound1(
		sessionId: string,
		mta1Setup: {
			sessionId: string;
			setup: {
				setups: Array<{ A: string }>;
			};
		},
		mta2Setup: {
			sessionId: string;
			setup: {
				setups: Array<{ A: string }>;
			};
		},
	): Promise<{
		mta1Response: {
			sessionId: string;
			response: {
				responses: Array<{ B: string }>;
			};
		};
		mta2Response: {
			sessionId: string;
			response: {
				responses: Array<{ B: string }>;
			};
		};
	}> {
		return this.request("POST", "/api/v2/dkls/signing/mta/round1", {
			sessionId,
			mta1Setup,
			mta2Setup,
		});
	}

	async dklsMtaRound2(
		sessionId: string,
		mta1Encrypted: {
			sessionId: string;
			encrypted: {
				encrypted: Array<{ e0: string; e1: string }>;
			};
		},
		mta2Encrypted: {
			sessionId: string;
			encrypted: {
				encrypted: Array<{ e0: string; e1: string }>;
			};
		},
	): Promise<{
		success: true;
	}> {
		return this.request("POST", "/api/v2/dkls/signing/mta/round2", {
			sessionId,
			mta1Encrypted,
			mta2Encrypted,
		});
	}

	async dklsSigningPartial(
		sessionId: string,
		clientPartialSignature: {
			partyId: number;
			s: string;
		},
	): Promise<{
		signature: string;
		r: string;
		s: string;
		v: number;
	}> {
		return this.request("POST", "/api/v2/dkls/signing/partial", {
			sessionId,
			clientPartialSignature,
		});
	}

	async initiateDeviceVerification(
		fingerprint: DeviceFingerprint,
		deviceName?: string,
	): Promise<{
		verificationId: string;
		expiresAt: string;
	}> {
		return this.request("POST", "/api/user/devices/verify/initiate", {
			fingerprint,
			deviceName,
		});
	}

	async completeDeviceVerification(
		verificationId: string,
		code: string,
		fingerprint: DeviceFingerprint,
	): Promise<{
		deviceId: string;
		trustLevel: string;
	}> {
		return this.request("POST", "/api/user/devices/verify/complete", {
			verificationId,
			code,
			fingerprint,
		});
	}
}
