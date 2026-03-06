import type { Factor, FactorType } from "../../types";
import type { RequestFn } from "./types";

export class FactorAPI {
	constructor(private request: RequestFn) {}

	async add(
		factorType: FactorType,
		encryptedShare: string,
		options?: { password?: string; deviceFingerprint?: string },
	): Promise<{
		factor: {
			id: string;
			factorType: string;
			status: string;
			createdAt: string;
		};
		factorKey?: string;
	}> {
		return this.request("POST", "/api/v2/factors", {
			factorType,
			encryptedShare,
			...options,
		});
	}

	async list(): Promise<{
		factors: Factor[];
		count: number;
	}> {
		return this.request("GET", "/api/v2/factors");
	}

	async delete(id: string): Promise<{ deleted: true }> {
		return this.request("DELETE", `/api/v2/factors/${id}`);
	}

	async verify(
		factorId: string,
		verificationCode: string,
	): Promise<{ verified: boolean }> {
		return this.request("POST", "/api/v2/factors/verify", {
			factorId,
			verificationCode,
		});
	}

	async recoverShare(
		factorId: string,
		verificationCode: string,
	): Promise<{ recoveredShare: unknown }> {
		return this.request("POST", "/api/v2/factors/recover-share", {
			factorId,
			verificationCode,
		});
	}

	async recoveryInitiate(factorId: string): Promise<{
		attemptId: string;
		status: string;
		requiresVerification: boolean;
	}> {
		return this.request("POST", "/api/v2/factors/recover/initiate", {
			factorId,
		});
	}

	async recoveryVerify(
		attemptId: string,
		verificationCode: string,
	): Promise<{
		attemptId: string;
		status: string;
		verified: boolean;
		canComplete: boolean;
	}> {
		return this.request("POST", "/api/v2/factors/recover/verify", {
			attemptId,
			verificationCode,
		});
	}

	async recoveryComplete(attemptId: string): Promise<{
		attemptId: string;
		status: string;
		recoveredData: unknown;
	}> {
		return this.request("POST", "/api/v2/factors/recover/complete", {
			attemptId,
		});
	}

	async recoveryCancel(attemptId: string): Promise<{ cancelled: true }> {
		return this.request("POST", "/api/v2/factors/recover/cancel", {
			attemptId,
		});
	}
}
