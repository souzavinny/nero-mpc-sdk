import { useCallback, useState } from "react";
import type {
	RecoveryAttempt,
	RecoveryMethod,
	RecoveryMethodType,
} from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroRecoveryReturn {
	setup: (
		methodType: RecoveryMethodType,
		config: Record<string, unknown>,
		encryptedData?: string,
	) => Promise<{
		method: {
			id: string;
			methodType: string;
			status: string;
			createdAt: string;
		};
		verificationRequired: boolean;
		expiresAt?: string;
	}>;
	listMethods: (
		includeInactive?: boolean,
	) => Promise<{ methods: RecoveryMethod[]; count: number }>;
	deleteMethod: (methodId: string) => Promise<{ deleted: true }>;
	initiate: (methodId: string) => Promise<RecoveryAttempt>;
	verify: (
		attemptId: string,
		verificationCode: string,
	) => Promise<{
		attemptId: string;
		status: string;
		verified: boolean;
		canComplete: boolean;
		timelockExpiresAt: string | null;
	}>;
	complete: (attemptId: string) => Promise<{
		attemptId: string;
		status: string;
		recoveredData: unknown;
	}>;
	cancel: (attemptId: string) => Promise<{ cancelled: true }>;
	methods: RecoveryMethod[];
	isLoading: boolean;
	error: Error | null;
}

export function useNeroRecovery(): UseNeroRecoveryReturn {
	const { sdk } = useNeroMpcAuthContext();
	const [methods, setMethods] = useState<RecoveryMethod[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const setup = useCallback(
		async (
			methodType: RecoveryMethodType,
			config: Record<string, unknown>,
			encryptedData?: string,
		) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsLoading(true);
			setError(null);
			try {
				return await sdk.setupRecovery(methodType, config, encryptedData);
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

	const listMethods = useCallback(
		async (includeInactive?: boolean) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsLoading(true);
			setError(null);
			try {
				const result = await sdk.listRecoveryMethods(includeInactive);
				setMethods(result.methods);
				return result;
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

	const deleteMethod = useCallback(
		async (methodId: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setError(null);
			try {
				return await sdk.deleteRecoveryMethod(methodId);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			}
		},
		[sdk],
	);

	const initiate = useCallback(
		async (methodId: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsLoading(true);
			setError(null);
			try {
				return await sdk.initiateRecovery(methodId);
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

	const verify = useCallback(
		async (attemptId: string, verificationCode: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsLoading(true);
			setError(null);
			try {
				return await sdk.verifyRecovery(attemptId, verificationCode);
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

	const complete = useCallback(
		async (attemptId: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsLoading(true);
			setError(null);
			try {
				return await sdk.completeRecovery(attemptId);
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

	const cancel = useCallback(
		async (attemptId: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setError(null);
			try {
				return await sdk.cancelRecovery(attemptId);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			}
		},
		[sdk],
	);

	return {
		setup,
		listMethods,
		deleteMethod,
		initiate,
		verify,
		complete,
		cancel,
		methods,
		isLoading,
		error,
	};
}
