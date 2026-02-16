import { useCallback, useState } from "react";
import type { OAuthProvider } from "../../nero-sdk";
import type { CustomLoginOptions, User } from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroConnectReturn {
	connect: (provider: OAuthProvider, redirectUri?: string) => Promise<void>;
	handleCallback: (
		provider: OAuthProvider,
		code: string,
		state: string,
	) => Promise<{ user: User; requiresDKG: boolean }>;
	loginWithEmail: (
		email: string,
		type?: "otp" | "magic_link",
	) => Promise<{ message: string; expiresInMinutes: number }>;
	verifyEmailLogin: (
		email: string,
		code: string,
	) => Promise<{ user: User; requiresDKG: boolean }>;
	loginWithPhone: (
		phoneNumber: string,
	) => Promise<{ message: string; expiresInMinutes: number }>;
	verifyPhoneLogin: (
		phoneNumber: string,
		code: string,
	) => Promise<{ user: User; requiresDKG: boolean }>;
	loginWithCustomJwt: (
		options: CustomLoginOptions,
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
			if (!sdk) throw new Error("SDK not initialized");
			setIsConnecting(true);
			setError(null);
			try {
				await sdk.loginWithOAuth(provider, redirectUri);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			} finally {
				setIsConnecting(false);
			}
		},
		[sdk],
	);

	const handleCallback = useCallback(
		async (provider: OAuthProvider, code: string, state: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsConnecting(true);
			setError(null);
			try {
				return await sdk.handleOAuthCallback(provider, code, state);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			} finally {
				setIsConnecting(false);
			}
		},
		[sdk],
	);

	const loginWithEmail = useCallback(
		async (email: string, type?: "otp" | "magic_link") => {
			if (!sdk) throw new Error("SDK not initialized");
			setError(null);
			try {
				return await sdk.loginWithEmail(email, type);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			}
		},
		[sdk],
	);

	const verifyEmailLogin = useCallback(
		async (email: string, code: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsConnecting(true);
			setError(null);
			try {
				return await sdk.verifyEmailLogin(email, code);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			} finally {
				setIsConnecting(false);
			}
		},
		[sdk],
	);

	const loginWithPhone = useCallback(
		async (phoneNumber: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setError(null);
			try {
				return await sdk.loginWithPhone(phoneNumber);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			}
		},
		[sdk],
	);

	const verifyPhoneLogin = useCallback(
		async (phoneNumber: string, code: string) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsConnecting(true);
			setError(null);
			try {
				return await sdk.verifyPhoneLogin(phoneNumber, code);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			} finally {
				setIsConnecting(false);
			}
		},
		[sdk],
	);

	const loginWithCustomJwt = useCallback(
		async (options: CustomLoginOptions) => {
			if (!sdk) throw new Error("SDK not initialized");
			setIsConnecting(true);
			setError(null);
			try {
				return await sdk.loginWithCustomJwt(options);
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			} finally {
				setIsConnecting(false);
			}
		},
		[sdk],
	);

	return {
		connect,
		handleCallback,
		loginWithEmail,
		verifyEmailLogin,
		loginWithPhone,
		verifyPhoneLogin,
		loginWithCustomJwt,
		isConnecting,
		error,
	};
}
