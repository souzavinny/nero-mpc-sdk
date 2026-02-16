import { useCallback, useState } from "react";
import type { SessionReconnectResult, SessionStatus } from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroSessionReturn {
	getStatus: () => Promise<SessionStatus>;
	reconnect: (dappShare?: string) => Promise<SessionReconnectResult>;
	revoke: () => Promise<void>;
	status: SessionStatus | null;
	isLoading: boolean;
	error: Error | null;
}

export function useNeroSession(): UseNeroSessionReturn {
	const { sdk } = useNeroMpcAuthContext();
	const [status, setStatus] = useState<SessionStatus | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const getStatus = useCallback(async () => {
		if (!sdk) throw new Error("SDK not initialized");
		setIsLoading(true);
		setError(null);
		try {
			const result = await sdk.getSessionStatus();
			setStatus(result);
			return result;
		} catch (err) {
			const e = err instanceof Error ? err : new Error(String(err));
			setError(e);
			throw e;
		} finally {
			setIsLoading(false);
		}
	}, [sdk]);

	const reconnect = useCallback(
		async (dappShare?: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsLoading(true);
			setError(null);
			try {
				return await sdk.reconnectSession(dappShare);
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

	const revoke = useCallback(async () => {
		if (!sdk) throw new Error("SDK not initialized");
		setIsLoading(true);
		setError(null);
		try {
			await sdk.logout();
			setStatus(null);
		} catch (err) {
			const e = err instanceof Error ? err : new Error(String(err));
			setError(e);
			throw e;
		} finally {
			setIsLoading(false);
		}
	}, [sdk]);

	return { getStatus, reconnect, revoke, status, isLoading, error };
}
