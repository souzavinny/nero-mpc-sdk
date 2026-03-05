import type { AuditLog, AuditLogQuery, AuditStats } from "../../types";
import type { RequestFn } from "./types";

export class AuditAPI {
	constructor(private request: RequestFn) {}

	async getLogs(params?: AuditLogQuery): Promise<{
		logs: AuditLog[];
		pagination: {
			limit: number;
			offset: number;
			total: number;
			hasMore: boolean;
		};
	}> {
		const query = new URLSearchParams();
		if (params?.limit) query.set("limit", String(params.limit));
		if (params?.offset) query.set("offset", String(params.offset));
		if (params?.action) query.set("action", params.action);
		if (params?.startDate) query.set("startDate", params.startDate);
		if (params?.endDate) query.set("endDate", params.endDate);
		const qs = query.toString();
		return this.request("GET", `/api/v2/audit-logs${qs ? `?${qs}` : ""}`);
	}

	async getStats(): Promise<AuditStats> {
		return this.request("GET", "/api/v2/audit-logs/stats");
	}

	async getRecent(): Promise<{
		logs: AuditLog[];
	}> {
		return this.request("GET", "/api/v2/audit-logs/recent");
	}
}
