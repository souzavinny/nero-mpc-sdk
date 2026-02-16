import { useCallback, useState } from "react";
import type {
	MFAChallenge,
	MFAMethodType,
	MFAOperationType,
	MFAPolicy,
	MFAStatus,
	TOTPSetupResponse,
	WebAuthnSetupResponse,
} from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroMFAReturn {
	getStatus: () => Promise<MFAStatus>;
	setupTotp: () => Promise<TOTPSetupResponse>;
	verifyTotpSetup: (
		methodId: string,
		code: string,
	) => Promise<{
		methodId: string;
		methodType: string;
		backupCodesRemaining: number;
	}>;
	setupWebAuthn: () => Promise<WebAuthnSetupResponse>;
	verifyWebAuthnSetup: (
		methodId: string,
		credential: Record<string, unknown>,
	) => Promise<{ methodId: string; methodType: string }>;
	createChallenge: (
		operation: MFAOperationType,
		methodType?: MFAMethodType,
	) => Promise<MFAChallenge>;
	verifyChallenge: (
		challengeId: string,
		response: {
			code?: string;
			credential?: Record<string, unknown>;
			backupCode?: string;
		},
	) => Promise<{
		verified: boolean;
		methodId: string;
		methodType: string;
		backupCodesRemaining?: number;
	}>;
	disableMethod: (
		methodId: string,
	) => Promise<{ methodId: string; disabled: boolean }>;
	regenerateBackupCodes: (
		methodId: string,
	) => Promise<{ backupCodes: string[]; count: number }>;
	updatePolicy: (policy: MFAPolicy) => Promise<Record<string, unknown>>;
	status: MFAStatus | null;
	isLoading: boolean;
	error: Error | null;
}

export function useNeroMFA(): UseNeroMFAReturn {
	const { sdk } = useNeroMpcAuthContext();
	const [status, setStatus] = useState<MFAStatus | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const wrap = useCallback(
		async <T>(fn: () => Promise<T>, loading = true): Promise<T> => {
			if (!sdk) throw new Error("SDK not initialized");
			if (loading) setIsLoading(true);
			setError(null);
			try {
				return await fn();
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				throw e;
			} finally {
				if (loading) setIsLoading(false);
			}
		},
		[sdk],
	);

	const getStatus = useCallback(async () => {
		return wrap(async () => {
			const result = await sdk!.apiClientForHooks.mfaGetStatus();
			setStatus(result);
			return result;
		});
	}, [sdk, wrap]);

	const setupTotp = useCallback(
		() => wrap(() => sdk!.apiClientForHooks.mfaTotpSetup()),
		[sdk, wrap],
	);

	const verifyTotpSetup = useCallback(
		(methodId: string, code: string) =>
			wrap(() => sdk!.apiClientForHooks.mfaTotpVerifySetup(methodId, code)),
		[sdk, wrap],
	);

	const setupWebAuthn = useCallback(
		() => wrap(() => sdk!.apiClientForHooks.mfaWebAuthnSetup()),
		[sdk, wrap],
	);

	const verifyWebAuthnSetup = useCallback(
		(methodId: string, credential: Record<string, unknown>) =>
			wrap(() =>
				sdk!.apiClientForHooks.mfaWebAuthnVerifySetup(methodId, credential),
			),
		[sdk, wrap],
	);

	const createChallenge = useCallback(
		(operation: MFAOperationType, methodType?: MFAMethodType) =>
			wrap(() =>
				sdk!.apiClientForHooks.mfaCreateChallenge(operation, methodType),
			),
		[sdk, wrap],
	);

	const verifyChallenge = useCallback(
		(
			challengeId: string,
			response: {
				code?: string;
				credential?: Record<string, unknown>;
				backupCode?: string;
			},
		) =>
			wrap(() =>
				sdk!.apiClientForHooks.mfaVerifyChallenge(challengeId, response),
			),
		[sdk, wrap],
	);

	const disableMethod = useCallback(
		(methodId: string) =>
			wrap(() => sdk!.apiClientForHooks.mfaDisableMethod(methodId)),
		[sdk, wrap],
	);

	const regenerateBackupCodes = useCallback(
		(methodId: string) =>
			wrap(() => sdk!.apiClientForHooks.mfaRegenerateBackupCodes(methodId)),
		[sdk, wrap],
	);

	const updatePolicy = useCallback(
		(policy: MFAPolicy) =>
			wrap(() => sdk!.apiClientForHooks.mfaUpdatePolicy(policy)),
		[sdk, wrap],
	);

	return {
		getStatus,
		setupTotp,
		verifyTotpSetup,
		setupWebAuthn,
		verifyWebAuthnSetup,
		createChallenge,
		verifyChallenge,
		disableMethod,
		regenerateBackupCodes,
		updatePolicy,
		status,
		isLoading,
		error,
	};
}
