import type { BackupData, BackupInfo } from "../../types";
import type { RequestFn } from "./types";

export class BackupAPI {
	constructor(private request: RequestFn) {}

	async export(password: string): Promise<{
		backup: BackupData;
		fingerprint: string;
	}> {
		return this.request("POST", "/api/v2/backup/export", { password });
	}

	async import(
		backup: BackupData,
		password: string,
	): Promise<{
		partyId: number;
		publicKey: string;
		createdAt: string;
		verified: boolean;
	}> {
		return this.request("POST", "/api/v2/backup/import", {
			backup,
			password,
		});
	}

	async info(): Promise<BackupInfo> {
		return this.request("GET", "/api/v2/backup/info");
	}
}
