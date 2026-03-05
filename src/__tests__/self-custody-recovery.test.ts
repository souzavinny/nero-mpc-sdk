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

const NONCE_12 = "00".repeat(12);
const TAG_16 = "00".repeat(16);
const PUBKEY_33 = `02${"00".repeat(32)}`;
const CT_HEX = "aabb";

function dummyEncFields() {
	return { ciphertext: CT_HEX, nonce: NONCE_12, tag: TAG_16 };
}

function dummyBackendBlob() {
	return { ephemeralPublicKey: PUBKEY_33, ...dummyEncFields() };
}

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

	it("rejects non-hex or wrong-length encrypted fields in blob", () => {
		const validBase = {
			version: 2,
			sharingType: "multiplicative",
			kdfSalt: "00".repeat(32),
			kdfParams: FAST_KDF,
			metadataMac: "aabb",
		};

		const withBadClientTag = {
			...validBase,
			encryptedClientShare: { ciphertext: CT_HEX, nonce: NONCE_12, tag: "zz" },
			backendShareBlob: dummyBackendBlob(),
		};
		expect(() => parseCompositeBlob(JSON.stringify(withBadClientTag))).toThrow(
			"encryptedClientShare.tag must be",
		);

		const withBadBackendNonce = {
			...validBase,
			encryptedClientShare: dummyEncFields(),
			backendShareBlob: {
				...dummyBackendBlob(),
				nonce: "not-hex!",
			},
		};
		expect(() =>
			parseCompositeBlob(JSON.stringify(withBadBackendNonce)),
		).toThrow("backendShareBlob.nonce must be hex");

		const withOddLenCiphertext = {
			...validBase,
			encryptedClientShare: { ...dummyEncFields(), ciphertext: "aab" },
			backendShareBlob: dummyBackendBlob(),
		};
		expect(() =>
			parseCompositeBlob(JSON.stringify(withOddLenCiphertext)),
		).toThrow("encryptedClientShare.ciphertext must be hex");

		const withShortNonce = {
			...validBase,
			encryptedClientShare: { ...dummyEncFields(), nonce: "aabb" },
			backendShareBlob: dummyBackendBlob(),
		};
		expect(() => parseCompositeBlob(JSON.stringify(withShortNonce))).toThrow(
			"encryptedClientShare.nonce must be 12 bytes",
		);

		const withShortPubkey = {
			...validBase,
			encryptedClientShare: dummyEncFields(),
			backendShareBlob: { ...dummyBackendBlob(), ephemeralPublicKey: "aabb" },
		};
		expect(() => parseCompositeBlob(JSON.stringify(withShortPubkey))).toThrow(
			"backendShareBlob.ephemeralPublicKey must be 33 bytes",
		);
	});

	it("rejects invalid sharingType in blob", () => {
		const blob = {
			version: 2,
			encryptedClientShare: dummyEncFields(),
			backendShareBlob: dummyBackendBlob(),
			sharingType: "unknown_type",
			kdfSalt: "00".repeat(32),
			kdfParams: FAST_KDF,
			metadataMac: "aabb",
		};
		expect(() => parseCompositeBlob(JSON.stringify(blob))).toThrow(
			'Invalid sharingType: "unknown_type"',
		);
	});

	it("rejects extreme KDF params (DoS prevention)", () => {
		const makeBlob = (params: { N: number; r: number; p: number }) =>
			JSON.stringify({
				version: 2,
				encryptedClientShare: dummyEncFields(),
				backendShareBlob: dummyBackendBlob(),
				sharingType: "multiplicative",
				kdfSalt: "00".repeat(32),
				kdfParams: params,
				metadataMac: "aabb",
			});

		expect(() =>
			parseCompositeBlob(makeBlob({ N: 1 << 30, r: 8, p: 1 })),
		).toThrow("Invalid KDF param N");
		expect(() =>
			parseCompositeBlob(makeBlob({ N: 1024, r: 256, p: 1 })),
		).toThrow("Invalid KDF param r");
		expect(() =>
			parseCompositeBlob(makeBlob({ N: 1024, r: 8, p: 100 })),
		).toThrow("Invalid KDF param p");
		expect(() => parseCompositeBlob(makeBlob({ N: 1000, r: 8, p: 1 }))).toThrow(
			"Invalid KDF param N",
		);
	});

	it("detects tampered metadata via HMAC integrity check", async () => {
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

		const tampered = JSON.parse(compositeJson);
		tampered.sharingType = "additive";
		const tamperedJson = JSON.stringify(tampered);

		await expect(
			offlineReconstructKey({
				compositeJson: tamperedJson,
				password,
			}),
		).rejects.toThrow("metadata integrity check failed");
	});

	it("rejects blob with metadataMac stripped", async () => {
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

		const stripped = JSON.parse(compositeJson);
		stripped.metadataMac = undefined;
		const strippedJson = JSON.stringify(stripped);

		expect(() => parseCompositeBlob(strippedJson)).toThrow(
			"Invalid composite blob",
		);

		await expect(
			offlineReconstructKey({
				compositeJson: strippedJson,
				password,
			}),
		).rejects.toThrow("Invalid composite blob");
	});
});
