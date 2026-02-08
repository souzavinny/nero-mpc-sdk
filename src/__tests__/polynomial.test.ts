import { describe, expect, it } from "vitest";
import {
	CURVE_ORDER,
	aggregateShares,
	computeLagrangeCoefficient,
	evaluatePolynomial,
	generatePolynomial,
	hexToScalar,
	mod,
	scalarToHex,
} from "../protocols/dkg/polynomial";

describe("polynomial operations", () => {
	describe("generatePolynomial", () => {
		it("should generate polynomial of correct degree", () => {
			const poly = generatePolynomial(2);
			expect(poly).toHaveLength(3);
		});

		it("should generate non-zero coefficients", () => {
			const poly = generatePolynomial(2);
			for (const coeff of poly) {
				expect(coeff).toBeGreaterThan(0n);
				expect(coeff).toBeLessThan(CURVE_ORDER);
			}
		});

		it("should throw for negative degree", () => {
			expect(() => generatePolynomial(-1)).toThrow("Invalid polynomial degree");
		});

		it("should throw for non-integer degree", () => {
			expect(() => generatePolynomial(1.5)).toThrow(
				"Invalid polynomial degree",
			);
		});

		it("should handle degree 0", () => {
			const poly = generatePolynomial(0);
			expect(poly).toHaveLength(1);
		});
	});

	describe("evaluatePolynomial", () => {
		it("should return constant term at x=0", () => {
			const poly = [100n, 200n, 300n];
			const result = evaluatePolynomial(poly, 0n);
			expect(result).toBe(100n);
		});

		it("should evaluate correctly for simple polynomial", () => {
			const poly = [1n, 2n, 3n];
			const x = 2n;
			const expected = mod(1n + 2n * 2n + 3n * 4n, CURVE_ORDER);
			const result = evaluatePolynomial(poly, x);
			expect(result).toBe(expected);
		});

		it("should handle large coefficients within curve order", () => {
			const largePoly = generatePolynomial(2);
			const result = evaluatePolynomial(largePoly, 5n);
			expect(result).toBeGreaterThanOrEqual(0n);
			expect(result).toBeLessThan(CURVE_ORDER);
		});
	});

	describe("computeLagrangeCoefficient", () => {
		it("should compute valid Lagrange coefficients for threshold 2-of-3", () => {
			const participatingIndices = [1n, 2n];

			const lambda1 = computeLagrangeCoefficient(1n, participatingIndices);
			const lambda2 = computeLagrangeCoefficient(2n, participatingIndices);

			expect(lambda1).toBeGreaterThan(0n);
			expect(lambda1).toBeLessThan(CURVE_ORDER);
			expect(lambda2).toBeGreaterThan(0n);
			expect(lambda2).toBeLessThan(CURVE_ORDER);
		});

		it("should allow reconstruction of secret at x=0", () => {
			const secret = 12345n;
			const poly = [secret, 67890n];

			const share1 = evaluatePolynomial(poly, 1n);
			const share2 = evaluatePolynomial(poly, 2n);

			const lambda1 = computeLagrangeCoefficient(1n, [1n, 2n]);
			const lambda2 = computeLagrangeCoefficient(2n, [1n, 2n]);

			const reconstructed = mod(
				share1 * lambda1 + share2 * lambda2,
				CURVE_ORDER,
			);

			expect(reconstructed).toBe(secret);
		});
	});

	describe("aggregateShares", () => {
		it("should sum all shares correctly", () => {
			const receivedShares = new Map<number, bigint>([
				[1, 100n],
				[2, 200n],
			]);
			const ownShare = 300n;

			const result = aggregateShares(receivedShares, ownShare);
			expect(result).toBe(mod(100n + 200n + 300n, CURVE_ORDER));
		});

		it("should handle empty received shares", () => {
			const receivedShares = new Map<number, bigint>();
			const ownShare = 500n;

			const result = aggregateShares(receivedShares, ownShare);
			expect(result).toBe(500n);
		});
	});

	describe("scalarToHex and hexToScalar", () => {
		it("should be reversible", () => {
			const original = 123456789012345678901234567890n;
			const hex = scalarToHex(original);
			const recovered = hexToScalar(hex);
			expect(recovered).toBe(original);
		});

		it("should produce 64-character hex strings", () => {
			const scalar = 12345n;
			const hex = scalarToHex(scalar);
			expect(hex).toHaveLength(64);
		});

		it("should handle zero", () => {
			const hex = scalarToHex(0n);
			expect(hex).toBe("0".repeat(64));
			expect(hexToScalar(hex)).toBe(0n);
		});
	});
});
