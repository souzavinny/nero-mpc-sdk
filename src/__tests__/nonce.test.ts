import { describe, expect, it } from "vitest";
import {
	combineNonceCommitments,
	computeR,
	createNonceCommitment,
	generateNonceShare,
	verifyNonceCommitment,
	verifyNonceProof,
} from "../protocols/signing/nonce";

describe("nonce operations", () => {
	describe("generateNonceShare", () => {
		it("should generate non-zero k and gamma values", () => {
			const nonce = generateNonceShare();
			expect(nonce.k).toBeGreaterThan(0n);
			expect(nonce.gamma).toBeGreaterThan(0n);
		});

		it("should generate different values each time", () => {
			const nonce1 = generateNonceShare();
			const nonce2 = generateNonceShare();
			expect(nonce1.k).not.toBe(nonce2.k);
			expect(nonce1.gamma).not.toBe(nonce2.gamma);
		});
	});

	describe("createNonceCommitment", () => {
		it("should create commitment with valid D and E points", () => {
			const nonce = generateNonceShare();
			const commitment = createNonceCommitment(1, nonce);

			expect(commitment.partyId).toBe(1);
			expect(commitment.D).toMatch(/^0[23][0-9a-fA-F]{64}$/);
			expect(commitment.E).toMatch(/^0[23][0-9a-fA-F]{64}$/);
			expect(commitment.proof).toBeTruthy();
		});
	});

	describe("verifyNonceCommitment", () => {
		it("should verify valid commitment", () => {
			const nonce = generateNonceShare();
			const commitment = createNonceCommitment(1, nonce);
			expect(verifyNonceCommitment(commitment)).toBe(true);
		});

		it("should reject invalid D point", () => {
			const nonce = generateNonceShare();
			const commitment = createNonceCommitment(1, nonce);
			commitment.D = "invalid";
			expect(verifyNonceCommitment(commitment)).toBe(false);
		});

		it("should reject invalid E point", () => {
			const nonce = generateNonceShare();
			const commitment = createNonceCommitment(1, nonce);
			commitment.E = "invalid";
			expect(verifyNonceCommitment(commitment)).toBe(false);
		});
	});

	describe("verifyNonceProof", () => {
		it("should verify valid nonce proof", () => {
			const nonce = generateNonceShare();
			const commitment = createNonceCommitment(1, nonce);
			expect(verifyNonceProof(commitment)).toBe(true);
		});

		it("should reject proof with tampered s1", () => {
			const nonce = generateNonceShare();
			const commitment = createNonceCommitment(1, nonce);
			const proof = JSON.parse(commitment.proof);
			proof.s1 =
				"0000000000000000000000000000000000000000000000000000000000000001";
			commitment.proof = JSON.stringify(proof);
			expect(verifyNonceProof(commitment)).toBe(false);
		});

		it("should reject proof with tampered s2", () => {
			const nonce = generateNonceShare();
			const commitment = createNonceCommitment(1, nonce);
			const proof = JSON.parse(commitment.proof);
			proof.s2 =
				"0000000000000000000000000000000000000000000000000000000000000001";
			commitment.proof = JSON.stringify(proof);
			expect(verifyNonceProof(commitment)).toBe(false);
		});

		it("should reject proof with tampered R1", () => {
			const nonce = generateNonceShare();
			const commitment = createNonceCommitment(1, nonce);
			const proof = JSON.parse(commitment.proof);
			proof.R1 = `02${"0".repeat(64)}`;
			commitment.proof = JSON.stringify(proof);
			expect(verifyNonceProof(commitment)).toBe(false);
		});

		it("should reject proof with wrong partyId", () => {
			const nonce = generateNonceShare();
			const commitment = createNonceCommitment(1, nonce);
			commitment.partyId = 2;
			expect(verifyNonceProof(commitment)).toBe(false);
		});

		it("should reject malformed proof JSON", () => {
			const nonce = generateNonceShare();
			const commitment = createNonceCommitment(1, nonce);
			commitment.proof = "not json";
			expect(verifyNonceProof(commitment)).toBe(false);
		});

		it("should reject proof with invalid hex in s1", () => {
			const nonce = generateNonceShare();
			const commitment = createNonceCommitment(1, nonce);
			const proof = JSON.parse(commitment.proof);
			proof.s1 = "xyz";
			commitment.proof = JSON.stringify(proof);
			expect(verifyNonceProof(commitment)).toBe(false);
		});
	});

	describe("combineNonceCommitments", () => {
		it("should combine commitments from multiple parties", () => {
			const nonce1 = generateNonceShare();
			const nonce2 = generateNonceShare();
			const commitment1 = createNonceCommitment(1, nonce1);
			const commitment2 = createNonceCommitment(2, nonce2);

			const { R, combinedGamma } = combineNonceCommitments([
				commitment1,
				commitment2,
			]);

			expect(R).toMatch(/^0[23][0-9a-fA-F]{64}$/);
			expect(combinedGamma).toMatch(/^0[23][0-9a-fA-F]{64}$/);
		});
	});

	describe("computeR", () => {
		it("should compute r value and R point from combined nonce", () => {
			const nonce1 = generateNonceShare();
			const nonce2 = generateNonceShare();
			const commitment1 = createNonceCommitment(1, nonce1);
			const commitment2 = createNonceCommitment(2, nonce2);

			const { R } = combineNonceCommitments([commitment1, commitment2]);
			const { r, rPoint } = computeR(R);

			expect(r).toBeGreaterThan(0n);
			expect(rPoint.x).toBeGreaterThan(0n);
			expect(rPoint.y).toBeGreaterThan(0n);
		});
	});
});
