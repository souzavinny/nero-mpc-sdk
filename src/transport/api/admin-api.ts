import type {
	AggregateVerifierRule,
	ApiKeyCreateResult,
	ApiKeyRecord,
	JwtVerifier,
	ProjectSettings,
} from "../../types";
import type { RequestFn } from "./types";

export class AdminAPI {
	constructor(private request: RequestFn) {}

	async createApiKey(options?: {
		name?: string;
		scopes?: string[];
		rateLimitPerMinute?: number;
		expiresAt?: string;
	}): Promise<ApiKeyCreateResult> {
		return this.request("POST", "/api/v2/admin/api-keys", {
			name: options?.name,
			scopes: options?.scopes,
			rate_limit_per_minute: options?.rateLimitPerMinute,
			expires_at: options?.expiresAt,
		});
	}

	async listApiKeys(): Promise<{
		apiKeys: ApiKeyRecord[];
	}> {
		return this.request("GET", "/api/v2/admin/api-keys");
	}

	async revokeApiKey(id: string): Promise<{ message: string }> {
		return this.request("DELETE", `/api/v2/admin/api-keys/${id}`);
	}

	async rotateApiKey(
		id: string,
		name?: string,
	): Promise<ApiKeyCreateResult & { previousKeyId: string }> {
		return this.request("POST", `/api/v2/admin/api-keys/${id}/rotate`, {
			name,
		});
	}

	async getSettings(): Promise<ProjectSettings> {
		return this.request("GET", "/api/v2/admin/settings");
	}

	async updateSettings(settings: {
		sessionLifetimeSeconds?: number;
		enableDappShare?: boolean;
	}): Promise<ProjectSettings> {
		return this.request("PATCH", "/api/v2/admin/settings", {
			session_lifetime_seconds: settings.sessionLifetimeSeconds,
			enable_dapp_share: settings.enableDappShare,
		});
	}

	async createVerifier(config: {
		name: string;
		type: "oidc" | "firebase";
		issuer: string;
		jwksUrl?: string;
		audience?: string;
		clientId?: string;
		configJson?: Record<string, unknown>;
	}): Promise<JwtVerifier> {
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
		verifiers: JwtVerifier[];
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
	): Promise<JwtVerifier> {
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

	async createAggregateRule(config: {
		name: string;
		matchField?: string;
		subVerifiers: string[];
	}): Promise<AggregateVerifierRule> {
		return this.request("POST", "/api/v2/auth/aggregate-verifiers", {
			name: config.name,
			match_field: config.matchField,
			sub_verifiers: config.subVerifiers,
		});
	}

	async listAggregateRules(): Promise<{
		rules: AggregateVerifierRule[];
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
	): Promise<AggregateVerifierRule> {
		return this.request("PUT", `/api/v2/auth/aggregate-verifiers/${id}`, {
			name: updates.name,
			sub_verifiers: updates.subVerifiers,
			is_active: updates.isActive,
		});
	}

	async deleteAggregateRule(id: string): Promise<{ message: string }> {
		return this.request("DELETE", `/api/v2/auth/aggregate-verifiers/${id}`);
	}
}
