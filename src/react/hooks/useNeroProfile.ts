import { useCallback, useState } from "react";
import type {
	ActivityEntry,
	NotificationPreferences,
	SecuritySettings,
	TrustedDevice,
	UserProfile,
} from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroProfileReturn {
	getProfile: () => Promise<{ profile: UserProfile }>;
	updateProfile: (data: {
		displayName?: string;
		profilePicture?: string;
	}) => Promise<{ profile: Partial<UserProfile> }>;
	deleteAccount: (
		confirmation: string,
		password?: string,
	) => Promise<{ message: string }>;
	getDevices: () => Promise<{ devices: TrustedDevice[] }>;
	trustDevice: (
		deviceId: string,
		deviceName?: string,
	) => Promise<{ deviceId: string; message: string }>;
	removeDevice: (
		deviceId: string,
	) => Promise<{ deviceId: string; message: string }>;
	getSecurity: () => Promise<{ securitySettings: SecuritySettings }>;
	getActivity: (params?: {
		page?: number;
		limit?: number;
		action?: string;
		from?: string;
		to?: string;
	}) => Promise<{
		activities: ActivityEntry[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	}>;
	getNotifications: () => Promise<{ preferences: NotificationPreferences }>;
	updateNotifications: (prefs: Partial<NotificationPreferences>) => Promise<{
		preferences: NotificationPreferences;
		message: string;
	}>;
	exportData: (
		format?: "json" | "csv",
		includeWallet?: boolean,
	) => Promise<Record<string, unknown>>;
	profile: UserProfile | null;
	isLoading: boolean;
	error: Error | null;
}

export function useNeroProfile(): UseNeroProfileReturn {
	const { sdk } = useNeroMpcAuthContext();
	const [profile, setProfile] = useState<UserProfile | null>(null);
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

	const getProfile = useCallback(async () => {
		return wrap(async () => {
			const result = await sdk!.apiClientForHooks.userGetProfile();
			setProfile(result.profile);
			return result;
		});
	}, [sdk, wrap]);

	const updateProfile = useCallback(
		(data: { displayName?: string; profilePicture?: string }) =>
			wrap(() => sdk!.apiClientForHooks.userUpdateProfile(data)),
		[sdk, wrap],
	);

	const deleteAccount = useCallback(
		(confirmation: string, password?: string) =>
			wrap(() =>
				sdk!.apiClientForHooks.userDeleteAccount(confirmation, password),
			),
		[sdk, wrap],
	);

	const getDevices = useCallback(
		() => wrap(() => sdk!.apiClientForHooks.userGetDevices()),
		[sdk, wrap],
	);

	const trustDevice = useCallback(
		(deviceId: string, deviceName?: string) =>
			wrap(() => sdk!.apiClientForHooks.userTrustDevice(deviceId, deviceName)),
		[sdk, wrap],
	);

	const removeDevice = useCallback(
		(deviceId: string) =>
			wrap(() => sdk!.apiClientForHooks.userRemoveDevice(deviceId)),
		[sdk, wrap],
	);

	const getSecurity = useCallback(
		() => wrap(() => sdk!.apiClientForHooks.userGetSecurity()),
		[sdk, wrap],
	);

	const getActivity = useCallback(
		(params?: {
			page?: number;
			limit?: number;
			action?: string;
			from?: string;
			to?: string;
		}) => wrap(() => sdk!.apiClientForHooks.userGetActivity(params)),
		[sdk, wrap],
	);

	const getNotifications = useCallback(
		() => wrap(() => sdk!.apiClientForHooks.userGetNotifications()),
		[sdk, wrap],
	);

	const updateNotifications = useCallback(
		(prefs: Partial<NotificationPreferences>) =>
			wrap(() => sdk!.apiClientForHooks.userUpdateNotifications(prefs)),
		[sdk, wrap],
	);

	const exportData = useCallback(
		(format?: "json" | "csv", includeWallet?: boolean) =>
			wrap(() => sdk!.apiClientForHooks.userExportData(format, includeWallet)),
		[sdk, wrap],
	);

	return {
		getProfile,
		updateProfile,
		deleteAccount,
		getDevices,
		trustDevice,
		removeDevice,
		getSecurity,
		getActivity,
		getNotifications,
		updateNotifications,
		exportData,
		profile,
		isLoading,
		error,
	};
}
