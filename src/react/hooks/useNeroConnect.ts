import { useCallback, useState } from "react";
import type { OAuthProvider } from "../../nero-sdk";
import type { User } from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroConnectReturn {
	connect: (provider: OAuthProvider, redirectUri?: string) => Promise<void>;
	handleCallback: (
		provider: OAuthProvider,
		code: string,
		state: string,
	) => Promise<{ user: User; requiresDKG: boolean }>;
	isConnecting: boolean;
	error: Error | null;
}

export function useNeroConnect(): UseNeroConnectReturn {
	const { sdk } = useNeroMpcAuthContext();
	const [isConnecting, setIsConnecting] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const connect = useCallback(
		async (provider: OAuthProvider, redirectUri?: string) => {
			if (!sdk) {
				throw new Error("SDK not initialized");
			}

			setIsConnecting(true);
			setError(null);

			try {
				switch (provider) {
					case "google":
						await sdk.loginWithGoogle(redirectUri);
						break;
					case "github":
						await sdk.loginWithGithub(redirectUri);
						break;
					case "apple":
						await sdk.loginWithApple(redirectUri);
						break;
					default:
						throw new Error(`Unsupported provider: ${provider}`);
				}
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				setError(error);
				throw error;
			} finally {
				setIsConnecting(false);
			}
		},
		[sdk],
	);

	const handleCallback = useCallback(
		async (provider: OAuthProvider, code: string, state: string) => {
			if (!sdk) {
				throw new Error("SDK not initialized");
			}

			setIsConnecting(true);
			setError(null);

			try {
				const result = await sdk.handleOAuthCallback(provider, code, state);
				return result;
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				setError(error);
				throw error;
			} finally {
				setIsConnecting(false);
			}
		},
		[sdk],
	);

	return {
		connect,
		handleCallback,
		isConnecting,
		error,
	};
}
