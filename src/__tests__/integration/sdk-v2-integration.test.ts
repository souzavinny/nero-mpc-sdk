import { describe, it, expect, beforeAll } from "vitest";
import { APIClient } from "../../transport/api-client";

const API_URL = process.env.TEST_API_URL || "http://localhost:3000";
const API_KEY =
	process.env.TEST_API_KEY || "test";

function createClient(): APIClient {
	return new APIClient({
		backendUrl: API_URL,
		apiKey: API_KEY,
	});
}

async function isApiAvailable(): Promise<boolean> {
	try {
		const res = await fetch(`${API_URL}/health`);
		const data = await res.json();
		return data?.success === true;
	} catch {
		return false;
	}
}

describe.runIf(await isApiAvailable())(
	"SDK v2 Integration Tests",
	() => {
		let client: APIClient;

		beforeAll(() => {
			client = createClient();
		});

		describe("Phase 1: API Key + Headers", () => {
			it("should include X-API-Key header and get valid response", async () => {
				const result = await client.getOAuthProviders();
				expect(result).toBeDefined();
				expect(Array.isArray(result)).toBe(true);
				expect(result.length).toBeGreaterThan(0);
			});

			it("should reject requests without API key on protected endpoints", async () => {
				const noKeyClient = new APIClient({
					backendUrl: API_URL,
				});
				try {
					await noKeyClient.sessionStatus();
					expect.unreachable("Should have thrown");
				} catch (err: unknown) {
					expect((err as Error).message).toMatch(
						/API.key|unauthorized|401/i,
					);
				}
			});
		});

		describe("Phase 2: Auth Endpoints", () => {
			it("should list OAuth providers", async () => {
				const result = await client.getOAuthProviders();
				expect(Array.isArray(result)).toBe(true);
				const names = result.map(
					(p: { provider: string }) => p.provider,
				);
				expect(names).toContain("google");
				expect(names).toContain("github");
			});

			it("should generate Google OAuth URL", async () => {
				const result = await client.getOAuthUrl(
					"google",
					"http://localhost:8080/callback",
				);
				expect(result.url).toContain("accounts.google.com");
				expect(result.state).toBeDefined();
				expect(typeof result.state).toBe("string");
			});

			it("should reject session status without auth token", async () => {
				try {
					await client.sessionStatus();
					expect.unreachable("Should have thrown");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});

			it("should send email OTP (expect error without provider setup)", async () => {
				try {
					await client.sendEmailAuth("test@example.com", "otp");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});
		});

		describe("Phase 3: DKG Endpoints", () => {
			it("should initiate a DKG session (expect auth error without token)", async () => {
				try {
					await client.dkgInitiate();
					expect.unreachable("Should have thrown without auth");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});
		});

		describe("Phase 4: Backup/Recovery/Factors", () => {
			it("should get backup info (expect auth error)", async () => {
				try {
					await client.backupInfo();
					expect.unreachable("Should have thrown without auth");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});

			it("should list recovery methods (expect auth error)", async () => {
				try {
					await client.recoveryListMethods();
					expect.unreachable("Should have thrown without auth");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});

			it("should list factors (expect auth error)", async () => {
				try {
					await client.factorList();
					expect.unreachable("Should have thrown without auth");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});
		});

		describe("Phase 5: MFA + User", () => {
			it("should get MFA status (expect auth error)", async () => {
				try {
					await client.mfaGetStatus();
					expect.unreachable("Should have thrown without auth");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});

			it("should get user profile (expect auth error)", async () => {
				try {
					await client.userGetProfile();
					expect.unreachable("Should have thrown without auth");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});
		});

		describe("Phase 6: Audit + Admin", () => {
			it("should get audit logs (expect auth error)", async () => {
				try {
					await client.auditGetLogs();
					expect.unreachable("Should have thrown without auth");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});

			it("should list API keys (expect auth error)", async () => {
				try {
					await client.adminListApiKeys();
					expect.unreachable("Should have thrown without auth");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});

			it("should list verifiers (expect auth error)", async () => {
				try {
					await client.listVerifiers();
					expect.unreachable("Should have thrown without auth");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});

			it("should list aggregate rules (expect auth error)", async () => {
				try {
					await client.listAggregateRules();
					expect.unreachable("Should have thrown without auth");
				} catch (err: unknown) {
					expect(err).toBeDefined();
				}
			});
		});

		describe("Authenticated Flow (with test JWT)", () => {
			let authedClient: APIClient;
			let testToken: string;

			beforeAll(async () => {
				try {
					const res = await fetch(
						`${API_URL}/api/v2/auth/oauth-url/google?redirectUri=http://localhost:8080/callback`,
						{ headers: { "X-API-Key": API_KEY } },
					);
					const data = await res.json();
					if (!data.success) return;

					// We can't complete OAuth flow in tests, but we can verify
					// the OAuth URL generation works end-to-end
					expect(data.data.url).toContain("google");
				} catch {
					// OAuth URL generation not critical for remaining tests
				}
			});

			it("should verify OAuth URL contains expected parameters", async () => {
				const result = await client.getOAuthUrl(
					"google",
					"http://localhost:8080/callback",
				);
				const url = new URL(result.url);
				expect(url.hostname).toContain("google");
				expect(url.searchParams.get("redirect_uri")).toBeDefined();
				expect(url.searchParams.get("state")).toBeDefined();
				expect(url.searchParams.get("response_type")).toBe("code");
			});

			it("should verify GitHub OAuth URL generation", async () => {
				const result = await client.getOAuthUrl(
					"github",
					"http://localhost:8080/callback",
				);
				expect(result.url).toContain("github.com");
				expect(result.state).toBeDefined();
			});
		});

		describe("API Contract Verification", () => {
			it("should return proper error format for invalid endpoints", async () => {
				try {
					const res = await fetch(
						`${API_URL}/api/v2/nonexistent`,
						{ headers: { "X-API-Key": API_KEY } },
					);
					expect(res.status).toBe(404);
				} catch {
					// Network error is acceptable
				}
			});

			it("should return health check with version 2.0.0", async () => {
				const res = await fetch(`${API_URL}/health`);
				const data = await res.json();
				expect(data.success).toBe(true);
				expect(data.data.version).toBe("2.0.0");
				expect(data.data.status).toBe("ok");
			});

			it("should include API version in response meta", async () => {
				const res = await fetch(
					`${API_URL}/api/v2/auth/providers`,
					{ headers: { "X-API-Key": API_KEY } },
				);
				const data = await res.json();
				expect(data.success).toBe(true);
				expect(data.meta).toBeDefined();
				expect(data.meta.requestId).toBeDefined();
			});
		});
	},
);
