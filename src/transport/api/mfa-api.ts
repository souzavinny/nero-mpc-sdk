import type {
	MFAChallenge,
	MFAMethodType,
	MFAOperationType,
	MFAPolicy,
	MFAStatus,
	TOTPSetupResponse,
	WebAuthnSetupResponse,
} from "../../types";
import type { RequestFn } from "./types";

export class MfaAPI {
	constructor(private request: RequestFn) {}

	async getStatus(): Promise<MFAStatus> {
		return this.request("GET", "/api/v2/mfa/status");
	}

	async totpSetup(): Promise<TOTPSetupResponse> {
		return this.request("POST", "/api/v2/mfa/totp/setup");
	}

	async totpVerifySetup(
		methodId: string,
		code: string,
	): Promise<{
		methodId: string;
		methodType: string;
		backupCodesRemaining: number;
	}> {
		return this.request("POST", "/api/v2/mfa/totp/verify-setup", {
			methodId,
			code,
		});
	}

	async webAuthnSetup(): Promise<WebAuthnSetupResponse> {
		return this.request("POST", "/api/v2/mfa/webauthn/setup");
	}

	async webAuthnVerifySetup(
		methodId: string,
		credential: Record<string, unknown>,
	): Promise<{ methodId: string; methodType: string }> {
		return this.request("POST", "/api/v2/mfa/webauthn/verify-setup", {
			methodId,
			credential,
		});
	}

	async createChallenge(
		operation: MFAOperationType,
		methodType?: MFAMethodType,
	): Promise<MFAChallenge> {
		return this.request("POST", "/api/v2/mfa/challenge", {
			operation,
			methodType,
		});
	}

	async verifyChallenge(
		challengeId: string,
		response: {
			code?: string;
			credential?: Record<string, unknown>;
			backupCode?: string;
		},
	): Promise<{
		verified: boolean;
		methodId: string;
		methodType: string;
		backupCodesRemaining?: number;
	}> {
		return this.request("POST", "/api/v2/mfa/verify", {
			challengeId,
			...response,
		});
	}

	async disableMethod(methodId: string): Promise<{
		methodId: string;
		disabled: boolean;
	}> {
		return this.request("DELETE", `/api/v2/mfa/methods/${methodId}`);
	}

	async regenerateBackupCodes(methodId: string): Promise<{
		backupCodes: string[];
		count: number;
	}> {
		return this.request("POST", `/api/v2/mfa/methods/${methodId}/backup-codes`);
	}

	async updatePolicy(policy: MFAPolicy): Promise<Record<string, unknown>> {
		return this.request("PATCH", "/api/v2/mfa/policy", policy);
	}
}
