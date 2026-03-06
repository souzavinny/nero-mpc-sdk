import type {
	AuthTokens,
	CustomLoginOptions,
	DeviceFingerprint,
	OAuthProviderInfo,
	SocialLoginResponse,
	User,
	WalletInfo,
} from "../../types";
import type { RequestFn } from "./types";

function mapTokens(
	raw: SocialLoginResponse["tokens"],
	dappShare?: string,
): AuthTokens {
	return {
		accessToken: raw.accessToken,
		refreshToken: raw.refreshToken,
		expiresAt: Date.now() + raw.expiresIn * 1000,
		dappShare,
	};
}

function needsDKG(wallet?: SocialLoginResponse["wallet"]): boolean {
	return wallet?.requiresKeyGeneration === true && !wallet?.walletAddress;
}

export class AuthAPI {
	constructor(private request: RequestFn) {}

	async getOAuthUrl(
		provider: string,
		redirectUri: string,
	): Promise<{ url: string; state: string }> {
		const data = await this.request<{
			authUrl: string;
			state: string;
		}>(
			"GET",
			`/api/v2/auth/oauth-url/${provider}?redirectUri=${encodeURIComponent(redirectUri)}`,
			undefined,
			false,
		);
		return { url: data.authUrl, state: data.state };
	}

	async handleOAuthCallback(
		provider: string,
		code: string,
		state: string,
		fingerprint: DeviceFingerprint,
		options?: { redirectUri?: string },
	): Promise<{
		user: User;
		tokens: AuthTokens;
		wallet?: WalletInfo;
		requiresDKG: boolean;
		rawTokens: SocialLoginResponse["tokens"];
		dappShare?: string;
	}> {
		const result = await this.request<SocialLoginResponse>(
			"POST",
			"/api/v2/auth/social-login",
			{
				provider,
				code,
				state,
				redirectUri: options?.redirectUri,
				deviceId: fingerprint.additionalData,
			},
			false,
		);

		return {
			user: result.user,
			tokens: mapTokens(result.tokens, result.dappShare),
			wallet: result.wallet?.walletAddress
				? {
						eoaAddress: result.wallet.walletAddress,
						publicKey: "",
						chainId: 0,
					}
				: undefined,
			requiresDKG: needsDKG(result.wallet),
			rawTokens: result.tokens,
			dappShare: result.dappShare,
		};
	}

	async getCurrentUser(): Promise<User> {
		const result = await this.request<{ user: User }>("GET", "/api/v2/auth/me");
		return result.user;
	}

	async logout(): Promise<void> {
		await this.request("POST", "/api/v2/auth/logout");
	}

	async getOAuthProviders(): Promise<OAuthProviderInfo[]> {
		const result = await this.request<{
			providers: OAuthProviderInfo[];
		}>("GET", "/api/v2/auth/providers", undefined, false);
		return result.providers;
	}

	async sendEmailAuth(
		email: string,
		type: "otp" | "magic_link" = "otp",
	): Promise<{ message: string; expiresInMinutes: number }> {
		return this.request(
			"POST",
			"/api/v2/auth/email/send",
			{ email, type },
			false,
		);
	}

	async verifyEmailAuth(
		email: string,
		code: string,
		options?: { deviceId?: string; deviceName?: string },
	): Promise<{
		user: User;
		tokens: AuthTokens;
		requiresDKG: boolean;
	}> {
		const result = await this.request<SocialLoginResponse>(
			"POST",
			"/api/v2/auth/email/verify",
			{ email, code, ...options },
			false,
		);

		return {
			user: result.user,
			tokens: mapTokens(result.tokens, result.dappShare),
			requiresDKG: needsDKG(result.wallet),
		};
	}

	async sendPhoneOTP(
		phoneNumber: string,
	): Promise<{ message: string; expiresInMinutes: number }> {
		return this.request(
			"POST",
			"/api/v2/auth/phone/send",
			{ phoneNumber },
			false,
		);
	}

	async verifyPhoneOTP(
		phoneNumber: string,
		code: string,
		options?: { deviceId?: string; deviceName?: string },
	): Promise<{
		user: User;
		tokens: AuthTokens;
		requiresDKG: boolean;
	}> {
		const result = await this.request<SocialLoginResponse>(
			"POST",
			"/api/v2/auth/phone/verify",
			{ phoneNumber, code, ...options },
			false,
		);

		return {
			user: result.user,
			tokens: mapTokens(result.tokens, result.dappShare),
			requiresDKG: needsDKG(result.wallet),
		};
	}

	async customLogin(options: CustomLoginOptions): Promise<{
		user: User;
		tokens: AuthTokens;
		requiresDKG: boolean;
	}> {
		const result = await this.request<SocialLoginResponse>(
			"POST",
			"/api/v2/auth/custom-login",
			{
				verifier_id: options.verifierId,
				id_token: options.idToken,
				deviceId: options.deviceId,
				deviceName: options.deviceName,
			},
			false,
		);

		return {
			user: result.user,
			tokens: mapTokens(result.tokens, result.dappShare),
			requiresDKG: needsDKG(result.wallet),
		};
	}
}
