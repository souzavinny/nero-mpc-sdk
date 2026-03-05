import type {
	AuthTokens,
	SessionReconnectResult,
	SessionStatus,
	User,
} from "../../types";
import type { RequestFn } from "./types";

function mapRawTokens(raw: {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}): AuthTokens {
	return {
		accessToken: raw.accessToken,
		refreshToken: raw.refreshToken,
		expiresAt: Date.now() + raw.expiresIn * 1000,
	};
}

export class SessionAPI {
	constructor(private request: RequestFn) {}

	async refresh(
		refreshToken: string,
		deviceId?: string,
	): Promise<{ tokens: AuthTokens; sessionLifetime: number }> {
		const result = await this.request<{
			tokens: {
				accessToken: string;
				refreshToken: string;
				expiresIn: number;
			};
			sessionLifetime: number;
		}>("POST", "/api/v2/session/refresh", { refreshToken, deviceId }, false);

		return {
			tokens: mapRawTokens(result.tokens),
			sessionLifetime: result.sessionLifetime,
		};
	}

	async status(): Promise<SessionStatus> {
		return this.request("GET", "/api/v2/session/status");
	}

	async reconnect(
		dappShare: string,
		deviceId?: string,
	): Promise<SessionReconnectResult> {
		const result = await this.request<{
			user: User;
			tokens: {
				accessToken: string;
				refreshToken: string;
				expiresIn: number;
			};
			sessionLifetime: number;
		}>(
			"POST",
			"/api/v2/session/reconnect",
			{ dapp_share: dappShare, device_id: deviceId },
			false,
		);

		return {
			user: result.user,
			tokens: mapRawTokens(result.tokens),
			sessionLifetime: result.sessionLifetime,
		};
	}

	async revoke(): Promise<{ message: string }> {
		return this.request("POST", "/api/v2/session/revoke");
	}
}
