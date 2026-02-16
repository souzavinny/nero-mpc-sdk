import type {
	AuthTokens,
	DeviceFingerprint,
	SDKConfig,
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
		provider: "google" | "github" | "apple",
		redirectUri: string,
	): Promise<{ url: string; state: string }> {
		const data = await this.request<{
			authUrl: string;
			state: string;
		}>(
			"GET",
			`/api/v1/auth/oauth-url/${provider}?redirectUri=${encodeURIComponent(redirectUri)}`,
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
		const result = await this.request<{
			user: User;
			tokens: {
				accessToken: string;
				refreshToken: string;
				expiresIn: number;
			};
			isFirstLogin: boolean;
			wallet?: {
				walletAddress?: string;
				requiresKeyGeneration: boolean;
				keyGenSessionId?: string;
				status?: string;
				expiresAt?: string;
				error?: string;
			};
		}>(
			"POST",
			"/api/v1/auth/social-login",
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
		const result = await this.request<{ user: User }>("GET", "/api/v1/auth/me");
		return result.user;
	}

	async logout(): Promise<void> {
		await this.request("POST", "/api/v1/auth/logout");
		this.tokens = null;
	}

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
		return this.request("GET", "/api/v1/wallet/info");
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
