import type { AuthTokens, SDKConfig } from "../types";
import { SDKError } from "../types";
import {
	AdminAPI,
	AuditAPI,
	AuthAPI,
	BackupAPI,
	DkgAPI,
	DklsAPI,
	FactorAPI,
	MfaAPI,
	RecoveryAPI,
	SessionAPI,
	UserAPI,
	WalletAPI,
} from "./api";
import type { RequestFn } from "./api/types";
import { createRetryMiddleware } from "./middleware/retry";
import type { RetryConfig } from "./middleware/retry";
import {
	type RequestContext,
	type RequestMiddleware,
	createPipeline,
} from "./request-pipeline";

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
	private executePipeline: (context: RequestContext) => Promise<Response>;

	readonly auth: AuthAPI;
	readonly session: SessionAPI;
	readonly dkg: DkgAPI;
	readonly dkls: DklsAPI;
	readonly wallet: WalletAPI;
	readonly backup: BackupAPI;
	readonly recovery: RecoveryAPI;
	readonly factor: FactorAPI;
	readonly mfa: MfaAPI;
	readonly user: UserAPI;
	readonly audit: AuditAPI;
	readonly admin: AdminAPI;

	constructor(
		config: SDKConfig,
		options?: {
			middleware?: RequestMiddleware[];
			retryConfig?: RetryConfig;
		},
	) {
		this.baseUrl = config.backendUrl.replace(/\/$/, "");
		this.apiKey = config.apiKey;
		this.deviceId = config.deviceId;

		const middlewares: RequestMiddleware[] = [
			createRetryMiddleware(options?.retryConfig),
			...(options?.middleware ?? []),
		];

		this.executePipeline = createPipeline(middlewares, (ctx) =>
			fetch(ctx.url, {
				method: ctx.method,
				headers: ctx.headers,
				body: ctx.body ? JSON.stringify(ctx.body) : undefined,
				credentials: ctx.credentials,
			}),
		);

		const requestFn: RequestFn = (method, path, body, requiresAuth) =>
			this.request(method, path, body, requiresAuth);

		this.auth = new AuthAPI(requestFn);
		this.session = new SessionAPI(requestFn);
		this.dkg = new DkgAPI(requestFn);
		this.dkls = new DklsAPI(requestFn);
		this.wallet = new WalletAPI(requestFn);
		this.backup = new BackupAPI(requestFn);
		this.recovery = new RecoveryAPI(requestFn);
		this.factor = new FactorAPI(requestFn);
		this.mfa = new MfaAPI(requestFn);
		this.user = new UserAPI(requestFn);
		this.audit = new AuditAPI(requestFn);
		this.admin = new AdminAPI(requestFn);
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

		const response = await this.executePipeline({
			method,
			path,
			url: `${this.baseUrl}${path}`,
			body,
			headers,
			credentials: "include",
		});

		const data: APIResponse<T> = await response.json();

		if (!data.success) {
			throw new SDKError(
				data.error?.message ?? "Request failed",
				data.error?.code ?? "REQUEST_FAILED",
				response.status,
				data.error as Record<string, unknown> | undefined,
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

			const response = await this.executePipeline({
				method: "POST",
				path: "/api/v2/session/refresh",
				url: `${this.baseUrl}/api/v2/session/refresh`,
				headers: refreshHeaders,
				body: { refreshToken: this.tokens.refreshToken },
				credentials: "include",
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
}
