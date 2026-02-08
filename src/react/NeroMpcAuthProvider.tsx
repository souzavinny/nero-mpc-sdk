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
		if (sdk) {
			setState(sdk.state);
		}
	}, [sdk?.isAuthenticated, sdk?.hasWallet, sdk?.user]);

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
