import type React from "react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { NeroMpcSDK, type NeroSDKState } from "../nero-sdk";
import type { SDKConfig } from "../types";
import { NeroMpcAuthContext, type NeroMpcAuthContextValue } from "./context";
import { type ThemeMode, ThemeProvider } from "./theme";
import type { UIConfig } from "./theme/types";

export interface NeroMpcAuthProviderProps {
	children: ReactNode;
	config: SDKConfig;
	autoConnect?: boolean;
	uiConfig?: UIConfig;
	themeMode?: ThemeMode;
}

const DEFAULT_STATE: NeroSDKState = {
	isAuthenticated: false,
	isInitialized: false,
	hasWallet: false,
	user: null,
	walletInfo: null,
	chainId: 689,
	isConnected: false,
};

export function NeroMpcAuthProvider({
	children,
	config,
	autoConnect = true,
	uiConfig,
	themeMode = "auto",
}: NeroMpcAuthProviderProps): React.ReactElement {
	const [sdk, setSdk] = useState<NeroMpcSDK | null>(null);
	const [state, setState] = useState<NeroSDKState>(DEFAULT_STATE);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		const initializeSDK = async () => {
			try {
				setIsLoading(true);
				setError(null);

				const instance = new NeroMpcSDK(config);
				setSdk(instance);

				if (autoConnect) {
					await instance.initialize();
				}

				setState(instance.state);
			} catch (err) {
				setError(err instanceof Error ? err : new Error(String(err)));
			} finally {
				setIsLoading(false);
			}
		};

		initializeSDK();
	}, [config.backendUrl, config.chainId, autoConnect]);

	useEffect(() => {
		if (!sdk || typeof sdk.on !== "function") return;

		const syncState = () => setState(sdk.state);

		sdk.on("connected", syncState);
		sdk.on("disconnected", syncState);
		sdk.on("login", syncState);
		sdk.on("logout", syncState);
		sdk.on("chain_changed", syncState);
		sdk.on("initialized", syncState);

		return () => {
			sdk.off("connected", syncState);
			sdk.off("disconnected", syncState);
			sdk.off("login", syncState);
			sdk.off("logout", syncState);
			sdk.off("chain_changed", syncState);
			sdk.off("initialized", syncState);
		};
	}, [sdk]);

	const contextValue = useMemo<NeroMpcAuthContextValue>(
		() => ({
			sdk,
			state,
			isLoading,
			error,
		}),
		[sdk, state, isLoading, error],
	);

	return (
		<ThemeProvider uiConfig={uiConfig} defaultMode={themeMode}>
			<NeroMpcAuthContext.Provider value={contextValue}>
				{children}
			</NeroMpcAuthContext.Provider>
		</ThemeProvider>
	);
}
