import { useCallback, useState } from "react";
import type { WalletInfo } from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroWalletReturn {
	wallet: WalletInfo | null;
	hasWallet: boolean;
	generateWallet: () => Promise<WalletInfo>;
	signMessage: (message: string) => Promise<string>;
	signTypedData: (
		domain: Record<string, unknown>,
		types: Record<string, Array<{ name: string; type: string }>>,
		primaryType: string,
		value: Record<string, unknown>,
	) => Promise<string>;
	isGenerating: boolean;
	isSigning: boolean;
	error: Error | null;
}

export function useNeroWallet(): UseNeroWalletReturn {
	const { sdk, state } = useNeroMpcAuthContext();
	const [isGenerating, setIsGenerating] = useState(false);
	const [isSigning, setIsSigning] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const generateWallet = useCallback(async (): Promise<WalletInfo> => {
		if (!sdk) {
			throw new Error("SDK not initialized");
		}

		setIsGenerating(true);
		setError(null);

		try {
			const walletInfo = await sdk.generateWallet();
			return walletInfo;
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			setError(error);
			throw error;
		} finally {
			setIsGenerating(false);
		}
	}, [sdk]);

	const signMessage = useCallback(
		async (message: string): Promise<string> => {
			if (!sdk || !state.hasWallet) {
				throw new Error("Wallet not available");
			}

			setIsSigning(true);
			setError(null);

			try {
				return await sdk.signMessage(message);
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				setError(error);
				throw error;
			} finally {
				setIsSigning(false);
			}
		},
		[sdk, state.hasWallet],
	);

	const signTypedData = useCallback(
		async (
			domain: Record<string, unknown>,
			types: Record<string, Array<{ name: string; type: string }>>,
			primaryType: string,
			value: Record<string, unknown>,
		): Promise<string> => {
			if (!sdk || !state.hasWallet) {
				throw new Error("Wallet not available");
			}

			setIsSigning(true);
			setError(null);

			try {
				return await sdk.signTypedData(domain, types, primaryType, value);
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				setError(error);
				throw error;
			} finally {
				setIsSigning(false);
			}
		},
		[sdk, state.hasWallet],
	);

	return {
		wallet: state.walletInfo,
		hasWallet: state.hasWallet,
		generateWallet,
		signMessage,
		signTypedData,
		isGenerating,
		isSigning,
		error,
	};
}
