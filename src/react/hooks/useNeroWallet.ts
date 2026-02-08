import { useCallback, useState } from "react";
import type { Signature, WalletInfo } from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroWalletReturn {
	wallet: WalletInfo | null;
	hasWallet: boolean;
	generateWallet: () => Promise<WalletInfo>;
	signMessage: (message: string) => Promise<Signature>;
	signTypedData: (
		domain: Record<string, unknown>,
		types: Record<string, Array<{ name: string; type: string }>>,
		primaryType: string,
		value: Record<string, unknown>,
	) => Promise<Signature>;
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
		async (message: string): Promise<Signature> => {
			if (!sdk?.wallet) {
				throw new Error("Wallet not available");
			}

			setIsSigning(true);
			setError(null);

			try {
				const result = await sdk.wallet.signMessage(message);
				return result;
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				setError(error);
				throw error;
			} finally {
				setIsSigning(false);
			}
		},
		[sdk],
	);

	const signTypedData = useCallback(
		async (
			domain: Record<string, unknown>,
			types: Record<string, Array<{ name: string; type: string }>>,
			primaryType: string,
			value: Record<string, unknown>,
		): Promise<Signature> => {
			if (!sdk?.wallet) {
				throw new Error("Wallet not available");
			}

			setIsSigning(true);
			setError(null);

			try {
				const result = await sdk.wallet.signTypedData(
					domain,
					types,
					primaryType,
					value,
				);
				return result;
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				setError(error);
				throw error;
			} finally {
				setIsSigning(false);
			}
		},
		[sdk],
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
