import { secp256k1 } from "@noble/curves/secp256k1";
import { describe, expect, it } from "vitest";
import {
	combinePartialSignatures,
	computeLagrangeCoefficient,
	computePartialSignature,
	formatSignature,
	parseMessageHash,
	verifyPartialSignature,
} from "../protocols/signing/partial-signature";

describe("partial-signature", () => {
	const CURVE_ORDER = secp256k1.CURVE.n;
	const G = secp256k1.ProjectivePoint.BASE;

	describe("computePartialSignature", () => {
		it("should compute a valid partial signature with nonce commitment", () => {
			const partyId = 1;
			const keyShare = 12345n;
			const nonceK = 67890n;
			const nonceGamma = 11111n;
			const messageHash =
				0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890n;
			const r =
				0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
			const participatingParties = [1, 2];

			const partial = computePartialSignature(
				partyId,
				keyShare,
				nonceK,
				nonceGamma,
				messageHash,
				r,
				participatingParties,
			);

			expect(partial.partyId).toBe(partyId);
			expect(partial.sigma).toBeGreaterThan(0n);
			expect(partial.sigma).toBeLessThan(CURVE_ORDER);
			expect(partial.publicShare).toBe(G.multiply(keyShare).toHex(true));
			expect(partial.nonceCommitment).toBe(G.multiply(nonceK).toHex(true));
		});
	});

	describe("verifyPartialSignature", () => {
		it("should verify a valid partial signature using algebraic check", () => {
			const partyId = 1;
			const keyShare = 12345n;
			const nonceK = 67890n;
			const nonceGamma = 11111n;
			const messageHash =
				0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890n;
			const r =
				0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
			const participatingParties = [1, 2];

			const partial = computePartialSignature(
				partyId,
				keyShare,
				nonceK,
				nonceGamma,
				messageHash,
				r,
				participatingParties,
			);

			const expectedPublicShare = G.multiply(keyShare).toHex(true);
			const expectedNonceCommitment = G.multiply(nonceK).toHex(true);

			const isValid = verifyPartialSignature(
				partial,
				expectedPublicShare,
				expectedNonceCommitment,
				r,
				messageHash,
				participatingParties,
			);

			expect(isValid).toBe(true);
		});

		it("should verify with multiple parties", () => {
			const participatingParties = [1, 2, 3];

			for (const partyId of participatingParties) {
				const keyShare = BigInt(10000 + partyId * 1000);
				const nonceK = BigInt(50000 + partyId * 500);
				const messageHash =
					0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890n;
				const r =
					0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;

				const partial = computePartialSignature(
					partyId,
					keyShare,
					nonceK,
					0n,
					messageHash,
					r,
					participatingParties,
				);

				const isValid = verifyPartialSignature(
					partial,
					partial.publicShare,
					partial.nonceCommitment,
					r,
					messageHash,
					participatingParties,
				);

				expect(isValid).toBe(true);
			}
		});

		it("should reject partial signature with tampered sigma (CRITICAL)", () => {
			const partyId = 1;
			const keyShare = 12345n;
			const nonceK = 67890n;
			const messageHash =
				0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890n;
			const r =
				0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
			const participatingParties = [1, 2];

			const partial = computePartialSignature(
				partyId,
				keyShare,
				nonceK,
				0n,
				messageHash,
				r,
				participatingParties,
			);

			const tamperedPartial = {
				...partial,
				sigma: partial.sigma + 1n,
			};

			const isValid = verifyPartialSignature(
				tamperedPartial,
				partial.publicShare,
				partial.nonceCommitment,
				r,
				messageHash,
				participatingParties,
			);

			expect(isValid).toBe(false);
		});

		it("should reject malicious party sending arbitrary sigma with real key (CRITICAL DoS TEST)", () => {
			const partyId = 1;
			const keyShare = 12345n;
			const nonceK = 67890n;
			const messageHash =
				0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890n;
			const r =
				0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
			const participatingParties = [1, 2];

			const maliciousSigma = 999999n;

			const maliciousPartial = {
				partyId,
				sigma: maliciousSigma,
				publicShare: G.multiply(keyShare).toHex(true),
				nonceCommitment: G.multiply(nonceK).toHex(true),
			};

			const isValid = verifyPartialSignature(
				maliciousPartial,
				maliciousPartial.publicShare,
				maliciousPartial.nonceCommitment,
				r,
				messageHash,
				participatingParties,
			);

			expect(isValid).toBe(false);
		});

		it("should reject when nonce commitment doesn't match expected", () => {
			const partyId = 1;
			const keyShare = 12345n;
			const nonceK = 67890n;
			const messageHash =
				0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890n;
			const r =
				0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
			const participatingParties = [1, 2];

			const partial = computePartialSignature(
				partyId,
				keyShare,
				nonceK,
				0n,
				messageHash,
				r,
				participatingParties,
			);

			const differentNonceCommitment = G.multiply(99999n).toHex(true);

			const isValid = verifyPartialSignature(
				partial,
				partial.publicShare,
				differentNonceCommitment,
				r,
				messageHash,
				participatingParties,
			);

			expect(isValid).toBe(false);
		});

		it("should reject when public share doesn't match expected", () => {
			const partyId = 1;
			const keyShare = 12345n;
			const nonceK = 67890n;
			const messageHash =
				0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890n;
			const r =
				0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
			const participatingParties = [1, 2];

			const partial = computePartialSignature(
				partyId,
				keyShare,
				nonceK,
				0n,
				messageHash,
				r,
				participatingParties,
			);

			const differentPublicShare = G.multiply(99999n).toHex(true);

			const isValid = verifyPartialSignature(
				partial,
				differentPublicShare,
				partial.nonceCommitment,
				r,
				messageHash,
				participatingParties,
			);

			expect(isValid).toBe(false);
		});

		it("should reject sigma out of range", () => {
			const keyShare = 12345n;
			const nonceK = 67890n;
			const participatingParties = [1, 2];

			const partial = {
				partyId: 1,
				sigma: CURVE_ORDER + 1n,
				publicShare: G.multiply(keyShare).toHex(true),
				nonceCommitment: G.multiply(nonceK).toHex(true),
			};

			const isValid = verifyPartialSignature(
				partial,
				partial.publicShare,
				partial.nonceCommitment,
				12345n,
				67890n,
				participatingParties,
			);

			expect(isValid).toBe(false);
		});

		it("should reject zero sigma", () => {
			const keyShare = 12345n;
			const nonceK = 67890n;
			const participatingParties = [1, 2];

			const partial = {
				partyId: 1,
				sigma: 0n,
				publicShare: G.multiply(keyShare).toHex(true),
				nonceCommitment: G.multiply(nonceK).toHex(true),
			};

			const isValid = verifyPartialSignature(
				partial,
				partial.publicShare,
				partial.nonceCommitment,
				12345n,
				67890n,
				participatingParties,
			);

			expect(isValid).toBe(false);
		});

		it("should reject invalid nonce commitment point", () => {
			const keyShare = 12345n;
			const participatingParties = [1, 2];

			const partial = {
				partyId: 1,
				sigma: 12345n,
				publicShare: G.multiply(keyShare).toHex(true),
				nonceCommitment: "not-a-valid-point",
			};

			const isValid = verifyPartialSignature(
				partial,
				partial.publicShare,
				partial.nonceCommitment,
				12345n,
				67890n,
				participatingParties,
			);

			expect(isValid).toBe(false);
		});

		it("should reject invalid public share point", () => {
			const nonceK = 67890n;
			const participatingParties = [1, 2];

			const partial = {
				partyId: 1,
				sigma: 12345n,
				publicShare: "not-a-valid-point",
				nonceCommitment: G.multiply(nonceK).toHex(true),
			};

			const isValid = verifyPartialSignature(
				partial,
				partial.publicShare,
				partial.nonceCommitment,
				12345n,
				67890n,
				participatingParties,
			);

			expect(isValid).toBe(false);
		});

		it("should reject missing publicShare", () => {
			const nonceK = 67890n;
			const participatingParties = [1, 2];

			const partial = {
				partyId: 1,
				sigma: 12345n,
				publicShare: "",
				nonceCommitment: G.multiply(nonceK).toHex(true),
			};

			const isValid = verifyPartialSignature(
				partial,
				"",
				partial.nonceCommitment,
				12345n,
				67890n,
				participatingParties,
			);

			expect(isValid).toBe(false);
		});

		it("should reject missing nonceCommitment", () => {
			const keyShare = 12345n;
			const participatingParties = [1, 2];

			const partial = {
				partyId: 1,
				sigma: 12345n,
				publicShare: G.multiply(keyShare).toHex(true),
				nonceCommitment: "",
			};

			const isValid = verifyPartialSignature(
				partial,
				partial.publicShare,
				"",
				12345n,
				67890n,
				participatingParties,
			);

			expect(isValid).toBe(false);
		});
	});

	describe("combinePartialSignatures", () => {
		it("should combine partial signatures with even y (v=27)", () => {
			const partials = [
				{ partyId: 1, sigma: 100n, publicShare: "", nonceCommitment: "" },
				{ partyId: 2, sigma: 200n, publicShare: "", nonceCommitment: "" },
			];
			const r = 12345n;
			const combinedRPoint = { x: r, y: 2n };

			const result = combinePartialSignatures(partials, r, combinedRPoint);

			expect(result.r).toBe(r);
			expect(result.s).toBe(300n);
			expect(result.v).toBe(27);
		});

		it("should combine partial signatures with odd y (v=28)", () => {
			const partials = [
				{ partyId: 1, sigma: 100n, publicShare: "", nonceCommitment: "" },
				{ partyId: 2, sigma: 200n, publicShare: "", nonceCommitment: "" },
			];
			const r = 12345n;
			const combinedRPoint = { x: r, y: 3n };

			const result = combinePartialSignatures(partials, r, combinedRPoint);

			expect(result.r).toBe(r);
			expect(result.s).toBe(300n);
			expect(result.v).toBe(28);
		});

		it("should normalize s to lower half of curve order and flip v", () => {
			const halfOrder = CURVE_ORDER / 2n;
			const partials = [
				{
					partyId: 1,
					sigma: halfOrder + 100n,
					publicShare: "",
					nonceCommitment: "",
				},
				{ partyId: 2, sigma: 200n, publicShare: "", nonceCommitment: "" },
			];
			const r = 12345n;
			const combinedRPoint = { x: r, y: 2n };

			const result = combinePartialSignatures(partials, r, combinedRPoint);

			expect(result.s).toBeLessThanOrEqual(halfOrder);
			expect(result.v).toBe(28);
		});
	});

	describe("computeLagrangeCoefficient", () => {
		it("should compute correct Lagrange coefficient for party 1 in 2-party setup", () => {
			const lambda = computeLagrangeCoefficient(1, [1, 2]);
			expect(lambda).toBeGreaterThan(0n);
			expect(lambda).toBeLessThan(CURVE_ORDER);
		});

		it("should compute correct Lagrange coefficient for party 2 in 2-party setup", () => {
			const lambda = computeLagrangeCoefficient(2, [1, 2]);
			expect(lambda).toBeGreaterThan(0n);
			expect(lambda).toBeLessThan(CURVE_ORDER);
		});

		it("should compute correct Lagrange coefficients for 3-party setup", () => {
			const parties = [1, 2, 3];
			for (const partyId of parties) {
				const lambda = computeLagrangeCoefficient(partyId, parties);
				expect(lambda).toBeGreaterThan(0n);
				expect(lambda).toBeLessThan(CURVE_ORDER);
			}
		});
	});

	describe("parseMessageHash", () => {
		it("should parse hex string with 0x prefix", () => {
			const hash = parseMessageHash("0xabcdef");
			expect(hash).toBe(0xabcdefn);
		});

		it("should parse hex string without 0x prefix", () => {
			const hash = parseMessageHash("abcdef");
			expect(hash).toBe(0xabcdefn);
		});
	});

	describe("formatSignature", () => {
		it("should format signature as hex string", () => {
			const r = 0x1234n;
			const s = 0x5678n;
			const v = 27;

			const formatted = formatSignature(r, s, v);

			expect(formatted).toMatch(/^0x[0-9a-f]{130}$/);
			expect(formatted).toContain("1234");
			expect(formatted).toContain("5678");
			expect(formatted.slice(-2)).toBe("1b");
		});
	});
});
