import { useCallback, useState } from "react";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroDisconnectReturn {
	disconnect: () => Promise<void>;
	isDisconnecting: boolean;
	error: Error | null;
}

export function useNeroDisconnect(): UseNeroDisconnectReturn {
	const { sdk } = useNeroMpcAuthContext();
	const [isDisconnecting, setIsDisconnecting] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const disconnect = useCallback(async () => {
		if (!sdk) {
			throw new Error("SDK not initialized");
		}

		setIsDisconnecting(true);
		setError(null);

		try {
			await sdk.logout();
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			setError(error);
			throw error;
		} finally {
			setIsDisconnecting(false);
		}
	}, [sdk]);

	return {
		disconnect,
		isDisconnecting,
		error,
	};
}
