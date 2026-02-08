import { describe, expect, it } from "vitest";
import {
	bytesToHex,
	computeCommitment,
	generateRandomHex,
	hashSha256,
	hexToBytes,
} from "../core/crypto-primitives";

describe("crypto-primitives", () => {
	describe("hashSha256", () => {
		it("should produce consistent hashes for same input", () => {
			const input = "test message";
			const hash1 = hashSha256(input);
			const hash2 = hashSha256(input);
			expect(hash1).toBe(hash2);
		});

		it("should produce different hashes for different inputs", () => {
			const hash1 = hashSha256("message1");
			const hash2 = hashSha256("message2");
			expect(hash1).not.toBe(hash2);
		});

		it("should produce 64 character hex string (256 bits)", () => {
			const hash = hashSha256("test");
			expect(hash).toHaveLength(64);
			expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
		});
	});

	describe("generateRandomHex", () => {
		it("should generate hex string of correct length", () => {
			const hex16 = generateRandomHex(16);
			expect(hex16).toHaveLength(32);

			const hex32 = generateRandomHex(32);
			expect(hex32).toHaveLength(64);
		});

		it("should generate valid hex characters", () => {
			const hex = generateRandomHex(32);
			expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
		});

		it("should generate different values on each call", () => {
			const hex1 = generateRandomHex(32);
			const hex2 = generateRandomHex(32);
			expect(hex1).not.toBe(hex2);
		});
	});

	describe("computeCommitment", () => {
		it("should produce consistent commitments for same inputs", () => {
			const value = "secret_value";
			const blinding = "blinding_factor";
			const commitment1 = computeCommitment(value, blinding);
			const commitment2 = computeCommitment(value, blinding);
			expect(commitment1).toBe(commitment2);
		});

		it("should produce different commitments for different values", () => {
			const blinding = "same_blinding";
			const commitment1 = computeCommitment("value1", blinding);
			const commitment2 = computeCommitment("value2", blinding);
			expect(commitment1).not.toBe(commitment2);
		});

		it("should produce different commitments for different blindings", () => {
			const value = "same_value";
			const commitment1 = computeCommitment(value, "blinding1");
			const commitment2 = computeCommitment(value, "blinding2");
			expect(commitment1).not.toBe(commitment2);
		});
	});

	describe("bytesToHex and hexToBytes", () => {
		it("should be reversible", () => {
			const original = new Uint8Array([0, 1, 127, 128, 255]);
			const hex = bytesToHex(original);
			const recovered = hexToBytes(hex);
			expect(Array.from(recovered)).toEqual(Array.from(original));
		});

		it("should handle empty arrays", () => {
			const empty = new Uint8Array([]);
			const hex = bytesToHex(empty);
			expect(hex).toBe("");
			const recovered = hexToBytes(hex);
			expect(recovered).toHaveLength(0);
		});

		it("should produce lowercase hex", () => {
			const bytes = new Uint8Array([0xab, 0xcd, 0xef]);
			const hex = bytesToHex(bytes);
			expect(hex).toBe("abcdef");
		});
	});
});
