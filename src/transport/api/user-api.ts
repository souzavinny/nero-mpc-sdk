import type {
	ActivityEntry,
	NotificationPreferences,
	SecuritySettings,
	TrustedDevice,
	UserProfile,
} from "../../types";
import type { RequestFn } from "./types";

export class UserAPI {
	constructor(private request: RequestFn) {}

	async getProfile(): Promise<{ profile: UserProfile }> {
		return this.request("GET", "/api/v2/user/profile");
	}

	async updateProfile(data: {
		displayName?: string;
		profilePicture?: string;
	}): Promise<{ profile: Partial<UserProfile> }> {
		return this.request("PUT", "/api/v2/user/profile", data);
	}

	async deleteAccount(
		confirmation: string,
		password?: string,
	): Promise<{ message: string }> {
		return this.request("DELETE", "/api/v2/user/profile", {
			confirmation,
			password,
		});
	}

	async getSessions(): Promise<{
		sessions: unknown[];
		message?: string;
	}> {
		return this.request("GET", "/api/v2/user/sessions");
	}

	async revokeSession(sessionId: string): Promise<void> {
		return this.request("DELETE", `/api/v2/user/sessions/${sessionId}`);
	}

	async revokeAllSessions(): Promise<void> {
		return this.request("DELETE", "/api/v2/user/sessions");
	}

	async getDevices(): Promise<{
		devices: TrustedDevice[];
	}> {
		return this.request("GET", "/api/v2/user/devices");
	}

	async initiateDeviceVerification(deviceName?: string): Promise<{
		verificationId: string;
		expiresAt: string;
		emailSent: string;
		message: string;
	}> {
		return this.request("POST", "/api/v2/user/devices/verify/initiate", {
			deviceName,
		});
	}

	async completeDeviceVerification(
		verificationId: string,
		code: string,
	): Promise<{
		deviceId: string;
		trustLevel: string;
		message: string;
	}> {
		return this.request("POST", "/api/v2/user/devices/verify/complete", {
			verificationId,
			code,
		});
	}

	async trustDevice(
		deviceId: string,
		deviceName?: string,
	): Promise<{ deviceId: string; message: string }> {
		return this.request("POST", `/api/v2/user/devices/${deviceId}/trust`, {
			deviceName,
		});
	}

	async removeDevice(
		deviceId: string,
	): Promise<{ deviceId: string; message: string }> {
		return this.request("DELETE", `/api/v2/user/devices/${deviceId}`);
	}

	async getSecurity(): Promise<{
		securitySettings: SecuritySettings;
	}> {
		return this.request("GET", "/api/v2/user/security");
	}

	async updateSecurity(
		settings: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		return this.request("PUT", "/api/v2/user/security", settings);
	}

	async changePassword(
		currentPassword: string,
		newPassword: string,
		confirmPassword: string,
	): Promise<Record<string, unknown>> {
		return this.request("POST", "/api/v2/user/security/change-password", {
			currentPassword,
			newPassword,
			confirmPassword,
		});
	}

	async getActivity(params?: {
		page?: number;
		limit?: number;
		action?: string;
		from?: string;
		to?: string;
	}): Promise<{
		activities: ActivityEntry[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	}> {
		const query = new URLSearchParams();
		if (params?.page) query.set("page", String(params.page));
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.action) query.set("action", params.action);
		if (params?.from) query.set("from", params.from);
		if (params?.to) query.set("to", params.to);
		const qs = query.toString();
		return this.request("GET", `/api/v2/user/activity${qs ? `?${qs}` : ""}`);
	}

	async getSecurityEvents(params?: {
		page?: number;
		limit?: number;
	}): Promise<{
		events: unknown[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	}> {
		const query = new URLSearchParams();
		if (params?.page) query.set("page", String(params.page));
		if (params?.limit) query.set("limit", String(params.limit));
		const qs = query.toString();
		return this.request(
			"GET",
			`/api/v2/user/security-events${qs ? `?${qs}` : ""}`,
		);
	}

	async exportData(
		format?: "json" | "csv",
		includeWallet?: boolean,
	): Promise<Record<string, unknown>> {
		const query = new URLSearchParams();
		if (format) query.set("format", format);
		if (includeWallet !== undefined)
			query.set("includeWallet", String(includeWallet));
		const qs = query.toString();
		return this.request("GET", `/api/v2/user/export${qs ? `?${qs}` : ""}`);
	}

	async getNotifications(): Promise<{
		preferences: NotificationPreferences;
	}> {
		return this.request("GET", "/api/v2/user/notifications");
	}

	async updateNotifications(prefs: Partial<NotificationPreferences>): Promise<{
		preferences: NotificationPreferences;
		message: string;
	}> {
		return this.request("PUT", "/api/v2/user/notifications", prefs);
	}
}
