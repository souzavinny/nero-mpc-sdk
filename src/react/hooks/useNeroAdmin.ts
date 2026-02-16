import { useCallback, useState } from "react";
import type {
	AggregateVerifierRule,
	ApiKeyCreateResult,
	ApiKeyRecord,
	JwtVerifier,
	ProjectSettings,
} from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroAdminReturn {
	createApiKey: (options?: {
		name?: string;
		scopes?: string[];
		rateLimitPerMinute?: number;
		expiresAt?: string;
	}) => Promise<ApiKeyCreateResult>;
	listApiKeys: () => Promise<{ apiKeys: ApiKeyRecord[] }>;
	revokeApiKey: (id: string) => Promise<{ message: string }>;
	rotateApiKey: (
		id: string,
		name?: string,
	) => Promise<ApiKeyCreateResult & { previousKeyId: string }>;
	getSettings: () => Promise<ProjectSettings>;
	updateSettings: (settings: {
		sessionLifetimeSeconds?: number;
		enableDappShare?: boolean;
	}) => Promise<ProjectSettings>;
	createVerifier: (config: {
		name: string;
		type: "oidc" | "firebase";
		issuer: string;
		jwksUrl?: string;
		audience?: string;
		clientId?: string;
		configJson?: Record<string, unknown>;
	}) => Promise<JwtVerifier>;
	listVerifiers: () => Promise<{ verifiers: JwtVerifier[] }>;
	updateVerifier: (
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
	) => Promise<JwtVerifier>;
	deleteVerifier: (id: string) => Promise<{ message: string }>;
	createAggregateRule: (config: {
		name: string;
		matchField?: string;
		subVerifiers: string[];
	}) => Promise<AggregateVerifierRule>;
	listAggregateRules: () => Promise<{ rules: AggregateVerifierRule[] }>;
	updateAggregateRule: (
		id: string,
		updates: {
			name?: string;
			subVerifiers?: string[];
			isActive?: boolean;
		},
	) => Promise<AggregateVerifierRule>;
	deleteAggregateRule: (id: string) => Promise<{ message: string }>;
	settings: ProjectSettings | null;
	isLoading: boolean;
	error: Error | null;
}

export function useNeroAdmin(): UseNeroAdminReturn {
	const { sdk } = useNeroMpcAuthContext();
	const [settings, setSettings] = useState<ProjectSettings | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const wrap = useCallback(
		async <T>(fn: () => Promise<T>): Promise<T> => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsLoading(true);
			setError(null);
			try {
				return await fn();
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			} finally {
				setIsLoading(false);
			}
		},
		[sdk],
	);

	const api = sdk?.apiClientForHooks;

	const createApiKey = useCallback(
		(options?: {
			name?: string;
			scopes?: string[];
			rateLimitPerMinute?: number;
			expiresAt?: string;
		}) => wrap(() => api!.adminCreateApiKey(options)),
		[api, wrap],
	);

	const listApiKeys = useCallback(
		() => wrap(() => api!.adminListApiKeys()),
		[api, wrap],
	);

	const revokeApiKey = useCallback(
		(id: string) => wrap(() => api!.adminRevokeApiKey(id)),
		[api, wrap],
	);

	const rotateApiKey = useCallback(
		(id: string, name?: string) => wrap(() => api!.adminRotateApiKey(id, name)),
		[api, wrap],
	);

	const getSettings = useCallback(
		() =>
			wrap(async () => {
				const result = await api!.adminGetSettings();
				setSettings(result);
				return result;
			}),
		[api, wrap],
	);

	const updateSettings = useCallback(
		(s: { sessionLifetimeSeconds?: number; enableDappShare?: boolean }) =>
			wrap(async () => {
				const result = await api!.adminUpdateSettings(s);
				setSettings(result);
				return result;
			}),
		[api, wrap],
	);

	const createVerifier = useCallback(
		(config: {
			name: string;
			type: "oidc" | "firebase";
			issuer: string;
			jwksUrl?: string;
			audience?: string;
			clientId?: string;
			configJson?: Record<string, unknown>;
		}) => wrap(() => api!.createVerifier(config)),
		[api, wrap],
	);

	const listVerifiers = useCallback(
		() => wrap(() => api!.listVerifiers()),
		[api, wrap],
	);

	const updateVerifier = useCallback(
		(
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
		) => wrap(() => api!.updateVerifier(id, updates)),
		[api, wrap],
	);

	const deleteVerifier = useCallback(
		(id: string) => wrap(() => api!.deleteVerifier(id)),
		[api, wrap],
	);

	const createAggregateRule = useCallback(
		(config: {
			name: string;
			matchField?: string;
			subVerifiers: string[];
		}) => wrap(() => api!.createAggregateRule(config)),
		[api, wrap],
	);

	const listAggregateRules = useCallback(
		() => wrap(() => api!.listAggregateRules()),
		[api, wrap],
	);

	const updateAggregateRule = useCallback(
		(
			id: string,
			updates: {
				name?: string;
				subVerifiers?: string[];
				isActive?: boolean;
			},
		) => wrap(() => api!.updateAggregateRule(id, updates)),
		[api, wrap],
	);

	const deleteAggregateRule = useCallback(
		(id: string) => wrap(() => api!.deleteAggregateRule(id)),
		[api, wrap],
	);

	return {
		createApiKey,
		listApiKeys,
		revokeApiKey,
		rotateApiKey,
		getSettings,
		updateSettings,
		createVerifier,
		listVerifiers,
		updateVerifier,
		deleteVerifier,
		createAggregateRule,
		listAggregateRules,
		updateAggregateRule,
		deleteAggregateRule,
		settings,
		isLoading,
		error,
	};
}
