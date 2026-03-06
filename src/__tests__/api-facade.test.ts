import { describe, expect, it } from "vitest";
import { APIClient } from "../transport/api-client";
import { AdminAPI } from "../transport/api/admin-api";
import { AuditAPI } from "../transport/api/audit-api";
import { AuthAPI } from "../transport/api/auth-api";
import { BackupAPI } from "../transport/api/backup-api";
import { DkgAPI } from "../transport/api/dkg-api";
import { DklsAPI } from "../transport/api/dkls-api";
import { FactorAPI } from "../transport/api/factor-api";
import { MfaAPI } from "../transport/api/mfa-api";
import { RecoveryAPI } from "../transport/api/recovery-api";
import { SessionAPI } from "../transport/api/session-api";
import { UserAPI } from "../transport/api/user-api";
import { WalletAPI } from "../transport/api/wallet-api";

const testConfig = {
	backendUrl: "https://api.test.com",
	chainId: 689,
};

describe("APIClient Facade Delegation", () => {
	const client = new APIClient(testConfig);

	it("should expose auth namespace as AuthAPI", () => {
		expect(client.auth).toBeInstanceOf(AuthAPI);
	});

	it("should expose session namespace as SessionAPI", () => {
		expect(client.session).toBeInstanceOf(SessionAPI);
	});

	it("should expose dkg namespace as DkgAPI", () => {
		expect(client.dkg).toBeInstanceOf(DkgAPI);
	});

	it("should expose dkls namespace as DklsAPI", () => {
		expect(client.dkls).toBeInstanceOf(DklsAPI);
	});

	it("should expose wallet namespace as WalletAPI", () => {
		expect(client.wallet).toBeInstanceOf(WalletAPI);
	});

	it("should expose backup namespace as BackupAPI", () => {
		expect(client.backup).toBeInstanceOf(BackupAPI);
	});

	it("should expose recovery namespace as RecoveryAPI", () => {
		expect(client.recovery).toBeInstanceOf(RecoveryAPI);
	});

	it("should expose factor namespace as FactorAPI", () => {
		expect(client.factor).toBeInstanceOf(FactorAPI);
	});

	it("should expose mfa namespace as MfaAPI", () => {
		expect(client.mfa).toBeInstanceOf(MfaAPI);
	});

	it("should expose user namespace as UserAPI", () => {
		expect(client.user).toBeInstanceOf(UserAPI);
	});

	it("should expose audit namespace as AuditAPI", () => {
		expect(client.audit).toBeInstanceOf(AuditAPI);
	});

	it("should expose admin namespace as AdminAPI", () => {
		expect(client.admin).toBeInstanceOf(AdminAPI);
	});

	it("should manage tokens consistently across namespaces", () => {
		const tokens = {
			accessToken: "at-test",
			refreshToken: "rt-test",
			expiresAt: Date.now() + 3600000,
		};

		client.setTokens(tokens);
		expect(client.getTokens()).toEqual(tokens);

		client.clearTokens();
		expect(client.getTokens()).toBeNull();
	});

	it("should accept middleware configuration", () => {
		const clientWithConfig = new APIClient(testConfig, {
			retryConfig: { maxRetries: 5 },
		});
		expect(clientWithConfig.auth).toBeInstanceOf(AuthAPI);
	});
});
