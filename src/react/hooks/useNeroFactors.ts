import { useCallback, useState } from "react";
import type { Factor, FactorType } from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroFactorsReturn {
	addFactor: (
		factorType: FactorType,
		encryptedShare: string,
		options?: { password?: string; deviceFingerprint?: string },
	) => Promise<{
		factor: {
			id: string;
			factorType: string;
			status: string;
			createdAt: string;
		};
		factorKey?: string;
	}>;
	listFactors: () => Promise<{ factors: Factor[]; count: number }>;
	deleteFactor: (id: string) => Promise<{ deleted: true }>;
	recoverShare: (
		factorId: string,
		verificationCode: string,
	) => Promise<{ recoveredShare: unknown }>;
	factors: Factor[];
	isLoading: boolean;
	error: Error | null;
}

export function useNeroFactors(): UseNeroFactorsReturn {
	const { sdk } = useNeroMpcAuthContext();
	const [factors, setFactors] = useState<Factor[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const addFactor = useCallback(
		async (
			factorType: FactorType,
			encryptedShare: string,
			options?: { password?: string; deviceFingerprint?: string },
		) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsLoading(true);
			setError(null);
			try {
				return await sdk.addFactor(factorType, encryptedShare, options);
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

	const listFactors = useCallback(async () => {
		if (!sdk) throw new Error("SDK not initialized");
		setIsLoading(true);
		setError(null);
		try {
			const result = await sdk.listFactors();
			setFactors(result.factors);
			return result;
		} catch (err) {
			const e = err instanceof Error ? err : new Error(String(err));
			setError(e);
			throw e;
		} finally {
			setIsLoading(false);
		}
	}, [sdk]);

	const deleteFactor = useCallback(
		async (id: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setError(null);
			try {
				return await sdk.deleteFactor(id);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			}
		},
		[sdk],
	);

	const recoverShare = useCallback(
		async (factorId: string, verificationCode: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsLoading(true);
			setError(null);
			try {
				return await sdk.recoverShareWithFactor(factorId, verificationCode);
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

	return {
		addFactor,
		listFactors,
		deleteFactor,
		recoverShare,
		factors,
		isLoading,
		error,
	};
}
