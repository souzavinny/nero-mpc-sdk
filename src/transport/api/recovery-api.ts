import type {
	RecoveryAttempt,
	RecoveryMethod,
	RecoveryMethodType,
} from "../../types";
import type { RequestFn } from "./types";

export class RecoveryAPI {
	constructor(private request: RequestFn) {}

	async setup(
		methodType: RecoveryMethodType,
		config: Record<string, unknown>,
		encryptedData?: string,
	): Promise<{
		method: {
			id: string;
			methodType: string;
			status: string;
			createdAt: string;
		};
		verificationRequired: boolean;
		expiresAt?: string;
	}> {
		return this.request("POST", "/api/v2/recovery/setup", {
			methodType,
			config: { methodType, ...config },
			encryptedData,
		});
	}

	async listMethods(includeInactive?: boolean): Promise<{
		methods: RecoveryMethod[];
		count: number;
	}> {
		const query = includeInactive ? "?includeInactive=true" : "";
		return this.request("GET", `/api/v2/recovery/methods${query}`);
	}

	async deleteMethod(methodId: string): Promise<{ deleted: true }> {
		return this.request("DELETE", `/api/v2/recovery/methods/${methodId}`);
	}

	async initiate(methodId: string): Promise<RecoveryAttempt> {
		return this.request("POST", "/api/v2/recovery/initiate", { methodId });
	}

	async verify(
		attemptId: string,
		verificationCode: string,
	): Promise<{
		attemptId: string;
		status: string;
		verified: boolean;
		canComplete: boolean;
		timelockExpiresAt: string | null;
	}> {
		return this.request("POST", "/api/v2/recovery/verify", {
			attemptId,
			verificationCode,
		});
	}

	async complete(attemptId: string): Promise<{
		attemptId: string;
		status: string;
		recoveredData: unknown;
	}> {
		return this.request("POST", "/api/v2/recovery/complete", { attemptId });
	}

	async cancel(attemptId: string): Promise<{ cancelled: true }> {
		return this.request("POST", "/api/v2/recovery/cancel", { attemptId });
	}
}
