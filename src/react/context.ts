import { createContext, useContext } from "react";
import type { NeroMpcSDK, NeroSDKState } from "../nero-sdk";

export interface NeroMpcAuthContextValue {
	sdk: NeroMpcSDK | null;
	state: NeroSDKState;
	isLoading: boolean;
	error: Error | null;
}

export const NeroMpcAuthContext = createContext<NeroMpcAuthContextValue | null>(
	null,
);

export function useNeroMpcAuthContext(): NeroMpcAuthContextValue {
	const context = useContext(NeroMpcAuthContext);
	if (!context) {
		throw new Error(
			"useNeroMpcAuthContext must be used within a NeroMpcAuthProvider",
		);
	}
	return context;
}
