import type { NeroSDKState } from "../../nero-sdk";
import type { NeroMpcSDK } from "../../nero-sdk";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroMpcAuthReturn extends NeroSDKState {
	sdk: NeroMpcSDK | null;
	isLoading: boolean;
	error: Error | null;
}

export function useNeroMpcAuth(): UseNeroMpcAuthReturn {
	const { sdk, state, isLoading, error } = useNeroMpcAuthContext();

	return {
		...state,
		sdk,
		isLoading,
		error,
	};
}
