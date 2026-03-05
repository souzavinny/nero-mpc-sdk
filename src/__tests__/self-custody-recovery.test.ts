import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex } from "@noble/hashes/utils";
import { describe, expect, it } from "vitest";
import {
	buildCompositeBlob,
	deriveRecoverySeed,
	extractClientShare,
	offlineReconstructKey,
	parseCompositeBlob,
	seedToPublicKey,
	seedToScalar,
	setupSelfCustodyRecovery,
} from "../core/self-custody-recovery";
import {
	CURVE_ORDER,
	hexToScalar,
	mod,
	scalarToHex,
} from "../protocols/dkg/polynomial";
import { encryptShare } from "../protocols/dkg/share-exchange";
import { deriveEthereumAddress } from "../protocols/dkls/crypto";

const BASE = secp256k1.ProjectivePoint.BASE;
const FAST_KDF = { N: 1024, r: 8, p: 1 };

async function buildTestComposite(
	skA: bigint,
	skB: bigint,
	password: string,
	sharingType: "multiplicative" | "additive",
) {
	const salt = crypto.getRandomValues(new Uint8Array(32));
	const seed = await deriveRecoverySeed(password, salt, FAST_KDF);
	const recoveryPk = seedToPublicKey(seed);

	const encrypted = await encryptShare(skB, 2, 1, recoveryPk);

	return buildCompositeBlob(
		scalarToHex(skA),
		{
			ephemeralPublicKey: encrypted.ephemeralPublicKey,
			ciphertext: encrypted.ciphertext,
			nonce: encrypted.nonce,
			tag: encrypted.tag,
		},
		sharingType,
		bytesToHex(salt),
		FAST_KDF,
		seed,
	);
}

describe("self-custody-recovery", () => {
	it("round-trip: setup -> offline recovery -> address match (multiplicative)", async () => {
		const skA = hexToScalar(
			"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
		);
		const skB = hexToScalar(
			"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		);
		const fullKey = mod(skA * skB, CURVE_ORDER);
		const expectedAddress = deriveEthereumAddress(
			BASE.multiply(fullKey).toHex(false),
		);

		const compositeJson = await buildTestComposite(
			skA,
			skB,
			"test-password-long-enough",
			"multiplicative",
		);

		const result = await offlineReconstructKey({
			compositeJson,
			password: "test-password-long-enough",
		});

		expect(result.walletAddress.toLowerCase()).toBe(
			expectedAddress.toLowerCase(),
		);
		expect(result.privateKey).toBe(`0x${scalarToHex(fullKey)}`);
	});

	it("wrong password fails decryption", async () => {
		const skA = hexToScalar(
			"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
		);
		const skB = hexToScalar(
			"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		);

		const compositeJson = await buildTestComposite(
			skA,
			skB,
			"correct-password-long",
			"multiplicative",
		);

		await expect(
			offlineReconstructKey({
				compositeJson,
				password: "wrong-password-long-enough",
			}),
		).rejects.toThrow();
	});

	it("extractClientShare returns correct hex", async () => {
		const skA = hexToScalar(
			"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
		);
		const skB = hexToScalar(
			"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		);
		const password = "test-password-long-enough";

		const compositeJson = await buildTestComposite(
			skA,
			skB,
			password,
			"multiplicative",
		);

		const extracted = await extractClientShare(compositeJson, password);
		expect(extracted).toBe(scalarToHex(skA));
	});

	it("parseCompositeBlob rejects bad input", () => {
		expect(() => parseCompositeBlob("")).toThrow("Invalid composite blob");
		expect(() => parseCompositeBlob("not-json")).toThrow(
			"Invalid composite blob",
		);
		expect(() => parseCompositeBlob("{}")).toThrow("Invalid composite blob");
		expect(() => parseCompositeBlob(JSON.stringify({ version: 1 }))).toThrow(
			"Invalid composite blob",
		);
	});

	it("additive reconstruction produces correct key", async () => {
		const skA = hexToScalar(
			"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
		);
		const skB = hexToScalar(
			"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		);
		const fullKey = mod(2n * skA - skB, CURVE_ORDER);
		const expectedAddress = deriveEthereumAddress(
			BASE.multiply(fullKey).toHex(false),
		);

		const compositeJson = await buildTestComposite(
			skA,
			skB,
			"test-password-long-enough",
			"additive",
		);

		const result = await offlineReconstructKey({
			compositeJson,
			password: "test-password-long-enough",
		});

		expect(result.walletAddress.toLowerCase()).toBe(
			expectedAddress.toLowerCase(),
		);
	});

	it("seedToScalar reduces seed >= CURVE_ORDER correctly", () => {
		const largeSeed = new Uint8Array(32);
		largeSeed.fill(0xff);

		const scalar = seedToScalar(largeSeed);
		expect(scalar > 0n).toBe(true);
		expect(scalar < CURVE_ORDER).toBe(true);

		const expected = mod(BigInt(`0x${bytesToHex(largeSeed)}`), CURVE_ORDER);
		expect(scalar).toBe(expected);
	});

	it("sharingType preserved in blob round-trip", async () => {
		const skA = hexToScalar(
			"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
		);
		const skB = hexToScalar(
			"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		);

		for (const sharingType of ["multiplicative", "additive"] as const) {
			const json = await buildTestComposite(skA, skB, "pwd", sharingType);
			const parsed = parseCompositeBlob(json);
			expect(parsed.sharingType).toBe(sharingType);
		}
	});

	it("expectedAddress mismatch throws SELF_CUSTODY_RECOVERY_FAILED", async () => {
		const skA = hexToScalar(
			"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
		);
		const skB = hexToScalar(
			"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		);
		const password = "test-password-long-enough";

		const compositeJson = await buildTestComposite(
			skA,
			skB,
			password,
			"multiplicative",
		);

		await expect(
			offlineReconstructKey({
				compositeJson,
				password,
				expectedAddress: "0x0000000000000000000000000000000000000000",
			}),
		).rejects.toThrow("Address mismatch");
	});

	it("rejects short passwords during setup", async () => {
		const mockApiClient = {} as Parameters<
			typeof setupSelfCustodyRecovery
		>[0]["apiClient"];

		await expect(
			setupSelfCustodyRecovery({
				password: "short",
				clientShareHex: "aa".repeat(32),
				apiClient: mockApiClient,
				protocol: "dkls",
			}),
		).rejects.toThrow("Password must be at least 12 characters");
	});
});
