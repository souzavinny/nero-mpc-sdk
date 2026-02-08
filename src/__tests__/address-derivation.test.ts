import { describe, expect, it } from "vitest";
import {
	checksumAddress,
	deriveEOAAddress,
	isValidAddress,
} from "../wallet/address-derivation";

describe("address-derivation", () => {
	describe("deriveEOAAddress", () => {
		it("should derive correct Ethereum address from uncompressed public key", () => {
			const publicKey =
				"04" +
				"50863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b2352" +
				"2cd470243453a299fa9e77237716103abc11a1df38855ed6f2ee187e9c582ba6";

			const address = deriveEOAAddress(publicKey);

			expect(address).toMatch(/^0x[a-f0-9]{40}$/);
			expect(address.length).toBe(42);
		});

		it("should handle public key without 04 prefix", () => {
			const publicKey =
				"50863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b2352" +
				"2cd470243453a299fa9e77237716103abc11a1df38855ed6f2ee187e9c582ba6";

			const address = deriveEOAAddress(publicKey);

			expect(address).toMatch(/^0x[a-f0-9]{40}$/);
		});

		it("should handle public key with 0x prefix", () => {
			const publicKey =
				"0x04" +
				"50863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b2352" +
				"2cd470243453a299fa9e77237716103abc11a1df38855ed6f2ee187e9c582ba6";

			const address = deriveEOAAddress(publicKey);

			expect(address).toMatch(/^0x[a-f0-9]{40}$/);
		});

		it("should throw for invalid public key length", () => {
			const invalidKey = "04" + "abc123";

			expect(() => deriveEOAAddress(invalidKey)).toThrow("Invalid public key");
		});
	});

	describe("checksumAddress", () => {
		it("should produce correct EIP-55 checksum - test vector 1", () => {
			const address = "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed";
			const checksummed = checksumAddress(address);
			expect(checksummed).toBe("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed");
		});

		it("should produce correct EIP-55 checksum - test vector 2", () => {
			const address = "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359";
			const checksummed = checksumAddress(address);
			expect(checksummed).toBe("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359");
		});

		it("should produce correct EIP-55 checksum - test vector 3", () => {
			const address = "0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb";
			const checksummed = checksumAddress(address);
			expect(checksummed).toBe("0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB");
		});

		it("should produce correct EIP-55 checksum - test vector 4", () => {
			const address = "0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb";
			const checksummed = checksumAddress(address);
			expect(checksummed).toBe("0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb");
		});

		it("should be idempotent", () => {
			const address = "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359";
			const checksummed1 = checksumAddress(address);
			const checksummed2 = checksumAddress(checksummed1);

			expect(checksummed1).toBe(checksummed2);
		});
	});

	describe("isValidAddress", () => {
		it("should return true for valid addresses", () => {
			expect(isValidAddress("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359")).toBe(
				true,
			);
			expect(isValidAddress("0xFB6916095CA1DF60BB79CE92CE3EA74C37C5D359")).toBe(
				true,
			);
			expect(isValidAddress("0x0000000000000000000000000000000000000000")).toBe(
				true,
			);
		});

		it("should return false for invalid addresses", () => {
			expect(isValidAddress("fb6916095ca1df60bb79ce92ce3ea74c37c5d359")).toBe(
				false,
			);
			expect(isValidAddress("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d35")).toBe(
				false,
			);
			expect(
				isValidAddress("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d3599"),
			).toBe(false);
			expect(isValidAddress("0xGG6916095ca1df60bb79ce92ce3ea74c37c5d359")).toBe(
				false,
			);
			expect(isValidAddress("")).toBe(false);
		});
	});
});
