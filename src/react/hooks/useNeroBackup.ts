import { useCallback, useState } from "react";
import type {
	BackupData,
	BackupExportResponse,
	BackupImportResponse,
	BackupInfo,
} from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroBackupReturn {
	exportBackup: (password: string) => Promise<BackupExportResponse>;
	importBackup: (
		backup: BackupData,
		password: string,
	) => Promise<BackupImportResponse>;
	getInfo: () => Promise<BackupInfo>;
	info: BackupInfo | null;
	isLoading: boolean;
	error: Error | null;
}

export function useNeroBackup(): UseNeroBackupReturn {
	const { sdk } = useNeroMpcAuthContext();
	const [info, setInfo] = useState<BackupInfo | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const exportBackup = useCallback(
		async (password: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsLoading(true);
			setError(null);
			try {
				return await sdk.exportBackupV2(password);
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

	const importBackup = useCallback(
		async (backup: BackupData, password: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsLoading(true);
			setError(null);
			try {
				return await sdk.importBackupV2(backup, password);
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

	const getInfo = useCallback(async () => {
		if (!sdk) throw new Error("SDK not initialized");
		setIsLoading(true);
		setError(null);
		try {
			const result = await sdk.getBackupInfo();
			setInfo(result);
			return result;
		} catch (err) {
			const e = err instanceof Error ? err : new Error(String(err));
			setError(e);
			throw e;
		} finally {
			setIsLoading(false);
		}
	}, [sdk]);

	return { exportBackup, importBackup, getInfo, info, isLoading, error };
}
