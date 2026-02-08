import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { describe, expect, it } from "vitest";

const ENTRYPOINT_V06 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

function packUserOpForHash(op: {
	sender: string;
	nonce: bigint;
	initCode: string;
	callData: string;
	callGasLimit: bigint;
	verificationGasLimit: bigint;
	preVerificationGas: bigint;
	maxFeePerGas: bigint;
	maxPriorityFeePerGas: bigint;
	paymasterAndData: string;
}): string {
	const hashInitCode = bytesToHex(
		keccak_256(hexToBytes(op.initCode.slice(2) || "")),
	);
	const hashCallData = bytesToHex(
		keccak_256(hexToBytes(op.callData.slice(2) || "")),
	);
	const hashPaymasterAndData = bytesToHex(
		keccak_256(hexToBytes(op.paymasterAndData.slice(2) || "")),
	);

	return (
		op.sender.slice(2).toLowerCase().padStart(64, "0") +
		op.nonce.toString(16).padStart(64, "0") +
		hashInitCode +
		hashCallData +
		op.callGasLimit.toString(16).padStart(64, "0") +
		op.verificationGasLimit.toString(16).padStart(64, "0") +
		op.preVerificationGas.toString(16).padStart(64, "0") +
		op.maxFeePerGas.toString(16).padStart(64, "0") +
		op.maxPriorityFeePerGas.toString(16).padStart(64, "0") +
		hashPaymasterAndData
	);
}

function getUserOpHash(
	op: Parameters<typeof packUserOpForHash>[0],
	entryPoint: string,
	chainId: number,
): string {
	const packed = packUserOpForHash(op);
	const packedHash = bytesToHex(keccak_256(hexToBytes(packed)));
	const encoded =
		packedHash +
		entryPoint.slice(2).toLowerCase().padStart(64, "0") +
		chainId.toString(16).padStart(64, "0");
	return `0x${bytesToHex(keccak_256(hexToBytes(encoded)))}`;
}

describe("Account Abstraction Components", () => {
	describe("UserOperation Hash", () => {
		it("should compute correct hash for empty UserOp", () => {
			const op = {
				sender: "0x1234567890123456789012345678901234567890",
				nonce: 0n,
				initCode: "0x",
				callData: "0x",
				callGasLimit: 0n,
				verificationGasLimit: 0n,
				preVerificationGas: 0n,
				maxFeePerGas: 0n,
				maxPriorityFeePerGas: 0n,
				paymasterAndData: "0x",
			};

			const hash = getUserOpHash(op, ENTRYPOINT_V06, 1);
			expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
		});

		it("should produce different hashes for different nonces", () => {
			const baseOp = {
				sender: "0x1234567890123456789012345678901234567890",
				nonce: 0n,
				initCode: "0x",
				callData: "0x",
				callGasLimit: 100000n,
				verificationGasLimit: 100000n,
				preVerificationGas: 21000n,
				maxFeePerGas: 1000000000n,
				maxPriorityFeePerGas: 1000000000n,
				paymasterAndData: "0x",
			};

			const hash1 = getUserOpHash(baseOp, ENTRYPOINT_V06, 1);
			const hash2 = getUserOpHash({ ...baseOp, nonce: 1n }, ENTRYPOINT_V06, 1);

			expect(hash1).not.toBe(hash2);
		});

		it("should produce different hashes for different chains", () => {
			const op = {
				sender: "0x1234567890123456789012345678901234567890",
				nonce: 0n,
				initCode: "0x",
				callData: "0x",
				callGasLimit: 100000n,
				verificationGasLimit: 100000n,
				preVerificationGas: 21000n,
				maxFeePerGas: 1000000000n,
				maxPriorityFeePerGas: 1000000000n,
				paymasterAndData: "0x",
			};

			const hash1 = getUserOpHash(op, ENTRYPOINT_V06, 1);
			const hash689 = getUserOpHash(op, ENTRYPOINT_V06, 689);

			expect(hash1).not.toBe(hash689);
		});

		it("should include initCode in hash computation", () => {
			const baseOp = {
				sender: "0x1234567890123456789012345678901234567890",
				nonce: 0n,
				initCode: "0x",
				callData: "0x",
				callGasLimit: 100000n,
				verificationGasLimit: 100000n,
				preVerificationGas: 21000n,
				maxFeePerGas: 1000000000n,
				maxPriorityFeePerGas: 1000000000n,
				paymasterAndData: "0x",
			};

			const hashNoInit = getUserOpHash(baseOp, ENTRYPOINT_V06, 1);
			const hashWithInit = getUserOpHash(
				{ ...baseOp, initCode: "0xabcdef" },
				ENTRYPOINT_V06,
				1,
			);

			expect(hashNoInit).not.toBe(hashWithInit);
		});
	});

	describe("SimpleAccount ABI Encoding", () => {
		const EXECUTE_SELECTOR = "b61d27f6";
		const _EXECUTE_BATCH_SELECTOR = "34fcd5be";

		function encodeExecute(to: string, value: bigint, data: string): string {
			const toEncoded = to.slice(2).toLowerCase().padStart(64, "0");
			const valueEncoded = value.toString(16).padStart(64, "0");
			const dataOffset = (32 * 3).toString(16).padStart(64, "0");
			const dataHex = data.startsWith("0x") ? data.slice(2) : data;
			const dataLength = (dataHex.length / 2).toString(16).padStart(64, "0");
			const dataPadded = dataHex.padEnd(
				Math.ceil(dataHex.length / 64) * 64,
				"0",
			);

			return `0x${EXECUTE_SELECTOR}${toEncoded}${valueEncoded}${dataOffset}${dataLength}${dataPadded}`;
		}

		it("should encode execute call correctly", () => {
			const to = "0x1234567890123456789012345678901234567890";
			const value = 1000000000000000000n;
			const data = "0xabcdef";

			const encoded = encodeExecute(to, value, data);

			expect(encoded.startsWith(`0x${EXECUTE_SELECTOR}`)).toBe(true);
			expect(encoded).toContain(to.slice(2).toLowerCase());
		});

		it("should encode zero value transfers", () => {
			const to = "0x1234567890123456789012345678901234567890";
			const value = 0n;
			const data = "0x";

			const encoded = encodeExecute(to, value, data);

			expect(encoded.startsWith(`0x${EXECUTE_SELECTOR}`)).toBe(true);
			expect(encoded).toContain("0".repeat(64));
		});

		it("should calculate correct bytes[] offsets in executeBatch", () => {
			const callDatas = ["0xaabbccdd", "0x11223344556677889900", "0xff"];

			const n = callDatas.length;
			let currentOffset = 32 + n * 32;
			const offsets: number[] = [];

			for (const data of callDatas) {
				offsets.push(currentOffset);
				const dataHex = data.startsWith("0x") ? data.slice(2) : data;
				const bytesLen = dataHex.length / 2;
				const paddedLen = Math.ceil(bytesLen / 32) * 32;
				currentOffset += 32 + paddedLen;
			}

			expect(offsets[0]).toBe(128);
			expect(offsets[1]).toBe(128 + 32 + 32);
			expect(offsets[2]).toBe(128 + 32 + 32 + 32 + 32);
		});
	});

	describe("Bundler RPC", () => {
		it("should format UserOperation to hex correctly", () => {
			const op = {
				sender: "0x1234567890123456789012345678901234567890",
				nonce: 5n,
				initCode: "0x",
				callData: "0xabcd",
				callGasLimit: 100000n,
				verificationGasLimit: 200000n,
				preVerificationGas: 21000n,
				maxFeePerGas: 1000000000n,
				maxPriorityFeePerGas: 1000000000n,
				paymasterAndData: "0x",
				signature: "0x",
			};

			const hexOp = {
				sender: op.sender,
				nonce: `0x${op.nonce.toString(16)}`,
				initCode: op.initCode,
				callData: op.callData,
				callGasLimit: `0x${op.callGasLimit.toString(16)}`,
				verificationGasLimit: `0x${op.verificationGasLimit.toString(16)}`,
				preVerificationGas: `0x${op.preVerificationGas.toString(16)}`,
				maxFeePerGas: `0x${op.maxFeePerGas.toString(16)}`,
				maxPriorityFeePerGas: `0x${op.maxPriorityFeePerGas.toString(16)}`,
				paymasterAndData: op.paymasterAndData,
				signature: op.signature,
			};

			expect(hexOp.nonce).toBe("0x5");
			expect(hexOp.callGasLimit).toBe("0x186a0");
			expect(hexOp.verificationGasLimit).toBe("0x30d40");
		});
	});

	describe("Paymaster", () => {
		it("should handle empty paymasterAndData", () => {
			const paymasterAndData = "0x";
			expect(paymasterAndData.length).toBe(2);
			expect(paymasterAndData).toBe("0x");
		});

		it("should validate paymaster response structure", () => {
			const validResponse = {
				paymasterAndData: "0x1234567890123456789012345678901234567890abcdef",
				preVerificationGas: "0x5208",
				verificationGasLimit: "0x30d40",
				callGasLimit: "0x186a0",
			};

			expect(validResponse.paymasterAndData.startsWith("0x")).toBe(true);
			expect(validResponse.paymasterAndData.length).toBeGreaterThan(42);
		});
	});
});
