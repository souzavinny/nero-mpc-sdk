import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import { describe, expect, it } from "vitest";

function stripHexPrefix(value: string): string {
	return value.startsWith("0x") ? value.slice(2) : value;
}

function encodeSignedInt(value: bigint): string {
	if (value < 0n) {
		return ((1n << 256n) + value).toString(16).padStart(64, "0");
	}
	return value.toString(16).padStart(64, "0");
}

function encodeField(
	type: string,
	value: unknown,
	_types: Record<string, Array<{ name: string; type: string }>>,
): string {
	if (type === "string") {
		return bytesToHex(keccak_256(utf8ToBytes(value as string)));
	}
	if (type === "bytes") {
		const bytesValue = stripHexPrefix(value as string);
		return bytesToHex(keccak_256(hexToBytes(bytesValue)));
	}
	if (type === "bool") {
		return (value ? 1n : 0n).toString(16).padStart(64, "0");
	}
	if (type === "address") {
		return stripHexPrefix(value as string)
			.toLowerCase()
			.padStart(64, "0");
	}
	if (type.startsWith("uint") || type.startsWith("int")) {
		const n = BigInt(value as number | string);
		if (type.startsWith("int") && n < 0n) {
			return ((1n << 256n) + n).toString(16).padStart(64, "0");
		}
		return n.toString(16).padStart(64, "0");
	}
	if (type.startsWith("bytes")) {
		const bytesValue = stripHexPrefix(value as string);
		return bytesValue.padEnd(64, "0");
	}
	throw new Error(`Unsupported type: ${type}`);
}

describe("EIP-712 Encoding", () => {
	describe("stripHexPrefix", () => {
		it("should strip 0x prefix when present", () => {
			expect(stripHexPrefix("0xabcdef")).toBe("abcdef");
		});

		it("should return unchanged when no prefix", () => {
			expect(stripHexPrefix("abcdef")).toBe("abcdef");
		});

		it("should handle empty string", () => {
			expect(stripHexPrefix("")).toBe("");
		});

		it("should handle 0x only", () => {
			expect(stripHexPrefix("0x")).toBe("");
		});
	});

	describe("Signed Integer Two's Complement", () => {
		it("should encode positive integers correctly", () => {
			expect(encodeSignedInt(1n)).toBe(
				"0000000000000000000000000000000000000000000000000000000000000001",
			);
			expect(encodeSignedInt(255n)).toBe(
				"00000000000000000000000000000000000000000000000000000000000000ff",
			);
		});

		it("should encode -1 as two's complement (all 1s)", () => {
			const result = encodeSignedInt(-1n);
			expect(result).toBe(
				"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
			);
		});

		it("should encode -2 correctly", () => {
			const result = encodeSignedInt(-2n);
			expect(result).toBe(
				"fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe",
			);
		});

		it("should encode large negative numbers correctly", () => {
			const result = encodeSignedInt(-256n);
			expect(result).toBe(
				"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00",
			);
		});

		it("should encode zero correctly", () => {
			expect(encodeSignedInt(0n)).toBe(
				"0000000000000000000000000000000000000000000000000000000000000000",
			);
		});
	});

	describe("encodeField", () => {
		const emptyTypes: Record<
			string,
			Array<{ name: string; type: string }>
		> = {};

		it("should encode int256 negative values with two's complement", () => {
			const result = encodeField("int256", -1, emptyTypes);
			expect(result).toBe(
				"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
			);
		});

		it("should encode int256 positive values normally", () => {
			const result = encodeField("int256", 42, emptyTypes);
			expect(result).toBe(
				"000000000000000000000000000000000000000000000000000000000000002a",
			);
		});

		it("should encode uint256 values without two's complement", () => {
			const result = encodeField("uint256", 42, emptyTypes);
			expect(result).toBe(
				"000000000000000000000000000000000000000000000000000000000000002a",
			);
		});

		it("should handle bytes with 0x prefix", () => {
			const result = encodeField("bytes", "0xabcd", emptyTypes);
			const expected = bytesToHex(keccak_256(hexToBytes("abcd")));
			expect(result).toBe(expected);
		});

		it("should handle bytes without 0x prefix", () => {
			const result = encodeField("bytes", "abcd", emptyTypes);
			const expected = bytesToHex(keccak_256(hexToBytes("abcd")));
			expect(result).toBe(expected);
		});

		it("should handle address with 0x prefix", () => {
			const result = encodeField(
				"address",
				"0x1234567890abcdef1234567890abcdef12345678",
				emptyTypes,
			);
			expect(result).toBe(
				"0000000000000000000000001234567890abcdef1234567890abcdef12345678",
			);
		});

		it("should handle address without 0x prefix", () => {
			const result = encodeField(
				"address",
				"1234567890abcdef1234567890abcdef12345678",
				emptyTypes,
			);
			expect(result).toBe(
				"0000000000000000000000001234567890abcdef1234567890abcdef12345678",
			);
		});

		it("should handle bytes32 with 0x prefix", () => {
			const result = encodeField(
				"bytes32",
				"0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
				emptyTypes,
			);
			expect(result).toBe(
				"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			);
		});

		it("should handle bytes32 without 0x prefix", () => {
			const result = encodeField(
				"bytes32",
				"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
				emptyTypes,
			);
			expect(result).toBe(
				"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			);
		});

		it("should encode bool true as 1", () => {
			const result = encodeField("bool", true, emptyTypes);
			expect(result).toBe(
				"0000000000000000000000000000000000000000000000000000000000000001",
			);
		});

		it("should encode bool false as 0", () => {
			const result = encodeField("bool", false, emptyTypes);
			expect(result).toBe(
				"0000000000000000000000000000000000000000000000000000000000000000",
			);
		});

		it("should encode string as keccak256 hash", () => {
			const result = encodeField("string", "hello", emptyTypes);
			const expected = bytesToHex(keccak_256(utf8ToBytes("hello")));
			expect(result).toBe(expected);
		});
	});
});

describe("ABI Encoding", () => {
	describe("executeBatch offset calculation", () => {
		it("should calculate correct base offset for dynamic arrays", () => {
			const n = 3;
			const baseOffset = 32 + n * 32;
			expect(baseOffset).toBe(128);
		});

		it("should calculate correct offsets for bytes[] array", () => {
			const callDatas = ["0xaabb", "0xccddee", "0xff"];
			const n = callDatas.length;

			let currentOffset = 32 + n * 32;
			const offsets: number[] = [];

			for (const data of callDatas) {
				offsets.push(currentOffset);
				const bytesLen = (data.length - 2) / 2;
				const paddedLen = Math.ceil(bytesLen / 32) * 32;
				currentOffset += 32 + paddedLen;
			}

			expect(offsets[0]).toBe(128);
			expect(offsets[1]).toBe(128 + 32 + 32);
			expect(offsets[2]).toBe(128 + 32 + 32 + 32 + 32);
		});
	});
});
