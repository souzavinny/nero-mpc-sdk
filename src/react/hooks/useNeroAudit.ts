import { useCallback, useState } from "react";
import type { AuditLog, AuditLogQuery, AuditStats } from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroAuditReturn {
	getLogs: (params?: AuditLogQuery) => Promise<{
		logs: AuditLog[];
		pagination: {
			limit: number;
			offset: number;
			total: number;
			hasMore: boolean;
		};
	}>;
	getStats: () => Promise<AuditStats>;
	getRecent: () => Promise<{ logs: AuditLog[] }>;
	logs: AuditLog[];
	stats: AuditStats | null;
	isLoading: boolean;
	error: Error | null;
}

export function useNeroAudit(): UseNeroAuditReturn {
	const { sdk } = useNeroMpcAuthContext();
	const [logs, setLogs] = useState<AuditLog[]>([]);
	const [stats, setStats] = useState<AuditStats | null>(null);
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

	const getLogs = useCallback(
		(params?: AuditLogQuery) =>
			wrap(async () => {
				const result = await sdk!.apiClientForHooks.auditGetLogs(params);
				setLogs(result.logs);
				return result;
			}),
		[sdk, wrap],
	);

	const getStats = useCallback(
		() =>
			wrap(async () => {
				const result = await sdk!.apiClientForHooks.auditGetStats();
				setStats(result);
				return result;
			}),
		[sdk, wrap],
	);

	const getRecent = useCallback(
		() =>
			wrap(async () => {
				const result = await sdk!.apiClientForHooks.auditGetRecent();
				setLogs(result.logs);
				return result;
			}),
		[sdk, wrap],
	);

	return { getLogs, getStats, getRecent, logs, stats, isLoading, error };
}
